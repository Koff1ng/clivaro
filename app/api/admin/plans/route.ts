import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const DEFAULT_PLANS = [
  {
    name: 'Starter',
    description: 'Perfecto para pequeños negocios que están comenzando',
    price: 49900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Hasta 2 usuarios incluidos',
      'Gestión de productos ilimitados',
      'Punto de Venta (POS)',
      'Control de inventario básico',
      'Facturación electrónica',
      'Clientes y proveedores',
      'Reportes básicos',
      'Dashboard con KPIs',
      'Soporte por email',
      'Actualizaciones incluidas',
    ]),
    active: true,
  },
  {
    name: 'Business',
    description: 'Ideal para negocios en crecimiento',
    price: 79900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Hasta 5 usuarios incluidos',
      'Todas las funcionalidades de Starter',
      'CRM completo (Clientes, Leads, Actividades)',
      'Marketing campaigns con editor visual',
      'Multi-almacén',
      'Cotizaciones y facturas avanzadas',
      'Gestión de compras completa',
      'Reportes avanzados y analytics',
      'Integración de email',
      'Soporte prioritario',
      'Backup automático',
      'Actualizaciones prioritarias',
    ]),
    active: true,
  },
  {
    name: 'Enterprise',
    description: 'Para negocios grandes que necesitan todo',
    price: 149900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Hasta 15 usuarios incluidos',
      'Todas las funcionalidades de Business',
      'Usuarios ilimitados (consultar)',
      'API personalizada',
      'Integraciones avanzadas',
      'Personalización de reportes',
      'Soporte 24/7',
      'Capacitación incluida',
      'Gestor de cuenta dedicado',
      'Migración de datos asistida',
      'Hosting dedicado (opcional)',
      'SLA garantizado',
    ]),
    active: true,
  },
] as const

async function ensureDefaultPlans() {
  const count = await prisma.plan.count()
  if (count > 0) return

  for (const p of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        interval: p.interval,
        features: p.features,
        active: true,
      },
    })
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }


  const user = session.user as any
    
    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    await ensureDefaultPlans()

    const plans = await prisma.plan.findMany({
      orderBy: {
        price: 'asc'
      }
    })

    return NextResponse.json(plans)
  } catch (error: any) {
    logger.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Error al obtener planes') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }


  const user = session.user as any
    
    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, price, currency, interval, features, active } = body

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        currency: currency || 'COP',
        interval,
        features: features ? JSON.stringify(features) : null,
        active: active !== undefined ? active : true
      }
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating plan:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Error al crear plan') },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAuth(request)
    if (session instanceof NextResponse) return session

    const user = session.user as any
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })
    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, price, currency, interval, features, active } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id del plan' }, { status: 400 })
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(currency !== undefined && { currency }),
        ...(interval !== undefined && { interval }),
        ...(features !== undefined && { features: JSON.stringify(features) }),
        ...(active !== undefined && { active }),
      }
    })

    return NextResponse.json(plan)
  } catch (error: any) {
    logger.error('Error updating plan:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Error al actualizar plan') },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth(request)
    if (session instanceof NextResponse) return session

    const user = session.user as any
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })
    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Se requiere id del plan' }, { status: 400 })
    }

    const subscriberCount = await prisma.subscription.count({
      where: { planId: id, status: { in: ['active', 'trial'] } }
    })

    if (subscriberCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: ${subscriberCount} suscriptor(es) activos` },
        { status: 409 }
      )
    }

    await prisma.plan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting plan:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Error al eliminar plan') },
      { status: 500 }
    )
  }
}



