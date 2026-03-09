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

        const groq = new GroqERP(
            process.env.GROQ_API_KEY!,
            prisma,
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );

        const fullContext = `
      User: ${session.user?.name}
      Email: ${session.user?.email}
      Tenant: ${(session.user as any).tenantSlug || 'Master'}
      Roles: ${(session.user as any).roles?.join(', ') || 'None'}
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
