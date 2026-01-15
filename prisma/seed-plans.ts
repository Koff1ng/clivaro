import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const plans = [
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
      'Actualizaciones incluidas'
    ]),
    active: true
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
      'Actualizaciones prioritarias'
    ]),
    active: true
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
      'SLA garantizado'
    ]),
    active: true
  }
]

async function seedPlans() {
  console.log('🌱 Inicializando planes...')

  for (const plan of plans) {
    const existing = await prisma.plan.findUnique({
      where: { name: plan.name }
    })

    if (existing) {
      console.log(`⏭️  Plan "${plan.name}" ya existe, omitiendo...`)
      continue
    }

    await prisma.plan.create({
      data: plan
    })

    console.log(`✅ Plan "${plan.name}" creado`)
  }

  console.log('✨ Planes inicializados correctamente')
}

seedPlans()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


