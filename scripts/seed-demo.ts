// Seed con Datos Demo Completos: CRM + Facturas
// Ejecutar con: npx tsx scripts/seed-demo.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🎯 Iniciando Seed de Datos Demo Completos...')

    // 1. Obtener tenant activo
    const tenant = await prisma.tenant.findFirst({
        where: { active: true },
    })

    if (!tenant || !tenant.databaseUrl) {
        console.error('❌ No se encontró tenant activo')
        process.exit(1)
    }

    console.log(`📍 Tenant: ${tenant.name}`)

    // 2. Conectar a la base de datos del tenant directamente
    const tenantPrisma = new PrismaClient({
        datasources: {
            db: {
                url: tenant.databaseUrl
            }
        }
    })

    try {
        // 3. Obtener datos existentes
        const customers = await tenantPrisma.customer.findMany({ take: 10 })
        const products = await tenantPrisma.product.findMany({ where: { active: true }, take: 20 })
        const users = await tenantPrisma.user.findMany({ take: 5 })

        if (customers.length === 0 || products.length === 0 || users.length === 0) {
            console.warn('⚠️ Necesitas clientes, productos y usuarios. Ejecuta seed-restaurant primero.')
            return
        }

        console.log(`✅ Encontrados: ${customers.length} clientes, ${products.length} productos, ${users.length} usuarios`)

        // 4. CREAR CAMPAÑAS
        console.log('\n📊 Creando Campañas...')
        const campaigns = await Promise.all([
            tenantPrisma.campaign.create({
                data: {
                    name: 'Promoción de Verano 2024',
                    type: 'EMAIL',
                    status: 'COMPLETED',
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                    budget: 5000000,
                    spent: 4200000,
                    description: 'Campaña de email marketing para promocionar productos de temporada',
                    createdById: users[0].id
                }
            }),
            tenantPrisma.campaign.create({
                data: {
                    name: 'Lanzamiento Menú Especial',
                    type: 'SOCIAL_MEDIA',
                    status: 'ACTIVE',
                    startDate: new Date(),
                    budget: 3000000,
                    spent: 800000,
                    description: 'Campaña en redes sociales para nuevo menú',
                    createdById: users[0].id
                }
            }),
            tenantPrisma.campaign.create({
                data: {
                    name: 'Programa de Lealtad',
                    type: 'EVENT',
                    status: 'ACTIVE',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                    budget: 10000000,
                    spent: 3500000,
                    description: 'Programa anual de fidelización de clientes',
                    createdById: users[0].id
                }
            }),
            tenantPrisma.campaign.create({
                data: {
                    name: 'Black Friday 2024',
                    type: 'EMAIL',
                    status: 'DRAFT',
                    budget: 8000000,
                    spent: 0,
                    description: 'Campaña especial para Black Friday',
                    createdById: users[0].id
                }
            }),
            tenantPrisma.campaign.create({
                data: {
                    name: 'Desayunos Corporativos',
                    type: 'EVENT',
                    status: 'PAUSED',
                    startDate: new Date('2024-03-01'),
                    endDate: new Date('2024-05-31'),
                    budget: 2500000,
                    spent: 1200000,
                    description: 'Campaña de ventas a empresas',
                    createdById: users[0].id
                }
            })
        ])
        console.log(`   ✅ ${campaigns.length} campañas creadas`)

        // 5. CREAR OPORTUNIDADES
        console.log('\n💼 Creando Oportunidades...')

        const opportunityData = [
            { title: 'Contrato Catering Empresa XYZ', value: 15000000, stage: 'NEGOTIATION', probability: 70, campaignId: campaigns[4].id, days: 30 },
            { title: 'Evento Matrimonio 200 personas', value: 25000000, stage: 'PROPOSAL', probability: 60, campaignId: campaigns[1].id, days: 45 },
            { title: 'Servicio Mensual Desayunos', value: 8000000, stage: 'QUALIFIED', probability: 40, campaignId: campaigns[2].id, days: 20 },
            { title: 'Fiesta Corporativa Fin de Año', value: 18000000, stage: 'LEAD', probability: 20, campaignId: null, days: 60 },
            { title: 'Contrato Almuerzos Semanales', value: 12000000, stage: 'CLOSED_WON', probability: 100, campaignId: campaigns[4].id, days: 0 },
            { title: 'Evento Cumpleaños Premium', value: 5000000, stage: 'PROPOSAL', probability: 50, campaignId: campaigns[1].id, days: 25 },
            { title: 'Servicio Cafetería Oficina', value: 6000000, stage: 'QUALIFIED', probability: 45, campaignId: campaigns[2].id, days: 35 },
            { title: 'Banquete Graduación', value: 9000000, stage: 'NEGOTIATION', probability: 65, campaignId: null, days: 40 },
            { title: 'Contrato Anual Eventos', value: 45000000, stage: 'PROPOSAL', probability: 55, campaignId: campaigns[2].id, days: 50 },
            { title: 'Picadas Empresariales', value: 3500000, stage: 'CLOSED_LOST', probability: 0, campaignId: campaigns[0].id, days: 0 },
        ]

        const opportunities = []
        for (let i = 0; i < opportunityData.length; i++) {
            const opp = opportunityData[i]
            const expectedDate = new Date()
            expectedDate.setDate(expectedDate.getDate() + opp.days)

            const opportunity = await tenantPrisma.opportunity.create({
                data: {
                    customerId: customers[i % customers.length].id,
                    campaignId: opp.campaignId,
                    title: opp.title,
                    value: opp.value,
                    stage: opp.stage,
                    probability: opp.probability,
                    expectedCloseDate: opp.stage !== 'CLOSED_WON' && opp.stage !== 'CLOSED_LOST' ? expectedDate : null,
                    closedDate: opp.stage === 'CLOSED_WON' || opp.stage === 'CLOSED_LOST' ? new Date() : null,
                    notes: `Oportunidad ${i + 1} - seguimiento activo`,
                    createdById: users[i % users.length].id,
                    assignedToId: users[(i + 1) % users.length].id
                }
            })
            opportunities.push(opportunity)
        }
        console.log(`   ✅ ${opportunities.length} oportunidades creadas`)

        // 6. CREAR COTIZACIONES
        console.log('\n📄 Creando Cotizaciones...')

        const proposalOpps = opportunities.filter(o => ['PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'].includes(o.stage)).slice(0, 5)
        const quotes = []

        for (let i = 0; i < proposalOpps.length; i++) {
            const opp = proposalOpps[i]
            const numItems = Math.floor(Math.random() * 3) + 2
            const selectedProducts = []
            for (let j = 0; j < numItems; j++) {
                selectedProducts.push(products[Math.floor(Math.random() * products.length)])
            }

            let subtotal = 0
            const items = selectedProducts.map(p => {
                const quantity = Math.floor(Math.random() * 10) + 1
                const unitPrice = p.price
                const itemSubtotal = quantity * unitPrice
                subtotal += itemSubtotal
                return {
                    productId: p.id,
                    description: p.name,
                    quantity,
                    unitPrice,
                    discount: 0,
                    taxRate: 19,
                    subtotal: itemSubtotal
                }
            })

            const tax = subtotal * 0.19
            const total = subtotal + tax

            let status = 'DRAFT'
            if (opp.stage === 'CLOSED_WON') status = 'ACCEPTED'
            else if (opp.stage === 'NEGOTIATION') status = 'SENT'

            const validUntil = new Date()
            validUntil.setDate(validUntil.getDate() + 30)

            const quoteCount = await tenantPrisma.quote.count()
            const quote = await tenantPrisma.quote.create({
                data: {
                    quoteNumber: `COT-${String(quoteCount + 1).padStart(6, '0')}`,
                    customerId: opp.customerId,
                    opportunityId: opp.id,
                    status,
                    validUntil: status !== 'ACCEPTED' ? validUntil : null,
                    subtotal,
                    discount: 0,
                    tax,
                    total,
                    notes: `Cotización para ${opp.title}`,
                    createdById: users[i % users.length].id,
                    items: {
                        create: items
                    }
                }
            })
            quotes.push(quote)
        }
        console.log(`   ✅ ${quotes.length} cotizaciones creadas`)

        // 7. CREAR FACTURAS ADICIONALES
        console.log('\n🧾 Creando Facturas Adicionales...')

        const invoices = []
        for (let i = 0; i < 30; i++) {
            const customer = customers[i % customers.length]
            const daysAgo = Math.floor(Math.random() * 90)
            const invoiceDate = new Date()
            invoiceDate.setDate(invoiceDate.getDate() - daysAgo)

            const numItems = Math.floor(Math.random() * 4) + 1
            const selectedProducts = []
            for (let j = 0; j < numItems; j++) {
                selectedProducts.push(products[Math.floor(Math.random() * products.length)])
            }

            let subtotal = 0
            const items = selectedProducts.map(p => {
                const quantity = Math.floor(Math.random() * 5) + 1
                const unitPrice = p.price
                const itemSubtotal = quantity * unitPrice
                subtotal += itemSubtotal
                return {
                    productId: p.id,
                    quantity,
                    unitPrice,
                    discount: 0,
                    taxRate: 19,
                    subtotal: itemSubtotal
                }
            })

            const tax = subtotal * 0.19
            const total = subtotal + tax

            const statuses = ['EMITIDA', 'PAGADA', 'PAGADA', 'PAGADA']
            const status = statuses[Math.floor(Math.random() * statuses.length)]

            try {
                const invoiceCount = await tenantPrisma.invoice.count()
                const invoice = await tenantPrisma.invoice.create({
                    data: {
                        invoiceNumber: `F${String(invoiceCount + 1).padStart(6, '0')}`,
                        customerId: customer.id,
                        status,
                        subtotal,
                        discount: 0,
                        tax,
                        total,
                        issuedAt: invoiceDate,
                        dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                        paidAt: status === 'PAGADA' ? invoiceDate : null,
                        createdById: users[i % users.length].id,
                        items: {
                            create: items
                        },
                        ...(status === 'PAGADA' && {
                            payments: {
                                create: [{
                                    amount: total,
                                    method: ['CASH', 'CARD', 'TRANSFER'][Math.floor(Math.random() * 3)],
                                    createdById: users[i % users.length].id
                                }]
                            }
                        })
                    }
                })
                invoices.push(invoice)
            } catch (error: any) {
                console.warn(`   ⚠️ Error creando factura ${i + 1}: ${error.message}`)
            }
        }
        console.log(`   ✅ ${invoices.length} facturas creadas`)

        console.log('\n✅ Seed Demo Completado!')
        console.log(`\n📊 Resumen:`)
        console.log(`   - ${campaigns.length} campañas`)
        console.log(`   - ${opportunities.length} oportunidades`)
        console.log(`   - ${quotes.length} cotizaciones`)
        console.log(`   - ${invoices.length} facturas`)

    } finally {
        await tenantPrisma.$disconnect()
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
