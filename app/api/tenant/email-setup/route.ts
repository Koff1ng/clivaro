import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const RESEND_API_KEY = process.env.RESEND_MASTER_API_KEY

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { domain, fromPrefix, fromName } = await request.json()

  if (!domain || !fromPrefix || !fromName) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  try {
    // 1. Create domain in Resend
    const resendResponse = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(resendData.message || 'Error al crear dominio en Resend')
    }

    const fromEmail = `${fromPrefix}@${domain}`

    // 2. Save configuration in tenant database
    const config = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.tenantEmailConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          resendDomainId: resendData.id,
          domain,
          fromEmail,
          fromName,
          dnsRecords: resendData.records,
          verified: false,
        },
        update: {
          resendDomainId: resendData.id,
          domain,
          fromEmail,
          fromName,
          dnsRecords: resendData.records,
          verified: false,
        },
      })
    })

    return NextResponse.json({ 
      success: true, 
      dns_records: config.dnsRecords 
    })
  } catch (error: any) {
    logger.error('Error in email-setup POST', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const config = await withTenantRead(tenantId, async (prisma) => {
        return await prisma.tenantEmailConfig.findUnique({ where: { tenantId } })
    })

    if (config) {
      // 1. Delete from Resend
      await fetch(`https://api.resend.com/domains/${config.resendDomainId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
      })

      // 2. Delete from database
      await withTenantTx(tenantId, async (prisma) => {
        await prisma.tenantEmailConfig.delete({ where: { tenantId } })
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error in email-setup DELETE', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
