import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { PrismaClient } from '@prisma/client'
import { withTenantRead } from '@/lib/tenancy'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const masterPrisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const BACKUP_BUCKET = 'backups'
const MAX_BACKUPS_PER_TENANT = 7

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron uses CRON_SECRET header)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Array<{ tenant: string; status: string; error?: string }> = []

  try {
    const tenants = await masterPrisma.tenant.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true }
    })

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket(BACKUP_BUCKET, { public: false })
    } catch (e) {
      // Bucket already exists — OK
    }

    for (const tenant of tenants) {
      try {
        // Generate JSON backup
        const backupData = await withTenantRead(tenant.id, async (prisma) => {
          const [customers, products, invoices, suppliers, stockLevels] = await Promise.all([
            prisma.customer.findMany(),
            prisma.product.findMany({ include: { variants: true } }),
            prisma.invoice.findMany({
              include: { items: true, payments: true },
              orderBy: { createdAt: 'desc' },
              take: 10000,
            }),
            prisma.supplier.findMany(),
            prisma.stockLevel.findMany(),
          ])

          return { customers, products, invoices, suppliers, stockLevels }
        })

        // Fetch tenant settings from master DB
        const settings = await masterPrisma.tenantSettings.findUnique({
          where: { tenantId: tenant.id }
        })

        const fullBackup = {
          ...backupData,
          settings: settings || null,
          meta: {
            tenantId: tenant.id,
            tenantName: tenant.name,
            generatedAt: new Date().toISOString(),
            type: 'automatic',
          }
        }

        const jsonString = JSON.stringify(fullBackup)
        const date = new Date().toISOString().split('T')[0]
        const time = new Date().toISOString().split('T')[1]?.replace(/[:.]/g, '-')?.slice(0, 8) || ''
        const path = `${tenant.slug || tenant.id}/${date}_${time}.json`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(BACKUP_BUCKET)
          .upload(path, jsonString, {
            contentType: 'application/json',
            upsert: false,
          })

        if (uploadError) throw uploadError

        // Cleanup old backups (keep last MAX_BACKUPS_PER_TENANT)
        const { data: files } = await supabase.storage
          .from(BACKUP_BUCKET)
          .list(tenant.slug || tenant.id, { sortBy: { column: 'created_at', order: 'desc' } })

        if (files && files.length > MAX_BACKUPS_PER_TENANT) {
          const toDelete = files.slice(MAX_BACKUPS_PER_TENANT).map(f => `${tenant.slug || tenant.id}/${f.name}`)
          await supabase.storage.from(BACKUP_BUCKET).remove(toDelete)
        }

        results.push({ tenant: tenant.name, status: 'success' })
      } catch (err: any) {
        logger.error(`Backup failed for ${tenant.name}:`, err)
        results.push({ tenant: tenant.name, status: 'error', error: err.message })
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    logger.error('Cron backup error:', error)
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  } finally {
    await masterPrisma.$disconnect()
  }
}
