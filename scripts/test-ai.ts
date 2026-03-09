import { GroqERP } from "../lib/ai/groq-erp";
import { prisma } from "../lib/db";
import * as dotenv from "dotenv";

dotenv.config();

async function testGroq() {
    console.log("🚀 Iniciando prueba de conexión con Groq...");

    const apiKey = process.env.GROQ_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!apiKey || !supabaseUrl || !supabaseKey) {
        console.error("❌ Faltan variables de entorno (GROQ_API_KEY, SUPABASE_URL, o SUPABASE_ANON_KEY)");
        process.exit(1);
    }

    const groq = new GroqERP(apiKey, prisma, supabaseUrl, supabaseKey);

    try {
        console.log("📡 Enviando mensaje de prueba...");
        const response = await groq.asistente("Hola, ¿estás listo para ayudarme con el ERP?");
        console.log("\n🤖 Respuesta de la IA:");
        console.log("------------------------");
        console.log(response);
        console.log("------------------------\n");
        console.log("✅ Prueba completada con éxito. La integración está operativa.");
    } catch (error: any) {
        console.error("❌ Error en la prueba:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testGroq();
