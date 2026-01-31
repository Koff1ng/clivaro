import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db.js'
import { loadEnvConfig } from '@next/env'

// Load environment variables
loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

async function main() {
    console.log('🎯 Starting CRM & Demo Data Seed...')

    // 1. Get the first tenant
    const tenant = await prisma.tenant.findFirst({
        where: { active: true },
        select: { id: true, name: true, slug: true, databaseUrl: true }
    })

    if (!tenant || !tenant.databaseUrl) {
        console.error('❌ No active tenant found to seed.')
        process.exit(1)
    }

    console.log(`📍 Targeting Tenant: ${tenant.name} (${tenant.slug})`)

    // 2. Get Tenant Client
    const tenantPrisma = getTenantPrisma(tenant.databaseUrl) as any

    // 3. Get existing data for seeding
    const customers = await tenantPrisma.customer.findMany({ take: 10 })
    const products = await tenantPrisma.product.findMany({ where: { active: true }, take: 20 })
    const users = await tenantPrisma.user.findMany({ take: 3 })

    if (customers.length === 0 || products.length === 0 || users.length === 0) {
        console.warn('⚠️ Need existing customers, products, and users. Run restaurant seed first.')
        return
    }

    console.log(`✅ Found ${customers.length} customers, ${products.length} products, ${users.length} users`)

    // 4. Create Campaigns
    console.log('📊 Creating Marketing Campaigns...')
    const campaigns = []

    const campaignData = [
        {
            name: 'Promoción de Verano 2024',
            type: 'EMAIL',
            status: 'COMPLETED',
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-08-31'),
            budget: 5000000,
            spent: 4200000,
            description: 'Campaña de email marketing para promocionar productos de temporada'
        },
        {
            name: 'Lanzamiento Menú Especial',
            type: 'SOCIAL_MEDIA',
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: null,
            budget: 3000000,
            spent: 800000,
            description: 'Campaña en redes sociales para nuevo menú'
        },
        {
            name: 'Programa de Lealtad',
            type: 'EVENT',
            status: 'ACTIVE',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            budget: 10000000,
            spent: 3500000,
            description: 'Programa anual de fidelización de clientes'
        },
        {
            name: 'Black Friday 2024',
            type: 'EMAIL',
            status: 'DRAFT',
            startDate: null,
            endDate: null,
            budget: 8000000,
            spent: 0,
            description: 'Campaña especial para Black Friday con descuentos masivos'
        },
        {
            name: 'Desayunos Corporativos',
            type: 'EVENT',
            status: 'PAUSED',
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-05-31'),
            budget: 2500000,
            spent: 1200000,
            description: 'Campaña de ventas a empresas para servicio de desayunos'
        }
    ]

    for (const c of campaignData) {
        const campaign = await tenantPrisma.campaign.create({
            data: {
                ...c,
                createdById: users[0].id
            }
        })
        campaigns.push(campaign)
    }

    console.log(`   ✅ Created ${campaigns.length} campaigns`)

    // 5. Create Opportunities
    console.log('💼 Creating Sales Opportunities...')
    const opportunities = []

    const stages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']
    const opportunityData = [
        { title: 'Contrato Catering Empresa XYZ', value: 15000000, stage: 'NEGOTIATION', probability: 70, customerId: customers[0].id, campaignId: campaigns[4].id },
        { title: 'Evento Matrimonio 200 personas', value: 25000000, stage: 'PROPOSAL', probability: 60, customerId: customers[1].id, campaignId: campaigns[1].id },
        { title: 'Servicio Mensual Desayunos', value: 8000000, stage: 'QUALIFIED', probability: 40, customerId: customers[2].id, campaignId: campaigns[2].id },
        { title: 'Fiesta Corporativa Fin de Año', value: 18000000, stage: 'LEAD', probability: 20, customerId: customers[0].id, campaignId: null },
        { title: 'Contrato Almuerzos Semanales', value: 12000000, stage: 'CLOSED_WON', probability: 100, customerId: customers[0].id, campaignId: campaigns[4].id },
        { title: 'Evento Cumpleaños Premium', value: 5000000, stage: 'PROPOSAL', probability: 50, customerId: customers[3 % customers.length].id, campaignId: campaigns[1].id },
        { title: 'Servicio Cafetería Oficina', value: 6000000, stage: 'QUALIFIED', probability: 45, customerId: customers[4 % customers.length].id, campaignId: campaigns[2].id },
        { title: 'Banquete Graduación', value: 9000000, stage: 'NEGOTIATION', probability: 65, customerId: customers[1].id, campaignId: null },
        { title: 'Contrato Anual Eventos', value: 45000000, stage: 'PROPOSAL', probability: 55, customerId: customers[0].id, campaignId: campaigns[2].id },
        { title: 'Picadas Empresariales', value: 3500000, stage: 'CLOSED_LOST', probability: 0, customerId: customers[5 % customers.length].id, campaignId: campaigns[0].id },
        { title: 'Brunch Dominical Mensual', value: 4200000, stage: 'LEAD', probability: 25, customerId: customers[2].id, campaignId: campaigns[1].id },
        { title: 'Inauguración Local Comercial', value: 7800000, stage: 'QUALIFIED', probability: 50, customerId: customers[6 % customers.length].id, campaignId: null },
        { title: 'Lanzamiento Producto Cliente', value: 11000000, stage: 'NEGOTIATION', probability: 75, customerId: customers[3 % customers.length].id, campaignId: campaigns[1].id },
        { title: 'Conferencia 3 Días - Coffee Breaks', value: 5500000, stage: 'PROPOSAL', probability: 60, customerId: customers[7 % customers.length].id, campaignId: null },
        { title: 'Festival Gastronómico Stand', value: 8500000, stage: 'CLOSED_WON', probability: 100, customerId: customers[1].id, campaignId: campaigns[0].id },
    ]

    for (let i = 0; i < opportunityData.length; i++) {
        const opp = opportunityData[i]
        const daysOffset = Math.floor(Math.random() * 90) - 45 // -45 to +45 days
        const expectedCloseDate = new Date()
        expectedCloseDate.setDate(expectedCloseDate.getDate() + daysOffset)

        const opportunity = await tenantPrisma.opportunity.create({
            data: {
                ...opp,
                expectedCloseDate: opp.stage !== 'CLOSED_WON' && opp.stage !== 'CLOSED_LOST' ? expectedCloseDate : null,
                closedDate: opp.stage === 'CLOSED_WON' || opp.stage === 'CLOSED_LOST' ? new Date() : null,
                notes: `Oportunidad generada desde campaña. Seguimiento ${i + 1}.`,
                createdById: users[i % users.length].id,
                assignedToId: users[(i + 1) % users.length].id
            }
        })
        opportunities.push(opportunity)
    }

    console.log(`   ✅ Created ${opportunities.length} opportunities`)

    // 6. Create Quotes
    console.log('📄 Creating Sales Quotes...')
    const quotes = []

    // Create quotes for some opportunities
    const quoteOpportunities = opportunities.filter(o =>
        ['PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'].includes(o.stage)
    ).slice(0, 12)

    for (let i = 0; i < quoteOpportunities.length; i++) {
        const opp = quoteOpportunities[i]
        const numItems = Math.floor(Math.random() * 3) + 2 // 2-4 items
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
        else if (i % 4 === 0) status = 'REJECTED'

        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 30)

        const quote = await tenantPrisma.quote.create({
            data: {
                quoteNumber: `COT-${String(i + 1).padStart(6, '0')}`,
                customerId: opp.customerId,
                opportunityId: opp.id,
                status,
                validUntil: status !== 'ACCEPTED' && status !== 'REJECTED' ? validUntil : null,
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

    console.log(`   ✅ Created ${quotes.length} quotes`)

    // 7. Create Additional Invoices
    console.log('🧾 Creating Additional Invoices...')
    let invoiceCount = 0

    for (let i = 0; i < 25; i++) {
        const customer = customers[i % customers.length]
        const daysAgo = Math.floor(Math.random() * 90) // Last 90 days
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

        const statuses = ['EMITIDA', 'PAGADA', 'PAGADA', 'PAGADA'] // More paid invoices
        const status = statuses[Math.floor(Math.random() * statuses.length)]

        try {
            const invoiceCountTotal = await tenantPrisma.invoice.count()
            await tenantPrisma.invoice.create({
                data: {
                    invoiceNumber: `F${String(invoiceCountTotal + 1).padStart(6, '0')}`,
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
                    payments: status === 'PAGADA' ? {
                        create: [{
                            amount: total,
                            method: ['CASH', 'CARD', 'TRANSFER'][Math.floor(Math.random() * 3)],
                            createdById: users[i % users.length].id
                        }]
                    } : undefined
                }
            })
            invoiceCount++
        } catch (error) {
            console.warn(`   ⚠️ Could not create invoice ${i + 1}: ${error}`)
        }
    }

    console.log(`   ✅ Created ${invoiceCount} invoices`)

    console.log('✅ CRM & Demo Data Seed Completed!')
    console.log(`\n📊 Summary:`)
    console.log(`   - ${campaigns.length} campaigns`)
    console.log(`   - ${opportunities.length} opportunities`)
    console.log(`   - ${quotes.length} quotes`)
    console.log(`   - ${invoiceCount} additional invoices`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
