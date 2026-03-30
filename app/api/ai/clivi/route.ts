import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { CLIVI_SYSTEM_PROMPT, generateCampaignContent } from '@/lib/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const MODEL = 'gemini-2.5-flash'

// Actions Clivi can perform
const ACTIONS_PROMPT = `
CAPACIDADES DE ACCIÓN (muy importante):
Tú puedes EJECUTAR acciones en el sistema, no solo dar instrucciones.

Cuando el usuario te pida algo que puedes hacer, HAZLO directamente. No le pidas confirmación a menos que la información sea ambigua.

Acciones disponibles:
1. CREAR CAMPAÑA: Si el usuario pide crear una campaña de email marketing, genera el contenido y devuelve la acción.
2. NAVEGAR: Si el usuario pide ir a un módulo, navega directamente.

Para ejecutar una acción, responde con un JSON en este formato EXACTO (sin texto adicional antes ni después):
{"action":"create-campaign","data":{"prompt":"descripción detallada de la campaña"},"reply":"mensaje amigable confirmando lo que estás haciendo"}

{"action":"navigate","data":{"path":"/ruta"},"reply":"mensaje amigable"}

Rutas disponibles para navigate:
- /marketing/campaigns — Campañas de marketing
- /dashboard — Dashboard
- /inventory/products — Productos
- /pos — Punto de venta  
- /crm — CRM / Leads
- /cash/shifts — Turnos de caja
- /hr — Recursos Humanos
- /accounting — Contabilidad
- /settings — Configuración
- /reports — Reportes

Si NO es una acción, responde normalmente con texto conversacional (sin JSON).

IMPORTANTE: Cuando el usuario pida crear una campaña, NO le preguntes más datos. Usa tu creatividad con la información que te dio y EJECUTA la acción inmediatamente.`

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
  if (session instanceof NextResponse) return session

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
    try {
      // Try to parse as JSON action
      const cleanText = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      const parsed = JSON.parse(cleanText)
      
      if (parsed.action && parsed.reply) {
        // Execute the action
        if (parsed.action === 'create-campaign' && parsed.data?.prompt) {
          try {
            const campaignData = await generateCampaignContent(parsed.data.prompt)
            return NextResponse.json({
              reply: parsed.reply,
              action: {
                type: 'create-campaign',
                data: campaignData, // { name, subject, htmlContent }
              },
            })
          } catch (err: any) {
            return NextResponse.json({
              reply: `${parsed.reply}\n\n⚠️ Hubo un problemita generando el HTML, pero puedes crearlo manualmente en Marketing > Nueva Campaña.`,
              action: {
                type: 'navigate',
                data: { path: '/marketing/campaigns' },
              },
            })
          }
        }

        if (parsed.action === 'navigate' && parsed.data?.path) {
          return NextResponse.json({
            reply: parsed.reply,
            action: {
              type: 'navigate',
              data: { path: parsed.data.path },
            },
          })
        }
      }
    } catch {
      // Not JSON — it's a normal conversational reply
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
