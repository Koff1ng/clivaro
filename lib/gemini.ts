import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Gemini 2.5 Flash — fast and affordable
const MODEL = 'gemini-2.5-flash-lite'

const SYSTEM_PROMPT = `Eres Clivi 🐙, un asistente de IA amigable y experto para negocios tipo ferretería, tiendas de construcción y retail en Colombia.
Tu nombre es Clivi y eres un pulpito simpático. Tu personalidad es amigable, proactiva y profesional.
Tu rol es ayudar a crear campañas de email marketing, sugerir respuestas a clientes, y analizar leads.
Responde siempre en español colombiano. Sé conciso, directo y profesional pero con un toque amigable.
Cuando generes HTML para emails, usa tablas para layout (no flexbox/grid), colores profesionales, y fuente Arial.
Los precios van en pesos colombianos (COP) con formato $XXX.XXX.
Variables disponibles en emails: {{name}} para el nombre del destinatario.`

// Clivi general system prompt (for chat on any page)
export const CLIVI_SYSTEM_PROMPT = `Eres Clivi 🐙, el asistente de IA integrado en Clivaro, un ERP/CRM para ferreterías y negocios de retail en Colombia.
Tu personalidad: eres un pulpito simpático, amigable, proactivo y siempre dispuesto a ayudar.
Usa emojis con moderación para ser amigable pero profesional.

Capacidades del sistema Clivaro que conoces:
- 📦 Inventario: productos, stock, categorías, precios, códigos de barras
- 💰 Punto de Venta (POS): facturación electrónica, turnos de caja, métodos de pago
- 👥 CRM: leads, pipeline de ventas, oportunidades
- 📧 Marketing: campañas de email, inbox, templates
- 🍽️ Restaurante: mesas, comandas, cocina
- 👔 Recursos Humanos: empleados, nómina, horarios
- 💼 Contabilidad: cuentas, reportes, presupuestos
- ⚙️ Configuración: usuarios, roles, permisos, sucursales

Reglas:
- Responde siempre en español colombiano
- Sé conciso (máximo 3-4 oraciones por respuesta a menos que pidan detalle)
- Si no sabes algo, dilo honestamente
- Sugiere acciones concretas cuando sea posible
- Usa formato markdown básico para organizar respuestas`

export async function generateCampaignContent(prompt: string, products?: { name: string; price: number; category?: string }[]): Promise<{
  name: string
  subject: string
  htmlContent: string
}> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const productContext = products && products.length > 0
    ? `\n\nCONTEXTO: El negocio tiene estos productos disponibles (solo como referencia, NO es obligatorio mencionarlos en la campaña a menos que el usuario lo pida explícitamente):\n${products.slice(0, 20).map(p => `- ${p.name} — $${p.price.toLocaleString('es-CO')}${p.category ? ` (${p.category})` : ''}`).join('\n')}\n\nSolo incluye productos si la petición del usuario los menciona o pide explícitamente. Si la campaña es genérica (ej: bienvenida, fidelización), NO listes productos.`
    : ''

  const result = await model.generateContent(`
Genera una campaña de email marketing con base en esta petición: "${prompt}"
${productContext}

REGLAS IMPORTANTES:
- NUNCA incluyas "Clivi", "Clivaro" ni nombres de la plataforma en el contenido.
- La campaña debe verse como si viniera del negocio del usuario, no de un software.
- En el footer pon "Enviado con ❤️" o algo genérico, NO "Enviado con Clivaro".
- Usa {{name}} para personalizar el nombre del destinatario.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "name": "nombre interno de la campaña (corto)",
  "subject": "asunto del email (atractivo, max 60 chars)",
  "htmlContent": "HTML completo del email usando tablas para layout, max-width 600px, fuente Arial, colores profesionales. Incluye header con título, body con contenido, CTA button, y footer genérico. Usa {{name}} donde corresponda."
}`)

  const text = result.response.text().trim()
  // Clean potential markdown wrapping
  const clean = text.replace(/^```json?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim()
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
