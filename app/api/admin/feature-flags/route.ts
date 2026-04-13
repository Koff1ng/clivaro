import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const DEFAULT_FLAGS = [
  { key: 'MODULE_POS', name: 'Punto de Venta (POS)', category: 'module', description: 'Sistema de punto de venta con facturación' },
  { key: 'MODULE_CRM', name: 'CRM', category: 'module', description: 'Gestión de leads, oportunidades y pipeline' },
  { key: 'MODULE_ACCOUNTING', name: 'Contabilidad', category: 'module', description: 'Plan de cuentas, asientos contables, reportes' },
  { key: 'MODULE_PAYROLL', name: 'Nómina', category: 'module', description: 'Gestión de empleados y liquidación de nómina' },
  { key: 'MODULE_INVENTORY', name: 'Inventario Avanzado', category: 'module', description: 'Multi-almacén, zonas, inventarios físicos' },
  { key: 'MODULE_RESTAURANT', name: 'Restaurante', category: 'module', description: 'Modo restaurante con mesas y comandero' },
  { key: 'MODULE_MARKETING', name: 'Marketing', category: 'module', description: 'Campañas de email y Meta Ads' },
  { key: 'MODULE_PURCHASES', name: 'Compras', category: 'module', description: 'Órdenes de compra y recepción de mercancía' },
  { key: 'FEATURE_ELECTRONIC_INVOICE', name: 'Facturación Electrónica', category: 'feature', description: 'Integración con DIAN vía Factus' },
  { key: 'FEATURE_MULTI_WAREHOUSE', name: 'Multi-Almacén', category: 'feature', description: 'Múltiples almacenes con transferencias' },
  { key: 'FEATURE_AI_ASSISTANT', name: 'Asistente IA', category: 'beta', description: 'Chatbot con IA para preguntas del sistema' },
]

async function ensureDefaultFlags() {
  try {
    const count = await (prisma as any).featureFlag.count()
    if (count > 0) return

    for (const flag of DEFAULT_FLAGS) {
      await (prisma as any).featureFlag.create({
        data: { ...flag, isGlobal: true }
      })
    }
  } catch {
    // Table may not exist yet
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { isSuperAdmin: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    await ensureDefaultFlags()

    const flags = await (prisma as any).featureFlag.findMany({
      include: {
        tenantFlags: {
          include: { tenant: { select: { id: true, name: true, slug: true, active: true } } }
        }
      },
      orderBy: { category: 'asc' }
    })

    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, active: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ flags, tenants })
  } catch (error: any) {
    logger.error('Error fetching feature flags:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { isSuperAdmin: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const body = await request.json()
    const { key, name, description, category, isGlobal } = body

    const flag = await (prisma as any).featureFlag.create({
      data: { key, name, description, category: category || 'feature', isGlobal: isGlobal || false }
    })

    return NextResponse.json(flag, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating feature flag:', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Error interno') }, { status: 500 })
  }
}
