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
- Responde de forma concisa, profesional y cálida.
- **PROHIBICIÓN DE RUTAS TÉCNICAS:** NUNCA menciones rutas técnicas que empiecen con "/" (ej. "/pos", "/sales/invoices") directamente en el texto.
- **NAVEGACIÓN AMIGABLE:** Usa siempre nombres amigables siguiendo la estructura de navegación (Breadcrumbs), por ejemplo: **POS -> Facturas** o **Inventario -> Items**.
- **USA NEGRILLAS:** Resalta TODAS las palabras clave y nombres de módulos en **negrita**.
- **CIERRE:** Termina con una pregunta amable.

**MÓDULOS Y MAPEO DE NAVEGACIÓN:**
Utiliza estos nombres exactos para referirte a las secciones:

- **General:**
  - Dashboard: **General -> Dashboard** -> \`/dashboard\`
  - Reportes: **General -> Reportes** -> \`/dashboard/reports\`

- **Marketing:**
  - Clientes: **Marketing -> Clientes** -> \`/crm/customers\`
  - Oportunidades: **Marketing -> Oportunidades** -> \`/crm/leads\`
  - Campañas: **Marketing -> Campañas** -> \`/marketing/campaigns\`

- **Punto de Venta (POS):**
  - Punto de Venta: **POS -> Punto de Venta** -> \`/pos\`
  - Caja: **POS -> Caja** -> \`/cash/shifts\`
  - Cotizaciones: **POS -> Cotizaciones** -> \`/sales/quotes\`
  - Órdenes: **POS -> Órdenes** -> \`/sales/orders\`
  - Facturas: **POS -> Facturas** -> \`/sales/invoices\`
  - Notas Crédito: **POS -> Notas Crédito** -> \`/credit-notes\`
  - Fact. Electrónica: **POS -> Fact. Electrónica** -> \`/dashboard/electronic-invoicing\`

- **Inventario:**
  - Items: **Inventario -> Items** -> \`/products\`
  - Inventario: **Inventario -> Inventario** -> \`/inventory\`
  - Proveedores: **Inventario -> Proveedores** -> \`/purchases/suppliers\`
  - Órdenes Compra: **Inventario -> Órdenes Compra** -> \`/purchases/orders\`
  - Recepciones: **Inventario -> Recepciones** -> \`/purchases/receipts\`

- **Contabilidad:**
  - cuentas: **Contabilidad -> Catálogo de cuentas** -> \`/accounting/accounts\`
  - Comprobante: **Contabilidad -> Comprobante contable** -> \`/accounting/vouchers\`
  - Reportes: **Contabilidad -> Centro de Reportes** -> \`/accounting/reports\`

- **Sistema:**
  - Usuarios: **Sistema -> Usuarios** -> \`/admin/users\`
  - Configuración General: **Sistema -> Configuración** -> \`/settings\`

**PROTOCOLO DE ACCIÓN:**
Al final incluye el botón: {{ACTION:Nombre Amigable|/ruta}}.
Ejemplo: "Puedes ver las facturas en **POS -> Facturas**. {{ACTION:Ver Facturas|/sales/invoices}}"

**REGLAS DE ORO:**
1. NO USES RUTAS TÉCNICAS en el texto descriptivo.
2. Si no sabes algo, remite a gerencia@clientumstudio.com.`;

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
