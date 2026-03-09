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
      'Gestión de clientes y vendedores',
      'Reportes básicos',
      'Dashboard con KPIs',
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
      'Multi-almacén',
      'Gestión de compras avanzada',
      'CRM completo (Leads, Actividades)',
      'Marketing campaigns editor visual',
      'Cotizaciones y ventas avanzadas',
      'Reportes avanzados y analytics',
      'Soporte prioritario'
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
      'Usuarios ilimitados',
      'Todas las funcionalidades de Business',
      'Módulo de Contabilidad completo',
      'Módulo de Nómina (RRHH)',
      'API personalizada',
      'Reportes personalizados',
      'Soporte 24/7 dedicado',
      'Migración de datos asistida'
    ]),
    active: true
  }
]

async function seedPlans() {
  console.log('🌱 Inicializando/Actualizando planes...')

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan
    })

    console.log(`✅ Plan "${plan.name}" sincronizado`)
  }

  console.log('✨ Planes sincronizados correctamente')
}

seedPlans()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


