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

  try {
    const config = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.tenantEmailConfig.findUnique({ where: { tenantId } })
    })

    if (!config) {
        return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 })
    }

    // 1. Check with Resend
    const resendResponse = await fetch(`https://api.resend.com/domains/${config.resendDomainId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
        throw new Error(resendData.message || 'Error al verificar dominio en Resend')
    }

    const verified = resendData.status === 'verified'

    // 2. Update status in database if verified
    if (verified && !config.verified) {
      await withTenantTx(tenantId, async (prisma) => {
        await prisma.tenantEmailConfig.update({
          where: { tenantId },
          data: { verified: true },
        })
      })
    }

    return NextResponse.json({ 
      success: true, 
      verified,
      status: resendData.status,
      domain: config.domain,
      dns_records: resendData.records || config.dnsRecords
    })
  } catch (error: any) {
    logger.error('Error in email-verify POST', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
