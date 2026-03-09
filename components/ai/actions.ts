'use server'

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrismaForRequest } from "@/lib/get-tenant-prisma";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface GroqResponse {
    choices: { message: { content: string } }[];
}

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// ─────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene la respuesta del asistente inteligente con contexto del ERP.
 */
export async function getAssistantResponse(
    message: string,
    history: ChatMessage[] = [],
    userContext = ""
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        throw new Error("No autorizado");
    }

    // Obtener prisma con scope de tenant
    const prisma = await getPrismaForRequest(null as any, session);
    const tenantId = (session.user as any).tenantId;

    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY no encontrada en el servidor");
    }

    try {
        // --- 1. Descubrimiento de Contexto (Simple RAG) ---
        let discoveredContext = "";
        const query = message.toLowerCase();

        if (query.includes("producto") || query.includes("stock") || query.includes("inventario")) {
            const products = await prisma.product.findMany({
                take: 10,
                where: { active: true },
                select: { name: true, sku: true, price: true, trackStock: true, stockLevels: { select: { quantity: true } } }
            });

            if (products.length > 0) {
                discoveredContext += "\nPRODUCTOS RECIENTES/RELEVANTES:\n" + products.map((p: any) => {
                    const totalStock = p.stockLevels?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0;
                    return `- ${p.name} (SKU: ${p.sku}) | Precio: $${p.price} | Stock: ${p.trackStock ? totalStock : 'N/A'}`;
                }).join("\n");
            }
        }

        if (query.includes("venta") || query.includes("factura") || query.includes("vendi")) {
            const lastInvoices = await prisma.invoice.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { customer: { select: { name: true } } }
            });

            if (lastInvoices.length > 0) {
                discoveredContext += "\nFACTURAS RECIENTES:\n" + lastInvoices.map((inv: any) =>
                    `- ${inv.number} | Cliente: ${inv.customer?.name} | Total: $${inv.total} | Estado: ${inv.status}`
                ).join("\n");
            }
        }

        const userRoles = (session.user as any).roles;
        const rolesStr = Array.isArray(userRoles) ? userRoles.join(', ') : 'Ninguno';

        const fullContext = `
      User: ${session.user?.name}
      Email: ${session.user?.email}
      Tenant: ${(session.user as any).tenantSlug || 'Desconocido'}
      Roles: ${rolesStr}
      
      ${userContext || ''}
      ${discoveredContext}
    `.trim();

        // --- 2. Construcción del Prompt del Sistema ---
        const systemPrompt = `Eres el asistente inteligente oficial de Clivaro ERP. Tu objetivo es ayudar al usuario a navegar por el sistema, gestionar datos y realizar operaciones de manera eficiente.

**ESTILO DE RESPUESTA:**
- Responde de forma muy concisa, profesional y con calidez.
- Usa lenguaje natural y amable.
- Formato: Usa mayúsculas solo cuando sea necesario. Organiza con viñetas si hay múltiples puntos.

**MÓDULOS Y RUTAS DISPONIBLES (TABLA DE VERDAD):**
Utiliza estas rutas exactas para tus acciones. Si el usuario pregunta por un módulo, guíalo a la ruta correspondiente.

- **Inventario/Productos:**
  - Ver Productos: \`/products\`
  - Nuevo Producto: \`/products?new=item\`
  - Control de Inventario: \`/inventory\`
- **Ventas:**
  - Punto de Venta (POS): \`/pos\`
  - Listado de Ventas: \`/sales/invoices\`
  - Órdenes de Venta: \`/sales/orders\`
  - Nueva Orden: \`/sales/orders/new\`
  - Cotizaciones: \`/sales/quotes\`
- **Compras:**
  - Proveedores: \`/purchases/suppliers\`
  - Nuevo Proveedor: \`/purchases/suppliers?new=supplier\`
  - Órdenes de Compra: \`/purchases/orders\`
  - Recepción de Mercancía: \`/purchases/receipts\`
- **CRM:**
  - Clientes: \`/crm/customers\`
  - Nuevo Cliente: \`/crm/customers?new=customer\`
  - Oportunidades/Prospectos: \`/crm/leads\`
  - Bandeja de Entrada: \`/crm/inbox\`
- **Contabilidad:**
  - Reportes Contables: \`/accounting/reports\`
  - Comprobantes/Vouchers: \`/accounting/vouchers\`
  - Plan de Cuentas: \`/accounting/accounts\`
- **Recursos Humanos:**
  - Empleados: \`/hr/employees\`
  - Nómina: \`/hr/payroll\`
- **Configuración:**
  - Ajustes del Sistema: \`/settings\`

**PROTOCOLO DE ACCIÓN (CRÍTICO):**
Al final de tu respuesta, si la consulta del usuario se puede resolver o facilitar navegando a una sección del ERP, incluye SIEMPRE un botón de acción con este formato: {{ACTION:Texto del Botón|/ruta}}.
Ejemplo: "Para registrar un nuevo proveedor, puedes ir aquí: {{ACTION:Nuevo Proveedor|/purchases/suppliers?new=supplier}}"

**REGLAS IMPORTANTES:**
1. No inventes rutas. Usa solo las listadas arriba.
2. Si el usuario pide crear algo, usa la ruta con \`?new=\` si está disponible.
3. No uses más de un botón por respuesta.
4. Si no sabes algo sobre la empresa específica, básate en el contexto proporcionado o sugiere consultar al administrador.

Contexto actual del sistema (Datos en vivo):
${fullContext}`;

        // --- 3. Llamada a Groq ---
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message },
        ];

        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages,
                temperature: 0.5,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error?.message || "Error de comunicación con la IA");
        }

        const data: GroqResponse = await response.json();
        const assistantMsg = data.choices[0]?.message?.content ?? "";

        // --- 4. Guardar Log ---
        await guardarLog((session.user as any)?.id as string, "chat", message, assistantMsg);

        return assistantMsg;

    } catch (error: any) {
        console.error("[AI_ACTION_ERROR]", error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────

async function guardarLog(
    userId: string,
    module: string,
    prompt: string,
    response: string
): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return;

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("ai_logs").insert({
            user_id: userId,
            module,
            prompt: prompt,
            response: response,
            created_at: new Date().toISOString(),
        });
    } catch (e) {
        console.warn("No se pudo guardar ai_log en Supabase.");
    }
}
