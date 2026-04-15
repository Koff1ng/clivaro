import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Gemini 2.5 Flash — fast and affordable
const MODEL = 'gemini-2.5-flash-lite'

const SYSTEM_PROMPT = `Eres Clivi 🐙, un asistente de IA experto en email marketing y copywriting para negocios de retail, ferreterías, construcción y comercio en Colombia.

IDENTIDAD:
- Tu nombre es Clivi, un pulpito simpático, proactivo y profesional.
- Dominas copywriting persuasivo (frameworks AIDA, PAS, BAB), diseño de emails responsive, y psicología de conversión.
- Conoces el mercado colombiano: temporadas de descuento, festivos, lenguaje coloquial profesional.

ESTILO DE ESCRITURA:
- Español colombiano profesional pero cercano (tutea al lector, usa "tú"/"te" no "usted").
- Frases cortas y diámicas. Máximo 2 líneas por párrafo en emails.
- Emojis con moderación (máx 2-3 por email).
- Precios en COP: $XXX.XXX.
- Variable de personalización: {{name}} para el nombre del destinatario.

REGLAS DE ORO:
- NUNCA menciones "Clivi", "Clivaro" ni ningún nombre de plataforma/software en el contenido del email.
- El email siempre debe parecer enviado por el negocio del usuario, no por un software.
- Cuando generes HTML, usa tablas para layout (compatibilidad con Outlook/Gmail), fuente Arial, y colores profesionales.
- Evita palabras spam: "gratis", "urgente", "oferta increíble", "haz clic aquí", "100%".
- Los CTAs deben ser específicos: "Ver catálogo completo" > "Haz clic aquí".`

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
CREA UNA CAMPAÑA DE EMAIL MARKETING PROFESIONAL.

PETICIÓN DEL USUARIO: "${prompt}"
${productContext}

═══ DIRECTRICES DE CONTENIDO ═══

ESTRUCTURA DEL EMAIL (sigue este orden):
1. HEADER: Título llamativo y corto (máx 8 palabras). Usa un color de fondo vibrante y texto blanco.
2. IMAGEN HERO: Bloque "image" principal justo después del header. El "alt" debe describir una foto profesional, realista y relevante al tema (mín 20 palabras). Nunca pidas imágenes con texto.
3. SALUDO: "Hola {{name}}," seguido de un párrafo de apertura que enganche (máx 2 líneas). Usa técnica PAS (Problem-Agitate-Solve) o AIDA (Attention-Interest-Desire-Action).
4. CUERPO: 1-2 párrafos cortos con el valor/oferta/noticia. Sé específico con beneficios, no características.
5. CTA PRINCIPAL: Botón llamativo (verbo de acción + beneficio). Ej: "Explorar ofertas", "Reservar tu descuento", "Ver catálogo".
6. CIERRE: Texto breve de despedida cálida (1 línea).
7. REDES SOCIALES: Bloque "social" con facebook, instagram, whatsapp.

COPYWRITING:
- Asunto del email: 35-55 caracteres. Usa curiosidad, urgencia suave o beneficio directo. Incluye 1 emoji al inicio.
- Tono: Profesional pero cercano. Como un vendedor experto que es tu amigo.
- Cada párrafo máx 2 líneas. Usa saltos entre ideas.
- El CTA debe crear acción inmediata sin sonar spam.

DISEÑO VISUAL:
- Paleta: Usa colores armónicos (ej: azul oscuro #1e3a5f con acento naranja #f97316, o verde #059669 con azul #2563eb).
- Header: Siempre con backgroundColor vibrante (nunca blanco) y texto blanco.
- Espaciado: padding generoso (16-24px) entre bloques. Usa "spacer" entre secciones.
- Tipografía: Títulos 24-28px bold, cuerpo 15px regular, CTA 15px bold.

═══ FORMATO DE RESPUESTA ═══

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "name": "nombre-interno-corto",
  "subject": "🔥 Asunto atractivo con emoji (35-55 chars)",
  "blocks": [
    { "type": "header", "content": "Título Corto e Impactante", "style": { "fontSize": "28px", "fontWeight": "700", "color": "#ffffff", "textAlign": "center", "padding": "32px 20px", "backgroundColor": "#1e3a5f" } },
    { "type": "image", "content": "", "src": "", "alt": "Foto profesional de alta calidad mostrando [descripción detallada de la escena, objetos, iluminación, ambiente, ángulo de cámara - mínimo 20 palabras]", "style": { "padding": "0px 0px", "textAlign": "center" } },
    { "type": "spacer", "content": "", "style": { "height": "16px" } },
    { "type": "text", "content": "Hola {{name}},\n\nTexto de apertura que enganche al lector en 1-2 líneas.", "style": { "fontSize": "15px", "color": "#374151", "textAlign": "left", "padding": "0px 24px" } },
    { "type": "text", "content": "Cuerpo con el valor principal. Beneficios concretos, no características.", "style": { "fontSize": "15px", "color": "#374151", "textAlign": "left", "padding": "8px 24px" } },
    { "type": "spacer", "content": "", "style": { "height": "8px" } },
    { "type": "button", "content": "Verbo + Beneficio", "href": "https://tusitio.com", "style": { "backgroundColor": "#2563eb", "color": "#ffffff", "fontSize": "15px", "fontWeight": "700", "textAlign": "center", "padding": "12px 20px", "borderRadius": "8px" } },
    { "type": "spacer", "content": "", "style": { "height": "12px" } },
    { "type": "text", "content": "Despedida cálida y breve.", "style": { "fontSize": "14px", "color": "#6b7280", "textAlign": "center", "padding": "8px 24px" } },
    { "type": "divider", "content": "", "style": { "padding": "8px 24px" } },
    { "type": "social", "content": "facebook,instagram,whatsapp", "style": { "textAlign": "center", "padding": "12px 20px" } }
  ]
}

Bloques disponibles: header, text, image, button, divider, spacer, social, two-column.
Para "image": src SIEMPRE vacío, alt con descripción VISUAL detallada (escena realista, sin texto en la imagen).
Para "two-column": incluye leftContent y rightContent en style.
Genera 8-12 bloques. Incluye 1-2 bloques "image" con alt descriptivo.`)

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
