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

        // Búsqueda de Productos/Inventario
        try {
            if (query.includes("producto") || query.includes("stock") || query.includes("inventario")) {
                const products = await prisma.product.findMany({
                    take: 5,
                    where: { active: true },
                    select: { name: true, sku: true, price: true, trackStock: true, stockLevels: { select: { quantity: true } } }
                });

                if (products.length > 0) {
                    discoveredContext += "\nDATOS DE INVENTARIO:\n" + products.map((p: any) => {
                        const totalStock = p.stockLevels?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0;
                        return `- ${p.name} (SKU: ${p.sku}) | Precio: $${p.price} | Stock: ${p.trackStock ? totalStock : 'N/A'}`;
                    }).join("\n");
                }
            }
        } catch (e) {
            console.error("[RAG_INVENTORY_ERROR]", e);
        }

        // Búsqueda de Ventas/Facturas
        try {
            if (query.includes("venta") || query.includes("factura") || query.includes("vendi") || query.includes("ingreso")) {
                const lastInvoices = await prisma.invoice.findMany({
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { name: true } } }
                });

                if (lastInvoices.length > 0) {
                    discoveredContext += "\nFACTURAS/VENTAS RECIENTES:\n" + lastInvoices.map((inv: any) =>
                        `- ${inv.number} | Cliente: ${inv.customer?.name} | Total: $${inv.total} | Estado: ${inv.status}`
                    ).join("\n");
                }
            }
        } catch (e) {
            console.error("[RAG_SALES_ERROR]", e);
        }

        // Búsqueda de Reportes/Cuentas
        try {
            if (query.includes("reporte") || query.includes("balance") || query.includes("contabilidad") || query.includes("ganancia")) {
                // Usamos accountingAccount que es el modelo correcto para el PUC
                const topAccounts = await prisma.accountingAccount.findMany({
                    take: 10,
                    where: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] } },
                    select: { code: true, name: true, type: true }
                });

                if (topAccounts.length > 0) {
                    discoveredContext += "\nPLAN DE CUENTAS (RESUMEN):\n" + topAccounts.map((a: any) =>
                        `- [${a.code}] ${a.name} (${a.type})`
                    ).join("\n");
                }
            }
        } catch (e) {
            console.error("[RAG_ACCOUNTING_ERROR]", e);
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
- Responde de forma muy concisa, profesional y con la mayor calidez posible.
- **USA NEGRILLAS:** Resalta palabras clave, módulos o datos importantes en **negrita** para que la lectura sea rápida y clara.
- Usa lenguaje natural y amable.
- Formato: Organiza con viñetas si hay múltiples puntos y deja espacios entre párrafos para mejorar la legibilidad.
- **CIERRE SIEMPRE:** Termina cada respuesta de la manera más amable posible, demostrando disposición absoluta y preguntando si hay algo más en lo que puedas ayudar.

**MÓDULOS, MICROSERVICIOS Y RUTAS (GUÍA MAESTRA):**

- **Dashboard y Reportes Comerciales (IMPORTANTE):**
  - Panel Principal: \`/dashboard\`
  - Centro de Reportes (Ventas, Inventario, KPIs): \`/dashboard/reports\` (Usa esto para "ver reportes" en general)
  - Facturación Electrónica (Dian/Alegra): \`/dashboard/electronic-invoicing\`

- **Contabilidad Técnica (Específico):**
  - Centro de Reportes Contables: \`/accounting/reports\` (Usa esto solo para consultas técnicas contables)
  - Balance General: \`/accounting/reports/balance-sheet\`
  - Estado de Resultados (P&G): \`/accounting/reports/profit-loss\`
  - Libro Auxiliar: \`/accounting/reports/aux-account\`
  - Comprobantes (Vouchers): \`/accounting/vouchers\`
  - Plan de Cuentas (PUC): \`/accounting/accounts\`

- **Inventario y Productos:**
  - Ver Productos: \`/products\`
  - Nuevo Producto: \`/products?new=item\`
  - Control de Inventario: \`/inventory\`
  - Almacenes: \`/inventory?tab=warehouses\`

- **Ventas y Clientes:**
  - Punto de Venta (POS): \`/pos\`
  - Facturas de Venta: \`/sales/invoices\`
  - Órdenes de Venta: \`/sales/orders\`
  - Cotizaciones: \`/sales/quotes\`
  - Notas Crédito: \`/credit-notes\`
  - Clientes (CRM): \`/crm/customers\`
  - Prospectos (Leads): \`/crm/leads\`

- **Compras y Proveedores:**
  - Proveedores: \`/purchases/suppliers\`
  - Órdenes de Compra: \`/purchases/orders\`
  - Recepción de Mercancía: \`/purchases/receipts\`

- **Otros Servicios:**
  - Arqueos/Turnos de Caja: \`/cash/shifts\`
  - Campañas de Marketing: \`/marketing/campaigns\`
  - Gestión de Empleados: \`/hr/employees\`

- **Configuración (Tabs Específicos):**
  - Usuarios: \`/settings?tab=users\`
  - Facturación Electrónica (Config): \`/settings?tab=billing\`
  - Impuestos: \`/settings?tab=taxes\`
  - Suscripción: \`/settings?tab=subscription\`
  - Métodos de Pago: \`/settings?tab=payments-methods\`
  - Ajustes Generales: \`/settings?tab=general\`

**PROTOCOLO DE ACCIÓN:**
Al final de tu respuesta, si la consulta se resuelve navegando, incluye SIEMPRE un botón con este formato: {{ACTION:Texto del Botón|/ruta}}.
Ejemplo: "Puedes ver tus reportes aquí: {{ACTION:Ver Reportes|/dashboard/reports}}"

**REGLAS DE ORO:**
1. Los reportes generales y KPIs están en \`/dashboard/reports\`. NO USES \`/reports\` sin el prefijo dashboard.
2. Distingue entre "Facturas" (transacciones) y "Reportes" (resúmenes).
3. Para ajustes, usa \`/settings\` con el tab correcto.
4. No uses más de un botón por respuesta.
5. **FALLBACK:** Si no puedes responder una pregunta o no tienes acceso a la información, NO INVENTES. Responde con un mensaje positivo y anima al usuario a contactar con nuestro equipo de gerencia en: gerencia@clientumstudio.com.`;

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
