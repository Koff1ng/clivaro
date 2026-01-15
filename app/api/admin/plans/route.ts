import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

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
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener planes' },
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
    console.error('Error creating plan:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear plan' },
      { status: 500 }
    )
  }
}


