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
- NUNCA incluyas "Clivi", "Clivaro" ni nombres de la plataforma en el contenido del email.
- La campaña debe verse como si viniera del negocio del usuario, no de un software.
- Usa {{name}} para personalizar el nombre del destinatario.
- SIEMPRE incluye al menos un bloque "image" con un "alt" muy descriptivo (será usado para generar la imagen con IA).

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "name": "nombre interno de la campaña (corto)",
  "subject": "asunto del email (atractivo, max 60 chars)",
  "blocks": [
    { "type": "header", "content": "Título del email", "style": { "fontSize": "28px", "fontWeight": "700", "color": "#ffffff", "textAlign": "center", "padding": "32px 20px", "backgroundColor": "#1e40af" } },
    { "type": "image", "content": "", "src": "", "alt": "Descripción visual detallada de la imagen ideal para este email (ej: foto profesional de herramientas organizadas sobre mesa de madera con fondo difuminado)", "style": { "padding": "0px 0px", "textAlign": "center" } },
    { "type": "text", "content": "Párrafo de texto. Usa {{name}} para personalizar.", "style": { "fontSize": "15px", "color": "#374151", "textAlign": "left", "padding": "16px 20px" } },
    { "type": "button", "content": "Texto del botón", "href": "https://tusitio.com", "style": { "backgroundColor": "#2563eb", "color": "#ffffff", "fontSize": "15px", "fontWeight": "700", "textAlign": "center", "padding": "12px 20px", "borderRadius": "8px" } },
    { "type": "divider", "content": "", "style": { "padding": "8px 20px" } },
    { "type": "social", "content": "facebook,instagram,whatsapp", "style": { "textAlign": "center", "padding": "16px 20px" } }
  ]
}

Tipos de bloques disponibles: header, text, image, button, divider, spacer, social, two-column.
Para "image": SIEMPRE incluye "src": "" (vacío) y "alt" con una descripción DETALLADA y visual de la imagen ideal (mínimo 15 palabras). Esta descripción se usará para generar la imagen con IA.
Para "two-column": incluye "leftContent" y "rightContent" en style.
Para "spacer": incluye "height" en style (ej: "24px").
Usa colores profesionales y vibrantes. El header debe tener un color de fondo llamativo.
Genera entre 6-10 bloques para un email atractivo. Incluye 1-2 bloques "image".`)

  const text = result.response.text().trim()
  const clean = text.replace(/^```json?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(clean)

  // Convert blocks to HTML using the same logic as the frontend builder
  if (parsed.blocks && Array.isArray(parsed.blocks)) {
    const rows = parsed.blocks.map((block: any) => blockToEmailHtml(block)).join('\n')
    parsed.htmlContent = `<div style="font-family:Arial,sans-serif;padding:0;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${rows}
    <tr><td style="padding:16px 20px;text-align:center;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
      Enviado con <a href="https://www.clientumstudio.com" style="color:#6366f1;text-decoration:none;font-weight:600;">Clivaro</a> · Si no deseas recibir estos correos, ignora este mensaje.
    </td></tr>
  </table>
</div>`
    // Also store the blocks as a JSON-encoded string so the editor can reconstruct them
    parsed._blocks = parsed.blocks
  }

  return {
    name: parsed.name,
    subject: parsed.subject,
    htmlContent: parsed.htmlContent,
    _blocks: parsed._blocks || parsed.blocks,
  } as any
}

/**
 * Server-side block to HTML conversion (mirrors the frontend EmailBuilder logic)
 */
function blockToEmailHtml(block: any): string {
  const pad = block.style?.padding || '12px 20px'
  const type = block.type || 'text'

  switch (type) {
    case 'header':
      return `<tr><td style="padding:${pad};background-color:${block.style?.backgroundColor || '#ffffff'};font-family:Arial,sans-serif;">
        <h1 style="margin:0;font-size:${block.style?.fontSize || '28px'};font-weight:${block.style?.fontWeight || '700'};color:${block.style?.color || '#111827'};text-align:${block.style?.textAlign || 'center'};">${block.content || ''}</h1>
      </td></tr>`
    case 'text':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;">
        <p style="margin:0;font-size:${block.style?.fontSize || '15px'};color:${block.style?.color || '#374151'};text-align:${block.style?.textAlign || 'left'};line-height:1.6;">${block.content || ''}</p>
      </td></tr>`
    case 'image':
      if (!block.src) return `<tr><td style="padding:${pad};text-align:center;font-family:Arial,sans-serif;"><div style="background:#f3f4f6;border:2px dashed #d1d5db;border-radius:12px;padding:40px 20px;color:#9ca3af;font-size:13px;">📷 Imagen</div></td></tr>`
      return `<tr><td style="padding:${pad};text-align:center;font-family:Arial,sans-serif;"><img src="${block.src}" alt="${block.alt || 'Imagen'}" style="max-width:100%;height:auto;border-radius:8px;" /></td></tr>`
    case 'button':
      return `<tr><td style="padding:${pad};text-align:center;font-family:Arial,sans-serif;">
        <a href="${block.href || '#'}" style="display:inline-block;background-color:${block.style?.backgroundColor || '#2563eb'};color:${block.style?.color || '#ffffff'};text-decoration:none;padding:14px 32px;border-radius:${block.style?.borderRadius || '8px'};font-size:${block.style?.fontSize || '15px'};font-weight:700;font-family:Arial,sans-serif;">${block.content || 'Click'}</a>
      </td></tr>`
    case 'divider':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>`
    case 'spacer':
      return `<tr><td style="height:${block.style?.height || '24px'};font-size:1px;line-height:1px;">&nbsp;</td></tr>`
    case 'social': {
      const networks = (block.content || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      const colors: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', whatsapp: '#25D366', twitter: '#1DA1F2', linkedin: '#0A66C2' }
      const icons = networks.map((n: string) => {
        const color = colors[n] || '#6b7280'
        return `<a href="#" style="display:inline-block;width:36px;height:36px;background-color:${color};border-radius:50%;margin:0 6px;text-align:center;line-height:36px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">${n.charAt(0).toUpperCase()}</a>`
      }).join('')
      return `<tr><td style="padding:${pad};text-align:center;font-family:Arial,sans-serif;">${icons}</td></tr>`
    }
    case 'two-column':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="48%" valign="top" style="padding:8px;font-size:14px;color:#374151;">${block.style?.leftContent || ''}</td>
        <td width="4%"></td>
        <td width="48%" valign="top" style="padding:8px;font-size:14px;color:#374151;">${block.style?.rightContent || ''}</td>
      </tr></table></td></tr>`
    default:
      return ''
  }
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
Genera un array JSON de bloques para un email tipo "${typeLabels[type]}" con estos detalles: ${details}

Tipos de bloques: header, text, image, button, divider, spacer, social, two-column.
Cada bloque: { "type": "...", "content": "...", "style": { ... } }
Para buttons: incluir "href".
Para images: incluir "src" (vacío si no hay URL), "alt".
Para social: content es lista separada por comas (ej: "facebook,instagram,whatsapp").
Para two-column: style tiene "leftContent" y "rightContent".
Usa {{name}} para personalizar. Colores profesionales y vibrantes.

Responde ÚNICAMENTE con el JSON array de bloques, sin markdown ni backticks.
Ejemplo: [{"type":"header","content":"Título","style":{"fontSize":"28px","fontWeight":"700","color":"#ffffff","textAlign":"center","padding":"32px 20px","backgroundColor":"#1e40af"}}]`)

  const text = result.response.text().trim().replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
  const blocks = JSON.parse(text)

  // Convert blocks to HTML
  const rows = blocks.map((block: any) => blockToEmailHtml(block)).join('\n')
  return `<div style="font-family:Arial,sans-serif;padding:0;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${rows}
    <tr><td style="padding:16px 20px;text-align:center;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
      Enviado con <a href="https://www.clientumstudio.com" style="color:#6366f1;text-decoration:none;font-weight:600;">Clivaro</a>
    </td></tr>
  </table>
</div>`
}
