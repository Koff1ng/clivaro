import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Use Gemini 2.0 Flash — cheapest model
// Pricing: Input $0.10/1M tokens, Output $0.40/1M tokens
// ~$0.0004 per campaign, ~$0.05/month per tenant at moderate usage
const MODEL = 'gemini-2.0-flash'

const SYSTEM_PROMPT = `Eres un asistente de marketing experto para negocios tipo ferretería, tiendas de construcción y retail en Colombia.
Tu rol es ayudar a crear campañas de email marketing, sugerir respuestas a clientes, y analizar leads.
Responde siempre en español colombiano. Sé conciso, directo y profesional.
Cuando generes HTML para emails, usa tablas para layout (no flexbox/grid), colores profesionales, y fuente Arial.
Los precios van en pesos colombianos (COP) con formato $XXX.XXX.
Variables disponibles en emails: {{name}} para el nombre del destinatario.`

export async function generateCampaignContent(prompt: string): Promise<{
  name: string
  subject: string
  htmlContent: string
}> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent(`
Genera una campaña de email marketing con base en esta petición: "${prompt}"

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "name": "nombre interno de la campaña (corto)",
  "subject": "asunto del email (atractivo, max 60 chars)",
  "htmlContent": "HTML completo del email usando tablas para layout, max-width 600px, fuente Arial, colores profesionales. Incluye header con título, body con contenido, CTA button, y footer con 'Enviado con Clivaro'. Usa {{name}} donde corresponda."
}`)

  const text = result.response.text().trim()
  // Clean potential markdown wrapping
  const clean = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(clean)
}

export async function improveEmailText(text: string, instruction: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent(`
Mejora este texto de email marketing siguiendo esta instrucción: "${instruction}"

Texto original:
${text}

Responde ÚNICAMENTE con el texto mejorado, sin explicaciones ni formato extra.`)

  return result.response.text().trim()
}

export async function suggestEmailReply(context: {
  leadName: string
  lastMessages: string[]
  leadStage?: string
}): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent(`
Sugiere 3 respuestas para este cliente:
- Nombre: ${context.leadName}
- Etapa: ${context.leadStage || 'desconocida'}
- Últimos mensajes: ${context.lastMessages.join(' | ')}

Responde ÚNICAMENTE con un JSON array de 3 strings, cada uno una respuesta corta y profesional.
Ejemplo: ["Respuesta 1", "Respuesta 2", "Respuesta 3"]`)

  const text = result.response.text().trim()
  const clean = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(clean)
}

export async function extractLeadsFromText(text: string): Promise<{
  name: string
  email?: string
  phone?: string
  interest?: string
  source: string
}[]> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent(`
Analiza este texto y extrae todos los contactos/leads potenciales que encuentres.
Para cada uno identifica: nombre, email (si hay), teléfono (si hay), interés/producto mencionado.

Texto:
${text}

Responde ÚNICAMENTE con un JSON array. Si no hay leads, responde [].
Ejemplo: [{"name":"Juan Pérez","email":"juan@mail.com","phone":"3001234567","interest":"pinturas","source":"email"}]`)

  const responseText = result.response.text().trim()
  const clean = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(clean)
}

export async function generateQuickCampaignHtml(
  type: 'promo' | 'newsletter' | 'welcome' | 'sale' | 'event',
  details: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const typeLabels = {
    promo: 'promoción de producto',
    newsletter: 'newsletter semanal',
    welcome: 'bienvenida a nuevo cliente',
    sale: 'liquidación/rebajas',
    event: 'invitación a evento',
  }

  const result = await model.generateContent(`
Genera el HTML completo de un email tipo "${typeLabels[type]}" con estos detalles: ${details}

Requisitos del HTML:
- Usar <table> para layout (compatible con email clients)
- max-width: 600px, centrado
- Fuente Arial, sans-serif
- Header con color de fondo vivo y título blanco
- Body con contenido claro
- Botón CTA con color contrastante y border-radius
- Footer: "Enviado con Clivaro"
- Variable {{name}} para personalizar
- Colores profesionales y modernos

Responde ÚNICAMENTE con el HTML, sin explicaciones ni backticks.`)

  return result.response.text().trim().replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
}
