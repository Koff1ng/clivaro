import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de datos demo...')

  // Limpiar datos existentes (opcional - comentar si quieres mantener datos)
  console.log('🧹 Limpiando datos existentes...')
  await prisma.payment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.salesOrderItem.deleteMany()
  await prisma.salesOrder.deleteMany()
  await prisma.quotationItem.deleteMany()
  await prisma.quotation.deleteMany()
  await prisma.goodsReceiptItem.deleteMany()
  await prisma.goodsReceipt.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.leadStageHistory.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.marketingCampaignRecipient.deleteMany()
  await prisma.marketingCampaign.deleteMany()
  await prisma.priceListItem.deleteMany()
  await prisma.physicalInventoryItem.deleteMany()
  await prisma.physicalInventory.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.stockLevel.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.cashMovement.deleteMany()
  await prisma.cashShift.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.supplier.deleteMany()

  // Obtener usuario admin
  let adminUser = await prisma.user.findFirst({
    where: { isSuperAdmin: true }
  })
  
  if (!adminUser) {
    adminUser = await prisma.user.findFirst({
      where: { email: 'admin@local' }
    })
  }

  if (!adminUser) {
    // Verificar si existe el seed básico primero
    console.log('⚠️ No se encontró usuario admin. Ejecutando seed básico primero...')
    console.log('💡 Ejecuta: npm run db:seed')
    console.log('💡 Luego ejecuta: npm run db:seed-demo')
    return
  }

  console.log('✅ Usuario admin encontrado:', adminUser.name)

  // Crear almacenes
  console.log('📦 Creando almacenes...')
  const warehouse1 = await prisma.warehouse.upsert({
    where: { name: 'Almacén Principal' },
    update: {},
    create: {
      name: 'Almacén Principal',
      address: 'Calle Industrial 123, Zona Industrial',
      active: true,
    },
  })

  const warehouse2 = await prisma.warehouse.upsert({
    where: { name: 'Almacén Sucursal Centro' },
    update: {},
    create: {
      name: 'Almacén Sucursal Centro',
      address: 'Avenida Principal 456, Centro',
      active: true,
    },
  })

  // Crear productos demo (más variados y realistas)
  console.log('🛍️ Creando productos demo...')
  const productsData = [
    // Herramientas
    { sku: 'MART-001', barcode: '7701234567890', name: 'Martillo de Acero 16oz', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 15.50, price: 28.00, taxRate: 19, trackStock: true, description: 'Martillo de acero forjado con mango de fibra de vidrio' },
    { sku: 'DEST-002', barcode: '7701234567891', name: 'Destornillador Phillips #2', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 5.00, price: 9.50, taxRate: 19, trackStock: true, description: 'Destornillador Phillips profesional' },
    { sku: 'ALIC-003', barcode: '7701234567892', name: 'Alicates Universales 8"', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
    { sku: 'LLAV-004', barcode: '7701234567893', name: 'Juego de Llaves Mixtas 10pcs', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'SET', cost: 35.00, price: 65.00, taxRate: 19, trackStock: true },
    { sku: 'TALAD-005', barcode: '7701234567894', name: 'Taladro Eléctrico 750W', brand: 'PowerTool', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 85.00, price: 150.00, taxRate: 19, trackStock: true },
    
    // Fijaciones
    { sku: 'CLAV-006', barcode: '7701234567895', name: 'Clavos 2.5" x 1kg', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'KILO', cost: 3.50, price: 6.50, taxRate: 19, trackStock: true },
    { sku: 'TORN-007', barcode: '7701234567896', name: 'Tornillos 3/8" x 1kg', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'KILO', cost: 4.50, price: 8.50, taxRate: 19, trackStock: true },
    { sku: 'TUER-008', barcode: '7701234567897', name: 'Tuercas y Arandelas Juego', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'BOX', cost: 8.00, price: 15.00, taxRate: 19, trackStock: true },
    
    // Plomería
    { sku: 'TUBO-009', barcode: '7701234567898', name: 'Tubo PVC 1/2" x 6m', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'METER', cost: 2.00, price: 4.00, taxRate: 19, trackStock: true },
    { sku: 'CODO-010', barcode: '7701234567899', name: 'Codo PVC 1/2" 90°', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'UNIT', cost: 0.80, price: 1.50, taxRate: 19, trackStock: true },
    { sku: 'VALV-011', barcode: '7701234567900', name: 'Válvula de Compuerta 1/2"', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
    
    // Pinturas
    { sku: 'PINT-012', barcode: '7701234567901', name: 'Pintura Blanca Mate 1L', brand: 'Color Plus', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
    { sku: 'PINT-013', barcode: '7701234567902', name: 'Pintura Blanca Mate 4L', brand: 'Color Plus', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 45.00, price: 80.00, taxRate: 19, trackStock: true },
    { sku: 'BROC-014', barcode: '7701234567903', name: 'Brocha 4" Profesional', brand: 'Pinturas', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 4.00, price: 8.00, taxRate: 19, trackStock: true },
    { sku: 'RODL-015', barcode: '7701234567904', name: 'Rodillo 9" con Mango', brand: 'Pinturas', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 6.00, price: 12.00, taxRate: 19, trackStock: true },
    
    // Eléctricos
    { sku: 'CABL-016', barcode: '7701234567905', name: 'Cable Eléctrico 2.5mm x 100m', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 1.50, price: 3.00, taxRate: 19, trackStock: true },
    { sku: 'LAMP-017', barcode: '7701234567906', name: 'Lámpara LED 12W E27', brand: 'Iluminación LED', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 8.00, price: 15.00, taxRate: 19, trackStock: true },
    { sku: 'TOMA-018', barcode: '7701234567907', name: 'Tomacorriente Simple', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 3.50, price: 7.00, taxRate: 19, trackStock: true },
    { sku: 'BREAK-019', barcode: '7701234567908', name: 'Breaker 20A Monopolar', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 15.00, price: 28.00, taxRate: 19, trackStock: true },
    
    // Materiales de Construcción
    { sku: 'CEM-020', barcode: '7701234567909', name: 'Cemento Gris 50kg', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'BAG', cost: 18.00, price: 32.00, taxRate: 19, trackStock: true },
    { sku: 'AREN-021', barcode: '7701234567910', name: 'Arena Fina x m³', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'CUBIC_METER', cost: 25.00, price: 45.00, taxRate: 19, trackStock: true },
    { sku: 'LAD-022', barcode: '7701234567911', name: 'Ladrillo Común x 1000', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'THOUSAND', cost: 120.00, price: 220.00, taxRate: 19, trackStock: true },
  ]

  const createdProducts = []
  for (const product of productsData) {
    const created = await prisma.product.create({
      data: {
        ...product,
        createdById: adminUser.id,
      },
    })
    createdProducts.push(created)
  }

  // Crear niveles de stock
  console.log('📊 Creando niveles de stock...')
  for (const product of createdProducts) {
    const initialStock = Math.floor(Math.random() * 200) + 50 // 50-250 unidades
    const minStock = Math.floor(initialStock * 0.2)

    await prisma.stockLevel.create({
      data: {
        warehouseId: warehouse1.id,
        productId: product.id,
        quantity: initialStock,
        minStock: minStock,
      },
    })

    // Stock en segundo almacén (algunos productos)
    if (Math.random() > 0.5) {
      const stock2 = Math.floor(initialStock * 0.3)
      await prisma.stockLevel.create({
        data: {
          warehouseId: warehouse2.id,
          productId: product.id,
          quantity: stock2,
          minStock: Math.floor(stock2 * 0.2),
        },
      })
    }

    // Movimiento inicial
    await prisma.stockMovement.create({
      data: {
        warehouseId: warehouse1.id,
        productId: product.id,
        type: 'IN',
        quantity: initialStock,
        cost: product.cost,
        reason: 'Stock inicial demo',
        createdById: adminUser.id,
        reference: 'INIT-DEMO',
      },
    })
  }

  // Crear clientes demo
  console.log('👥 Creando clientes demo...')
  const customersData = [
    { name: 'Constructora ABC S.A.S.', phone: '+57 300 123 4567', email: 'compras@constructoraabc.com', address: 'Calle 100 #50-30, Bogotá', taxId: '900123456-1', tags: 'Empresa,Construcción', notes: 'Cliente corporativo, pago a 30 días' },
    { name: 'Juan Pérez', phone: '+57 310 234 5678', email: 'juan.perez@email.com', address: 'Carrera 15 #45-20, Medellín', taxId: '1234567890', tags: 'Particular', notes: 'Cliente frecuente, pago en efectivo' },
    { name: 'María García', phone: '+57 320 345 6789', email: 'maria.garcia@email.com', address: 'Avenida 68 #12-45, Cali', taxId: '9876543210', tags: 'Particular', notes: 'Compra productos de pintura regularmente' },
    { name: 'Pedro López', phone: '+57 315 456 7890', email: 'pedro.lopez@email.com', address: 'Calle 72 #10-15, Barranquilla', taxId: '1122334455', tags: 'Particular', notes: 'Cliente nuevo' },
    { name: 'Ana Martínez', phone: '+57 300 567 8901', email: 'ana.martinez@email.com', address: 'Carrera 30 #25-10, Bucaramanga', taxId: '5566778899', tags: 'Particular', notes: 'Interesada en herramientas eléctricas' },
    { name: 'Carlos Ruiz', phone: '+57 310 678 9012', email: 'carlos.ruiz@email.com', address: 'Avenida 19 #80-50, Bogotá', taxId: '9988776655', tags: 'Particular', notes: 'Cliente VIP' },
    { name: 'Inmobiliaria XYZ Ltda.', phone: '+57 1 234 5678', email: 'contacto@inmobiliariaxyz.com', address: 'Calle 93 #11-20, Bogotá', taxId: '800987654-1', tags: 'Empresa,Inmobiliaria', notes: 'Grandes volúmenes, descuentos especiales' },
    { name: 'Laura Sánchez', phone: '+57 320 789 0123', email: 'laura.sanchez@email.com', address: 'Carrera 50 #40-30, Medellín', taxId: '4433221100', tags: 'Particular', notes: 'Compra materiales de construcción' },
    { name: 'Roberto Torres', phone: '+57 315 890 1234', email: 'roberto.torres@email.com', address: 'Avenida 6N #28-15, Cali', taxId: '6677889900', tags: 'Particular', notes: 'Cliente regular' },
    { name: 'Diseños y Construcciones S.A.', phone: '+57 1 345 6789', email: 'ventas@disenyosconstrucciones.com', address: 'Calle 127 #7-30, Bogotá', taxId: '900456789-1', tags: 'Empresa,Construcción', notes: 'Proyectos grandes, facturación mensual' },
  ]

  const createdCustomers = []
  for (const customer of customersData) {
    const created = await prisma.customer.create({
      data: {
        ...customer,
        createdById: adminUser.id,
      },
    })
    createdCustomers.push(created)
  }

  // Crear proveedores demo
  console.log('🏭 Creando proveedores demo...')
  const suppliersData = [
    { name: 'Distribuidora Mayorista S.A.', phone: '+57 1 500 1111', email: 'ventas@mayorista.com', address: 'Zona Industrial, Bodega 12', taxId: '900111222-1', notes: 'Proveedor principal, mejores precios' },
    { name: 'Ferretería Industrial Ltda.', phone: '+57 1 500 2222', email: 'compras@ferreteriaindustrial.com', address: 'Polígono Industrial Norte', taxId: '800222333-1', notes: 'Especialista en herramientas' },
    { name: 'Materiales de Construcción Pro', phone: '+57 1 500 3333', email: 'pedidos@materialespro.com', address: 'Autopista Norte Km 15', taxId: '900333444-1', notes: 'Materiales de construcción' },
    { name: 'Eléctricos y Plomería S.A.S.', phone: '+57 1 500 4444', email: 'ventas@electricosplomeria.com', address: 'Calle 80 #12-45', taxId: '900444555-1', notes: 'Materiales eléctricos y plomería' },
  ]

  const createdSuppliers = []
  for (const supplier of suppliersData) {
    const created = await prisma.supplier.create({
      data: {
        ...supplier,
        createdById: adminUser.id,
      },
    })
    createdSuppliers.push(created)
  }

  // Crear leads (oportunidades) demo
  console.log('🎯 Creando leads demo...')
  const leadsData = [
    { name: 'Proyecto Residencial Los Rosales', company: 'Constructora ABC S.A.S.', phone: '+57 300 123 4567', email: 'compras@constructoraabc.com', stage: 'CONTACTED', value: 500000, expectedRevenue: 500000, probability: 60, expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), source: 'Referido', notes: 'Proyecto de 50 viviendas, necesita materiales de construcción', customerId: createdCustomers[0].id },
    { name: 'Remodelación Oficinas', company: 'Inmobiliaria XYZ Ltda.', phone: '+57 1 234 5678', email: 'contacto@inmobiliariaxyz.com', stage: 'QUOTED', value: 250000, expectedRevenue: 200000, probability: 75, expectedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), source: 'Web', notes: 'Necesita pinturas y materiales', customerId: createdCustomers[6].id },
    { name: 'Instalación Eléctrica Casa', company: null, phone: '+57 320 345 6789', email: 'maria.garcia@email.com', stage: 'NEW', value: 80000, expectedRevenue: 80000, probability: 40, expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), source: 'Walk-in', notes: 'Cliente particular, necesita cableado', customerId: createdCustomers[2].id },
    { name: 'Proyecto Comercial Centro', company: 'Diseños y Construcciones S.A.', phone: '+57 1 345 6789', email: 'ventas@disenyosconstrucciones.com', stage: 'QUOTED', value: 1200000, expectedRevenue: 960000, probability: 80, expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), source: 'Email', notes: 'Gran proyecto, negociando descuentos', customerId: createdCustomers[9].id },
    { name: 'Reparación Plomería', company: null, phone: '+57 310 234 5678', email: 'juan.perez@email.com', stage: 'WON', value: 45000, expectedRevenue: 45000, probability: 100, expectedCloseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), source: 'Teléfono', notes: 'Cliente ganado, convertir a factura', customerId: createdCustomers[1].id },
    { name: 'Construcción Edificio Oficinas', company: 'Constructora ABC S.A.S.', phone: '+57 300 123 4567', email: 'compras@constructoraabc.com', stage: 'CONTACTED', value: 2000000, expectedRevenue: 1600000, probability: 50, expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), source: 'Referido', notes: 'Proyecto grande, requiere seguimiento constante', customerId: createdCustomers[0].id },
    { name: 'Ampliación Local Comercial', company: null, phone: '+57 315 456 7890', email: 'pedro.lopez@email.com', stage: 'NEW', value: 150000, expectedRevenue: 150000, probability: 30, expectedCloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), source: 'Walk-in', notes: 'Cliente nuevo, necesita asesoría', customerId: createdCustomers[3].id },
    { name: 'Proyecto Residencial El Prado', company: 'Inmobiliaria XYZ Ltda.', phone: '+57 1 234 5678', email: 'contacto@inmobiliariaxyz.com', stage: 'QUOTED', value: 800000, expectedRevenue: 720000, probability: 70, expectedCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), source: 'Web', notes: 'Esperando respuesta del cliente', customerId: createdCustomers[6].id },
    { name: 'Mantenimiento Preventivo', company: 'Diseños y Construcciones S.A.', phone: '+57 1 345 6789', email: 'ventas@disenyosconstrucciones.com', stage: 'CONTACTED', value: 120000, expectedRevenue: 120000, probability: 65, expectedCloseDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), source: 'Email', notes: 'Servicio recurrente', customerId: createdCustomers[9].id },
    { name: 'Proyecto Fallido - Competencia', company: null, phone: '+57 320 789 0123', email: 'laura.sanchez@email.com', stage: 'LOST', value: 300000, expectedRevenue: 0, probability: 0, expectedCloseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), source: 'Web', notes: 'Cliente eligió otra opción', customerId: createdCustomers[7].id },
  ]

  const createdLeads = []
  for (const lead of leadsData) {
    const created = await prisma.lead.create({
      data: {
        ...lead,
        assignedToId: adminUser.id,
        createdById: adminUser.id,
      },
    })
    createdLeads.push(created)

    // Crear historial de etapas para algunos leads (simular progreso)
    if (lead.stage === 'CONTACTED') {
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          changedById: adminUser.id,
          notes: 'Cliente contactado exitosamente',
        },
      })
    } else if (lead.stage === 'QUOTED') {
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          changedById: adminUser.id,
          notes: 'Cliente contactado',
        },
      })
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'CONTACTED',
          toStage: 'QUOTED',
          changedById: adminUser.id,
          notes: 'Cotización enviada',
        },
      })
    } else if (lead.stage === 'WON') {
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          changedById: adminUser.id,
          notes: 'Cliente contactado',
        },
      })
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'CONTACTED',
          toStage: 'QUOTED',
          changedById: adminUser.id,
          notes: 'Cotización enviada',
        },
      })
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'QUOTED',
          toStage: 'WON',
          changedById: adminUser.id,
          notes: 'Oportunidad ganada',
        },
      })
    } else if (lead.stage === 'LOST') {
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          changedById: adminUser.id,
          notes: 'Cliente contactado',
        },
      })
      await prisma.leadStageHistory.create({
        data: {
          leadId: created.id,
          fromStage: 'CONTACTED',
          toStage: 'LOST',
          changedById: adminUser.id,
          notes: 'Cliente eligió otra opción',
        },
      })
    }
  }

  // Crear actividades demo
  console.log('📅 Creando actividades demo...')
  const activitiesData = [
    { type: 'CALL', subject: 'Llamada de seguimiento - Proyecto Los Rosales', description: 'Seguimiento de cotización enviada', dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), leadId: createdLeads[0].id },
    { type: 'MEETING', subject: 'Reunión - Remodelación Oficinas', description: 'Presentación de propuesta', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), leadId: createdLeads[1].id },
    { type: 'EMAIL', subject: 'Envío de cotización - Proyecto Comercial Centro', description: 'Enviar cotización detallada', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), leadId: createdLeads[3].id },
    { type: 'TASK', subject: 'Visita técnica - Instalación Eléctrica', description: 'Evaluar necesidades del proyecto', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), leadId: createdLeads[2].id },
    { type: 'CALL', subject: 'Seguimiento - Construcción Edificio', description: 'Llamar para confirmar interés', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), leadId: createdLeads[5].id },
    { type: 'MEETING', subject: 'Reunión inicial - Ampliación Local', description: 'Primera reunión con cliente', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), leadId: createdLeads[6].id },
    { type: 'EMAIL', subject: 'Envío de cotización - Proyecto El Prado', description: 'Enviar cotización actualizada', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), leadId: createdLeads[7].id },
  ]

  for (const activity of activitiesData) {
    await prisma.activity.create({
      data: {
        ...activity,
        createdById: adminUser.id,
      },
    })
  }

  // Crear cotizaciones demo
  console.log('📄 Creando cotizaciones demo...')
  const quotations = []
  for (let i = 0; i < 5; i++) {
    const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)]
    const lead = i < createdLeads.length ? createdLeads[i] : null
    const statuses = ['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    const quotation = await prisma.quotation.create({
      data: {
        number: `COT-${String(1000 + i).padStart(4, '0')}`,
        customerId: customer.id,
        leadId: lead?.id,
        status,
        validUntil,
        notes: `Cotización demo ${i + 1}`,
        createdById: adminUser.id,
      },
    })

    // Agregar items a la cotización
    const numItems = Math.floor(Math.random() * 5) + 2 // 2-6 items
    let subtotal = 0
    for (let j = 0; j < numItems; j++) {
      const product = createdProducts[Math.floor(Math.random() * createdProducts.length)]
      const quantity = Math.floor(Math.random() * 10) + 1
      const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 15) : 0
      const unitPrice = product.price * (1 - discount / 100)
      const itemSubtotal = quantity * unitPrice
      const tax = itemSubtotal * (product.taxRate / 100)

      await prisma.quotationItem.create({
        data: {
          quotationId: quotation.id,
          productId: product.id,
          quantity,
          unitPrice: product.price,
          discount,
          taxRate: product.taxRate,
          subtotal: itemSubtotal + tax,
        },
      })

      subtotal += itemSubtotal
    }

    const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.1) : 0
    const finalSubtotal = subtotal - discount
    const tax = finalSubtotal * 0.19
    const total = finalSubtotal + tax

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        subtotal: finalSubtotal,
        discount,
        tax,
        total,
      },
    })

    quotations.push(quotation)
  }

  // Crear órdenes de compra demo
  console.log('🛒 Creando órdenes de compra demo...')
  const purchaseOrders = []
  for (let i = 0; i < 4; i++) {
    const supplier = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)]
    const statuses = ['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    const expectedDate = new Date()
    expectedDate.setDate(expectedDate.getDate() + 7)

    const order = await prisma.purchaseOrder.create({
      data: {
        number: `OC-${String(100 + i).padStart(4, '0')}`,
        supplierId: supplier.id,
        status,
        expectedDate,
        notes: `Orden de compra demo ${i + 1}`,
        createdById: adminUser.id,
      },
    })

    // Agregar items
    const numItems = Math.floor(Math.random() * 6) + 3
    let subtotal = 0
    for (let j = 0; j < numItems; j++) {
      const product = createdProducts[Math.floor(Math.random() * createdProducts.length)]
      const quantity = Math.floor(Math.random() * 50) + 10
      const unitCost = product.cost * 0.9 // Descuento de proveedor
      const itemSubtotal = quantity * unitCost
      const tax = itemSubtotal * (product.taxRate / 100)

      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: order.id,
          productId: product.id,
          quantity,
          unitCost,
          taxRate: product.taxRate,
          subtotal: itemSubtotal + tax,
        },
      })

      subtotal += itemSubtotal
    }

    const discount = Math.floor(subtotal * 0.05) // 5% descuento
    const finalSubtotal = subtotal - discount
    const tax = finalSubtotal * 0.19
    const total = finalSubtotal + tax

    await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        subtotal: finalSubtotal,
        discount,
        tax,
        total,
      },
    })

    purchaseOrders.push(order)
  }

  // Crear recepciones de mercancía demo
  console.log('📦 Creando recepciones demo...')
  for (let i = 0; i < 2; i++) {
    const order = purchaseOrders[i]
    if (order.status === 'CONFIRMED' || order.status === 'SENT') {
      const receipt = await prisma.goodsReceipt.create({
        data: {
          number: `REC-${String(100 + i).padStart(4, '0')}`,
          purchaseOrderId: order.id,
          warehouseId: warehouse1.id,
          receivedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          notes: `Recepción de orden ${order.number}`,
          createdById: adminUser.id,
        },
      })

      // Copiar items de la orden
      const orderItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
      })

      for (const item of orderItems) {
        await prisma.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          },
        })

        // Actualizar stock
        const stockLevel = await prisma.stockLevel.findFirst({
          where: {
            warehouseId: warehouse1.id,
            productId: item.productId,
          },
        })

        if (stockLevel) {
          await prisma.stockLevel.update({
            where: { id: stockLevel.id },
            data: {
              quantity: stockLevel.quantity + item.quantity,
            },
          })
        }

        // Crear movimiento de stock
        await prisma.stockMovement.create({
          data: {
            warehouseId: warehouse1.id,
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            cost: item.unitCost,
            reason: `Recepción ${receipt.number}`,
            createdById: adminUser.id,
            reference: receipt.number,
          },
        })
      }

      // Actualizar estado de la orden
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED' },
      })
    }
  }

  // Crear facturas demo
  console.log('🧾 Creando facturas demo...')
  for (let i = 0; i < 8; i++) {
    const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)]
    const statuses = ['ISSUED', 'PAID', 'PARTIAL']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    const invoice = await prisma.invoice.create({
      data: {
        number: `FV-${String(1000 + i).padStart(4, '0')}`,
        prefix: 'FV',
        consecutive: String(1000 + i),
        customerId: customer.id,
        status,
        issuedAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + (30 - i * 2) * 24 * 60 * 60 * 1000),
        notes: `Factura demo ${i + 1}`,
        createdById: adminUser.id,
      },
    })

    // Agregar items
    const numItems = Math.floor(Math.random() * 5) + 2
    let subtotal = 0
    for (let j = 0; j < numItems; j++) {
      const product = createdProducts[Math.floor(Math.random() * createdProducts.length)]
      const quantity = Math.floor(Math.random() * 20) + 1
      const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0
      const unitPrice = product.price * (1 - discount / 100)
      const itemSubtotal = quantity * unitPrice
      const tax = itemSubtotal * (product.taxRate / 100)

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productId: product.id,
          quantity,
          unitPrice: product.price,
          discount,
          taxRate: product.taxRate,
          subtotal: itemSubtotal + tax,
        },
      })

      subtotal += itemSubtotal

      // Actualizar stock (venta)
      const stockLevel = await prisma.stockLevel.findFirst({
        where: {
          warehouseId: warehouse1.id,
          productId: product.id,
        },
      })

      if (stockLevel && stockLevel.quantity >= quantity) {
        await prisma.stockLevel.update({
          where: { id: stockLevel.id },
          data: {
            quantity: stockLevel.quantity - quantity,
          },
        })

        await prisma.stockMovement.create({
          data: {
            warehouseId: warehouse1.id,
            productId: product.id,
            type: 'OUT',
            quantity: quantity,
            cost: product.cost,
            reason: `Venta ${invoice.number}`,
            createdById: adminUser.id,
            reference: invoice.number,
          },
        })
      }
    }

    const discount = Math.floor(subtotal * 0.05)
    const finalSubtotal = subtotal - discount
    const tax = finalSubtotal * 0.19
    const total = finalSubtotal + tax

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: finalSubtotal,
        discount,
        tax,
        total,
      },
    })

    // Crear pagos si está pagada
    if (status === 'PAID') {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: total,
          method: Math.random() > 0.5 ? 'CASH' : 'CARD',
          reference: `PAGO-${invoice.number}`,
          notes: 'Pago demo',
          createdById: adminUser.id,
        },
      })

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paidAt: new Date() },
      })
    } else if (status === 'PARTIAL') {
      const partialAmount = total * 0.5
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: partialAmount,
          method: 'CASH',
          reference: `PAGO-PARCIAL-${invoice.number}`,
          notes: 'Pago parcial demo',
          createdById: adminUser.id,
        },
      })
    }
  }

  // Crear turno de caja demo
  console.log('💰 Creando turno de caja demo...')
  const cashShift = await prisma.cashShift.create({
    data: {
      userId: adminUser.id,
      openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // Hace 8 horas
      startingCash: 500000,
      expectedCash: 750000,
      status: 'OPEN',
    },
  })

  // Crear algunos movimientos de caja
  await prisma.cashMovement.create({
    data: {
      cashShiftId: cashShift.id,
      type: 'IN',
      amount: 150000,
      reason: 'Venta en efectivo',
      createdById: adminUser.id,
    },
  })

  await prisma.cashMovement.create({
    data: {
      cashShiftId: cashShift.id,
      type: 'OUT',
      amount: 50000,
      reason: 'Gastos operativos',
      createdById: adminUser.id,
    },
  })

  // Crear acciones recientes para el historial
  console.log('📋 Creando acciones recientes para el historial...')
  
  // Ajustes manuales de inventario (aparecen en el historial)
  const recentProducts = createdProducts.slice(0, 5)
  for (let i = 0; i < recentProducts.length; i++) {
    const product = recentProducts[i]
    const hoursAgo = i + 1 // Hace 1, 2, 3, 4, 5 horas
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    
    await prisma.stockMovement.create({
      data: {
        warehouseId: warehouse1.id,
        productId: product.id,
        type: i % 2 === 0 ? 'IN' : 'OUT',
        quantity: Math.floor(Math.random() * 20) + 5,
        cost: product.cost,
        reason: 'Ajuste manual de inventario',
        createdById: adminUser.id,
        reference: `ADJ-${Date.now()}-${i}`,
        createdAt,
      },
    })
  }

  // Más movimientos de caja recientes
  const cashMovementReasons = [
    'Venta adicional en efectivo',
    'Retiro para compra de suministros',
    'Ingreso por venta mayorista',
    'Pago de servicios',
    'Depósito de ventas del día',
  ]

  for (let i = 0; i < cashMovementReasons.length; i++) {
    const hoursAgo = i + 2
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    
    await prisma.cashMovement.create({
      data: {
        cashShiftId: cashShift.id,
        type: i % 3 === 0 ? 'OUT' : 'IN',
        amount: Math.floor(Math.random() * 200000) + 50000,
        reason: cashMovementReasons[i],
        createdById: adminUser.id,
        createdAt,
      },
    })
  }

  // Más pagos recientes
  const recentInvoices = await prisma.invoice.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
  })

  for (let i = 0; i < recentInvoices.length; i++) {
    const invoice = recentInvoices[i]
    const hoursAgo = i + 1
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.total,
        method: i === 0 ? 'CASH' : i === 1 ? 'CARD' : 'TRANSFER',
        reference: `PAGO-RECIENTE-${invoice.number}`,
        notes: 'Pago reciente demo',
        createdById: adminUser.id,
        createdAt,
      },
    })
  }

  console.log('✅ Seed de datos demo completado exitosamente!')
  console.log('\n📊 Resumen de datos creados:')
  console.log(`   - Productos: ${createdProducts.length}`)
  console.log(`   - Clientes: ${createdCustomers.length}`)
  console.log(`   - Proveedores: ${createdSuppliers.length}`)
  console.log(`   - Oportunidades (Leads): ${createdLeads.length}`)
  console.log(`   - Actividades: ${activitiesData.length}`)
  console.log(`   - Cotizaciones: ${quotations.length}`)
  console.log(`   - Órdenes de compra: ${purchaseOrders.length}`)
  console.log(`   - Facturas: 8`)
  console.log(`   - Turno de caja: 1 (abierto)`)
  console.log(`   - Ajustes de inventario: 5`)
  console.log(`   - Movimientos de caja adicionales: 5`)
  console.log(`   - Pagos recientes: 3`)
  console.log('\n🎯 Oportunidades creadas por etapa:')
  const stagesCount = createdLeads.reduce((acc, lead) => {
    acc[lead.stage] = (acc[lead.stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  Object.entries(stagesCount).forEach(([stage, count]) => {
    const stageLabels: Record<string, string> = {
      NEW: 'Nueva',
      CONTACTED: 'Contactado',
      QUOTED: 'Cotizado',
      WON: 'Ganada',
      LOST: 'Perdida',
    }
    console.log(`   - ${stageLabels[stage] || stage}: ${count}`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

