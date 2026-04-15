/**
 * Seed: Oportunidades demo para Kanban — tenant "prueba"
 * Ejecutar: npx tsx scripts/seed-leads-prueba.ts
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL || ''

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrada en .env')
  process.exit(1)
}

function buildTenantUrl(schema: string): string {
  const urlObj = new URL(DATABASE_URL)
  urlObj.searchParams.set('schema', schema)
  return urlObj.toString()
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildTenantUrl('tenant_prueba') } },
})

// ─── DEMO LEADS ─────────────────────────────────────────
// Distributed across all 5 Kanban stages with realistic
// Colombian business scenarios for a hardware store (ferretería).

interface SeedLead {
  name: string
  company?: string
  email?: string
  phone?: string
  source?: string
  stage: 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST'
  value: number
  probability: number
  expectedCloseDate?: string // ISO date
  notes?: string
}

const leads: SeedLead[] = [
  // ═══ NEW — Leads recién ingresados ═══
  {
    name: 'Carlos Martínez',
    company: 'Constructora Andes SAS',
    email: 'carlos.martinez@andescons.co',
    phone: '3001234567',
    source: 'WHATSAPP',
    stage: 'NEW',
    value: 8_500_000,
    probability: 10,
    expectedCloseDate: '2026-05-15',
    notes: 'Preguntó por cemento Argos y varilla para obra en Rionegro. Necesita cotización de 200 bultos.',
  },
  {
    name: 'María Fernanda López',
    company: 'Acabados MFL',
    email: 'mflopez@acabadosmfl.com',
    phone: '3109876543',
    source: 'WEB',
    stage: 'NEW',
    value: 3_200_000,
    probability: 15,
    expectedCloseDate: '2026-05-20',
    notes: 'Llegó por búsqueda en Google. Interesada en pinturas Pintuco para proyecto residencial.',
  },
  {
    name: 'Andrés Gómez',
    phone: '3205551234',
    source: 'WALK_IN',
    stage: 'NEW',
    value: 950_000,
    probability: 20,
    notes: 'Entró a preguntar por herramientas DeWalt. Dejó número para que lo llamemos con disponibilidad.',
  },
  {
    name: 'Lucía Ramírez',
    company: 'Inmobiliaria del Valle',
    email: 'lucia@inmovalle.com',
    phone: '3157778899',
    source: 'REFERRAL',
    stage: 'NEW',
    value: 15_000_000,
    probability: 5,
    notes: 'Referida por Don Hernando. Necesita dotación eléctrica completa para 12 apartamentos.',
  },

  // ═══ CONTACTED — Ya se les hizo seguimiento ═══
  {
    name: 'Roberto Peña',
    company: 'Plomería Express',
    email: 'rpeña@plomeriaexpress.co',
    phone: '3184445566',
    source: 'PHONE',
    stage: 'CONTACTED',
    value: 2_800_000,
    probability: 35,
    expectedCloseDate: '2026-05-10',
    notes: 'Hablamos por teléfono. Necesita tubería Pavco para obra en Envigado. Pidió lista de precios.',
  },
  {
    name: 'Sandra Mejía',
    company: 'Conjuntos Residenciales SM',
    email: 'sandra.mejia@conjuntossm.com',
    phone: '3006667788',
    source: 'WHATSAPP',
    stage: 'CONTACTED',
    value: 6_500_000,
    probability: 40,
    expectedCloseDate: '2026-05-25',
    notes: 'Administradora de conjunto. Necesita cerraduras Yale y material eléctrico para remodelación de portería.',
  },
  {
    name: 'Diego Hernández',
    company: 'DH Construcciones',
    email: 'diego@dhconstrucciones.co',
    phone: '3112223344',
    source: 'WEB',
    stage: 'CONTACTED',
    value: 12_000_000,
    probability: 30,
    expectedCloseDate: '2026-06-01',
    notes: 'Enviamos catálogo por email. Requiere material de construcción para obra nueva en Sabaneta. Pendiente reunión presencial.',
  },

  // ═══ QUOTED — Ya tienen cotización formal ═══
  {
    name: 'Fernando Torres',
    company: 'Torres & Hijos Ltda',
    email: 'ftorres@torresehijos.co',
    phone: '3043339900',
    source: 'WALK_IN',
    stage: 'QUOTED',
    value: 4_750_000,
    probability: 60,
    expectedCloseDate: '2026-05-05',
    notes: 'Cotización COT-0048 enviada el 10/04. Incluye herramientas Stanley, cemento y arena. Dijo que la revisa esta semana.',
  },
  {
    name: 'Patricia Duque',
    company: 'Colegio Nuevo Horizonte',
    email: 'pduque@nuevohorizonte.edu.co',
    phone: '3178881122',
    source: 'REFERRAL',
    stage: 'QUOTED',
    value: 7_200_000,
    probability: 70,
    expectedCloseDate: '2026-05-12',
    notes: 'Cotización COT-0052 para mantenimiento del colegio: pinturas, eléctricos y plomería. Necesitan factura electrónica.',
  },
  {
    name: 'Jorge Cardona',
    company: 'Ferreagro JC',
    email: 'jcardona@ferreagrojc.com',
    phone: '3146665544',
    source: 'PHONE',
    stage: 'QUOTED',
    value: 18_500_000,
    probability: 55,
    expectedCloseDate: '2026-05-30',
    notes: 'Cotización COT-0055 de gran volumen. Quiere ser distribuidor de nuestras líneas Truper y Pavco. Negociando descuento por volumen.',
  },
  {
    name: 'Camila Restrepo',
    phone: '3229994455',
    source: 'WHATSAPP',
    stage: 'QUOTED',
    value: 1_350_000,
    probability: 75,
    expectedCloseDate: '2026-05-08',
    notes: 'Cotización enviada por WhatsApp. Remodelación de baño: tubería, grifería y cerámica. Muy interesada, va a confirmar mañana.',
  },

  // ═══ WON — Negocios cerrados exitosamente ═══
  {
    name: 'Hernando Vélez',
    company: 'Vélez Constructores',
    email: 'hvelez@velezconst.co',
    phone: '3001112233',
    source: 'REFERRAL',
    stage: 'WON',
    value: 22_000_000,
    probability: 100,
    expectedCloseDate: '2026-04-01',
    notes: 'Cerrado! Compra de material para 3 casas en Copacabana. Pagó 50% anticipo, resto contra entrega. Factura FV-0312.',
  },
  {
    name: 'Ana María Ospina',
    company: 'Diseños AO',
    email: 'ana@disenosao.com',
    phone: '3167774433',
    source: 'WEB',
    stage: 'WON',
    value: 3_800_000,
    probability: 100,
    expectedCloseDate: '2026-04-10',
    notes: 'Cerrado! Pinturas y accesorios para remodelación de oficina. Pagó de contado. Cliente muy satisfecha, pidió tarjeta.',
  },
  {
    name: 'Óscar Bedoya',
    company: 'Taller Mecánico Bedoya',
    email: 'oscar.bedoya@tallerbedoya.co',
    phone: '3055556677',
    source: 'WALK_IN',
    stage: 'WON',
    value: 1_200_000,
    probability: 100,
    expectedCloseDate: '2026-04-05',
    notes: 'Cerrado! Herramientas manuales y eléctricas para taller. Cliente recurrente, aplica descuento del 5%.',
  },

  // ═══ LOST — Negocios perdidos ═══
  {
    name: 'Julián Arango',
    company: 'Proyecto Mirador',
    email: 'jarango@pmiradorl.co',
    phone: '3198887766',
    source: 'WEB',
    stage: 'LOST',
    value: 35_000_000,
    probability: 0,
    expectedCloseDate: '2026-03-15',
    notes: 'Perdido. Se fue con competencia (Homecenter) por mejores precios en volumen. Evaluar descuento para obras grandes.',
  },
  {
    name: 'Valentina Castro',
    phone: '3076665544',
    source: 'WHATSAPP',
    stage: 'LOST',
    value: 800_000,
    probability: 0,
    expectedCloseDate: '2026-03-20',
    notes: 'Perdido. No respondió después de 3 seguimientos. Se le cotizó por WhatsApp pero no volvió a escribir.',
  },
]

async function main() {
  console.log('🏗️  Conectando a tenant_prueba...\n')

  // Clean existing demo leads (optional safety: only delete if names match)
  const existingNames = leads.map(l => l.name)
  const deleted = await prisma.lead.deleteMany({
    where: { name: { in: existingNames } },
  })
  if (deleted.count > 0) {
    console.log(`🧹 Limpiados ${deleted.count} leads demo previos\n`)
  }

  let created = 0

  for (const lead of leads) {
    try {
      await prisma.lead.create({
        data: {
          name: lead.name,
          company: lead.company || null,
          email: lead.email || null,
          phone: lead.phone || null,
          source: lead.source || null,
          stage: lead.stage,
          value: lead.value,
          expectedRevenue: lead.value,
          probability: lead.probability,
          expectedCloseDate: lead.expectedCloseDate ? new Date(lead.expectedCloseDate) : null,
          notes: lead.notes || null,
        },
      })

      const stageEmoji: Record<string, string> = {
        NEW: '🔵',
        CONTACTED: '🟡',
        QUOTED: '🟣',
        WON: '🟢',
        LOST: '🔴',
      }

      console.log(`  ${stageEmoji[lead.stage] || '⚪'} [${lead.stage.padEnd(9)}] ${lead.name}${lead.company ? ` — ${lead.company}` : ''} ($${lead.value.toLocaleString('es-CO')})`)
      created++
    } catch (err: any) {
      console.error(`  ❌ ${lead.name} — ${err.message}`)
    }
  }

  // Summary
  const byStage = leads.reduce((acc, l) => {
    acc[l.stage] = (acc[l.stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalValue = leads.reduce((sum, l) => sum + l.value, 0)
  const pipelineValue = leads.filter(l => !['WON', 'LOST'].includes(l.stage)).reduce((sum, l) => sum + l.value, 0)

  console.log(`\n🎉 Seed completado: ${created} oportunidades creadas`)
  console.log(`\n📊 Distribución Kanban:`)
  console.log(`   🔵 Nueva:      ${byStage.NEW || 0}`)
  console.log(`   🟡 Contactado: ${byStage.CONTACTED || 0}`)
  console.log(`   🟣 Cotizado:   ${byStage.QUOTED || 0}`)
  console.log(`   🟢 Ganada:     ${byStage.WON || 0}`)
  console.log(`   🔴 Perdida:    ${byStage.LOST || 0}`)
  console.log(`\n💰 Valor total pipeline activo: $${pipelineValue.toLocaleString('es-CO')}`)
  console.log(`💵 Valor total (incluye cerradas): $${totalValue.toLocaleString('es-CO')}`)
}

main()
  .catch(e => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
