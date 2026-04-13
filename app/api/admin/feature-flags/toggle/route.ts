import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, isSuperAdmin: true, name: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const body = await request.json()
    const { tenantId, featureFlagId, enabled } = body

    if (!tenantId || !featureFlagId) {
      return NextResponse.json({ error: 'tenantId y featureFlagId son requeridos' }, { status: 400 })
    }

    const result = await (prisma as any).tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId, featureFlagId } },
      update: { enabled },
      create: { tenantId, featureFlagId, enabled }
    })

    // Audit log
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
      const flag = await (prisma as any).featureFlag.findUnique({ where: { id: featureFlagId }, select: { name: true } })
      await (prisma as any).adminAuditLog.create({
        data: {
          action: enabled ? 'ENABLE_FEATURE' : 'DISABLE_FEATURE',
          adminUserId: user.id,
          adminUserName: user.name || '',
          targetTenantId: tenantId,
          targetTenantName: tenant?.name || '',
          details: JSON.stringify({ flag: flag?.name, enabled }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        }
      })
    } catch { /* audit table may not exist */ }

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error toggling feature flag:', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Error interno') }, { status: 500 })
  }
}
