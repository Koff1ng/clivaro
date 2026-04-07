import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const masterPrisma = new PrismaClient()

export async function GET(request: Request) {
  const session = await requirePermission(request as any, 'manage_settings' as any)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    // Get tenant slug
    const tenant = await masterPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true }
    })

    const folder = tenant?.slug || tenantId
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: files, error } = await supabase.storage
      .from('backups')
      .list(folder, { sortBy: { column: 'created_at', order: 'desc' }, limit: 10 })

    if (error) {
      // Bucket might not exist yet - return empty list
      return NextResponse.json({ backups: [] })
    }

    const backups = (files || [])
      .filter(f => f.name.endsWith('.json'))
      .map(f => {
        const { data: urlData } = supabase.storage
          .from('backups')
          .getPublicUrl(`${folder}/${f.name}`)

        return {
          id: f.id,
          name: f.name,
          size: f.metadata?.size || 0,
          createdAt: f.created_at,
          downloadUrl: urlData.publicUrl,
        }
      })

    return NextResponse.json({ backups })
  } catch (error: any) {
    logger.error('Error listing backups:', error)
    return NextResponse.json({ backups: [] })
  } finally {
    await masterPrisma.$disconnect()
  }
}
