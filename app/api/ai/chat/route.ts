import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GroqERP } from "@/lib/ai/groq-erp";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const { message, history, context } = await req.json();

        console.log("[AI_CHAT] Request received:", { message, historyLength: history?.length });
        console.log("[AI_CHAT] Env check:", {
            hasApiKey: !!process.env.GROQ_API_KEY,
            hasSupaUrl: !!process.env.SUPABASE_URL,
            hasSupaKey: !!process.env.SUPABASE_ANON_KEY
        });

        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY no encontrada en el servidor");
        }

        const groq = new GroqERP(
            process.env.GROQ_API_KEY,
            prisma,
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );

        const userRoles = (session.user as any).roles;
        const rolesStr = Array.isArray(userRoles) ? userRoles.join(', ') : 'Ninguno';

        const fullContext = `
      User: ${session.user?.name}
      Email: ${session.user?.email}
      Tenant: ${(session.user as any).tenantSlug || 'Master'}
      Roles: ${rolesStr}
      ${context || ''}
    `.trim();

        const response = await groq.asistente(message, history, fullContext);

        return NextResponse.json({ response });
    } catch (error: any) {
        console.error("[AI_CHAT_ERROR]", error);
        return NextResponse.json(
            { error: error.message || "Error al procesar la solicitud de IA" },
            { status: 500 }
        );
    }
}
