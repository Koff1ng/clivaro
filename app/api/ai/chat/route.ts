import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GroqERP } from "@/lib/ai/groq-erp";
import { prisma as masterPrisma } from "@/lib/db";
import { getPrismaForRequest } from "@/lib/get-tenant-prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;

    try {
        const { message, history, context: userContext } = await req.json();

        // Obtener prisma con scope de tenant
        const prisma = await getPrismaForRequest(req, session);

        console.log("[AI_CHAT] Request received for tenant:", tenantId);

        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY no encontrada en el servidor");
        }

        const groq = new GroqERP(
            process.env.GROQ_API_KEY,
            prisma,
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );

        // --- Descubrimiento de Contexto (Simple RAG) ---
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
            } else {
                discoveredContext += "\nNo se encontraron productos en el inventario.";
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

        const response = await groq.asistente(message, history, fullContext);

        // Guardar log de forma asíncrona
        groq.guardarLog(session.user?.id as string, "chat", message, response);

        return NextResponse.json({ response });
    } catch (error: any) {
        console.error("[AI_CHAT_ERROR]", error);
        return NextResponse.json(
            { error: error.message || "Error al procesar la solicitud de IA" },
            { status: 500 }
        );
    }
}
