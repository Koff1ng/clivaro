import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const plans = [
  {
    name: 'Starter',
    description: 'Esencial para pequeños negocios y emprendedores',
    price: 79900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Hasta 3 usuarios incluidos',
      'Gestión de productos ilimitados',
      'Punto de Venta (POS)',
      'Facturación electrónica DIAN (50 facturas/mes)',
      'Control de inventario (1 bodega)',
      'Gestión de clientes y proveedores',
      'Cotizaciones',
      'Control de caja y turnos',
      'Dashboard con KPIs',
      'Reportes básicos de ventas',
      'Actualizaciones incluidas',
      'Soporte por Email'
    ]),
    active: true
  },
  {
    name: 'Business',
    description: 'La solución completa para empresas en crecimiento',
    price: 149900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Hasta 8 usuarios incluidos',
      'Todas las funcionalidades de Starter',
      'Facturación electrónica DIAN ilimitada',
      'Multi-bodega (hasta 3 bodegas)',
      'CRM completo (Leads, Actividades)',
      'Campañas de Marketing (editor visual)',
      'Gestión de Compras (Órdenes, Recepciones)',
      'Cotizaciones avanzadas',
      'Reportes avanzados y analytics',
      'Soporte Prioritario'
    ]),
    active: true
  },
  {
    name: 'Enterprise',
    description: 'Escalabilidad total para grandes operaciones',
    price: 249900,
    currency: 'COP',
    interval: 'monthly',
    features: JSON.stringify([
      'Usuarios ilimitados',
      'Todas las funcionalidades de Business',
      'Facturación electrónica DIAN ilimitada',
      'Bodegas ilimitadas',
      'Módulo de Contabilidad completo (PUC, Asientos, Balance)',
      'Módulo de Nómina y RRHH',
      'Módulo de Restaurante (Mesas, Pedidos, Cocina)',
      'Reportes personalizados',
      'Soporte Dedicado 24/7',
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
