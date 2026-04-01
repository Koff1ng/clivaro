import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { CLIVI_SYSTEM_PROMPT, generateCampaignContent } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import { withTenantRead } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const MODEL = 'gemini-2.0-flash'

// ── Actions prompt ──
const ACTIONS_PROMPT = `
CAPACIDADES DE ACCIÓN (muy importante):
Tú puedes EJECUTAR acciones en el sistema, no solo dar instrucciones.
Cuando el usuario pida algo que puedes hacer, HAZLO directamente.

Acciones disponibles:
1. CREAR CAMPAÑA: Genera contenido de email y devuelve la acción.
2. NAVEGAR: Redirige al usuario a un módulo.
3. ANALIZAR: Consulta la base de datos para responder preguntas de negocio (ventas, productos más vendidos, stock, etc).

REGLAS CRÍTICAS PARA CAMPAÑAS:
- NUNCA incluyas "Clivi", "Clivaro" ni el nombre de la plataforma en el contenido de la campaña.
- El contenido de la campaña debe verse como si lo hubiera creado el negocio del usuario directamente.
- Usa "Tu tienda", "Tu negocio" o algo genérico. El sistema reemplazará variables como {{name}} con el nombre real.
- Crea campañas profesionales, atractivas, con HTML para email (tablas, no flexbox).

Para ejecutar una acción, responde SOLO con JSON (sin texto antes ni después):

Para campaña:
{"action":"create-campaign","data":{"prompt":"descripción detallada"},"reply":"mensaje amigable"}

Para navegación:
{"action":"navigate","data":{"path":"/ruta"},"reply":"mensaje amigable"}

Para análisis de datos:
{"action":"analyze","data":{"type":"tipo_de_análisis"},"reply":"mensaje amigable temporal"}

Tipos de análisis disponibles (para el campo "type"):
- "sales-summary" → Resumen de ventas (hoy, semana, mes)
- "top-products" → Productos más vendidos
- "low-stock" → Productos con stock bajo
- "top-customers" → Mejores clientes
- "sales-trend" → Tendencia de ventas

Rutas EXACTAS para navigate (NO USES OTRAS):
- /dashboard → Dashboard principal
- /marketing/campaigns → Campañas de marketing
- /inventory/products → Productos / Inventario
- /pos → Punto de venta
- /crm → CRM / Leads / Clientes
- /cash/shifts → Turnos de caja
- /hr → Recursos Humanos
- /accounting → Contabilidad
- /settings → Configuración
- /reports → Reportes y analíticas

IMPORTANTE:
- Cuando pidan "reporte" o "análisis" o "qué se vende más", usa la acción "analyze", NO navegues a /reports
- Cuando pidan "llévame a reportes" sí usa navigate a /reports
- Solo navega cuando el usuario EXPLÍCITAMENTE pida ir a un lugar
- Si piden datos, ANALIZA la base de datos y responde con información real

Si NO es ninguna acción, responde normalmente con texto conversacional (sin JSON).`

// ── Analytics queries ──
async function runAnalytics(type: string) {

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  switch (type) {
    case 'sales-summary': {
      const [todaySales, weekSales, monthSales, totalInvoices] = await Promise.all([
        prisma.invoice.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: todayStart }, status: { not: 'ANULADA' } } }),
        prisma.invoice.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: weekStart }, status: { not: 'ANULADA' } } }),
        prisma.invoice.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: monthStart }, status: { not: 'ANULADA' } } }),
        prisma.invoice.count({ where: { status: { not: 'ANULADA' } } }),
      ])
      return {
        hoy: { total: todaySales._sum.total || 0, facturas: todaySales._count },
        semana: { total: weekSales._sum.total || 0, facturas: weekSales._count },
        mes: { total: monthSales._sum.total || 0, facturas: monthSales._count },
        totalFacturas: totalInvoices,
      }
    }

    case 'top-products': {
      const items = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, subtotal: true },
        _count: true,
        where: { invoice: { createdAt: { gte: monthStart }, status: { not: 'ANULADA' } } },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 10,
      })
      const productIds = items.map(i => i.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, category: true },
      })
      const productMap = new Map(products.map((p: any) => [p.id, p]))
      return items.map((item, idx) => ({
        posicion: idx + 1,
        producto: (productMap.get(item.productId) as any)?.name || 'Desconocido',
        categoria: (productMap.get(item.productId) as any)?.category || '-',
        cantidadVendida: item._sum.quantity || 0,
        totalVentas: item._sum.subtotal || 0,
        transacciones: item._count,
      }))
    }

    case 'low-stock': {
      const stockLevels = await prisma.stockLevel.findMany({
        where: { quantity: { lte: 5 } },
        include: { product: { select: { name: true, category: true } }, warehouse: { select: { name: true } } },
        orderBy: { quantity: 'asc' },
        take: 15,
      })
      return stockLevels.map((s: any) => ({
        producto: s.product?.name || 'N/A',
        categoria: s.product?.category || '-',
        bodega: s.warehouse?.name || '-',
        cantidad: s.quantity,
        minimo: s.minStock,
      }))
    }

    case 'top-customers': {
      const invoices = await prisma.invoice.groupBy({
        by: ['customerId'],
        _sum: { total: true },
        _count: true,
        where: { createdAt: { gte: monthStart }, status: { not: 'ANULADA' } },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      })
      const customerIds = invoices.map(i => i.customerId)
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, email: true, phone: true },
      })
      const customerMap = new Map(customers.map((c: any) => [c.id, c]))
      return invoices.map((inv, idx) => ({
        posicion: idx + 1,
        cliente: (customerMap.get(inv.customerId) as any)?.name || 'Sin nombre',
        totalCompras: inv._sum.total || 0,
        facturas: inv._count,
      }))
    }

    case 'sales-trend': {
      const last30 = new Date()
      last30.setDate(last30.getDate() - 30)
      const invoices = await prisma.invoice.findMany({
        where: { createdAt: { gte: last30 }, status: { not: 'ANULADA' } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      })
      // Group by date
      const dailyMap = new Map<string, { total: number; count: number }>()
      invoices.forEach(inv => {
        const day = inv.createdAt.toISOString().split('T')[0]
        const prev = dailyMap.get(day) || { total: 0, count: 0 }
        dailyMap.set(day, { total: prev.total + inv.total, count: prev.count + 1 })
      })
      return Array.from(dailyMap.entries()).map(([fecha, data]) => ({
        fecha,
        ventaTotal: data.total,
        facturas: data.count,
      }))
    }

    default:
      return { error: 'Tipo de análisis no reconocido' }
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const { message, history, pageContext } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const contextInfo = pageContext ? `\nEl usuario está actualmente en: ${pageContext}` : ''

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: CLIVI_SYSTEM_PROMPT + ACTIONS_PROMPT + contextInfo,
    })

    const chatHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(message)
    const text = result.response.text().trim()

    // Check if response is an action JSON
    let parsed: any = null
    try {
      // Strategy 1: Direct parse
      parsed = JSON.parse(text)
    } catch {
      try {
        // Strategy 2: Strip markdown fences
        const cleanText = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim()
        parsed = JSON.parse(cleanText)
      } catch {
        // Strategy 3: Extract JSON object from mixed text (model sometimes adds text before/after)
        const jsonMatch = text.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*"reply"\s*:\s*"[\s\S]*?\}/)
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0])
          } catch { /* not valid JSON */ }
        }
      }
    }

    if (parsed && parsed.action && parsed.reply) {
        // ── Create campaign ──
        if (parsed.action === 'create-campaign' && parsed.data?.prompt) {
          try {
            // Fetch real products from the tenant's inventory
            let products: { name: string; price: number; category?: string }[] = []
            try {
              products = await withTenantRead(tenantId, async (tenantPrisma) => {
                const dbProducts = await tenantPrisma.product.findMany({
                  where: { active: true },
                  select: { name: true, price: true, category: true },
                  orderBy: { name: 'asc' },
                  take: 30,
                })
                return dbProducts.map((p: any) => ({
                  name: p.name,
                  price: Number(p.price),
                  category: p.category || undefined,
                }))
              })
            } catch {
              // If product fetch fails, continue without products
              console.log('[Clivi] Could not fetch products, generating without product context')
            }

            const campaignData = await generateCampaignContent(parsed.data.prompt, products)
            return NextResponse.json({
              reply: parsed.reply,
              action: { type: 'create-campaign', data: campaignData },
            })
          } catch {
            return NextResponse.json({
              reply: `${parsed.reply}\n\n⚠️ Hubo un problemita generando el HTML. Puedes crearlo manualmente en Marketing > Nueva Campaña.`,
              action: { type: 'navigate', data: { path: '/marketing/campaigns' } },
            })
          }
        }

        // ── Navigate ──
        if (parsed.action === 'navigate' && parsed.data?.path) {
          return NextResponse.json({
            reply: parsed.reply,
            action: { type: 'navigate', data: { path: parsed.data.path } },
          })
        }

        // ── Analyze ──
        if (parsed.action === 'analyze' && parsed.data?.type) {
          try {
            const analyticsData = await runAnalytics(parsed.data.type)

            // Send analytics data to Gemini for a natural language summary
            const summaryModel = genAI.getGenerativeModel({
              model: MODEL,
              systemInstruction: `Eres Clivi 🐙, asistente de IA para negocios. 
              Analiza los siguientes datos y da un resumen ejecutivo claro, conciso y accionable en español colombiano.
              Usa formato markdown (bold, listas). Los montos son en COP.
              Formato moneda: $XXX.XXX
              Máximo 8 líneas. Sé directo y da insights útiles.`,
            })

            const summaryResult = await summaryModel.generateContent(
              `Datos del negocio:\n${JSON.stringify(analyticsData, null, 2)}\n\nDa un resumen ejecutivo con insights.`
            )
            const summary = summaryResult.response.text().trim()

            return NextResponse.json({
              reply: summary,
              action: { type: 'analytics', data: analyticsData },
            })
          } catch (err: any) {
            console.error('[Clivi Analytics]', err)
            return NextResponse.json({
              reply: '🐙 Tuve un problema consultando los datos. Puede que no haya suficiente información o que la base de datos no esté disponible. ¿Puedo ayudarte con otra cosa?',
            })
          }
        }
    }

    return NextResponse.json({ reply: text })
  } catch (error: any) {
    console.error('[Clivi] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Clivi tuvo un error 🐙' },
      { status: 500 }
    )
  }
}
