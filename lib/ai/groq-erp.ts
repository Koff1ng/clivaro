import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type GroqModel = "fast" | "smart" | "mixtral";

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface GroqResponse {
    choices: { message: { content: string } }[];
}

export interface AnalysisResult {
    summary: string;
    insights: string[];
    recommendations: string[];
    raw: string;
}

export interface DocumentResult {
    title: string;
    content: string;
    createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ─────────────────────────────────────────────────────────────

export class GroqERP {
    private apiKey: string;
    private apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    private defaultModel: string;
    private prisma: PrismaClient;
    private supabase: ReturnType<typeof createClient>;

    private models: Record<GroqModel, string> = {
        fast: "llama-3.1-8b-instant",      // Respuestas simples y rápidas
        smart: "llama-3.3-70b-versatile",  // Tareas complejas y razonamiento
        mixtral: "mixtral-8x7b-32768",     // Contexto largo (32k tokens)
    };

    constructor(
        apiKey: string,
        prisma: PrismaClient,
        supabaseUrl: string,
        supabaseKey: string,
        model: GroqModel = "smart"
    ) {
        this.apiKey = apiKey;
        this.prisma = prisma;
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.defaultModel = this.models[model];
    }

    // ─────────────────────────────────────────────────────────────
    // MÉTODO BASE
    // ─────────────────────────────────────────────────────────────

    private async chat(
        messages: ChatMessage[],
        model?: string,
        temperature = 0.7
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error("Groq API Key no configurada.");
        }

        const selectedModel = model ?? this.defaultModel;
        console.log(`[GROQ_ERP] Sending request to ${selectedModel}...`);

        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages,
                    temperature,
                    max_tokens: 2048,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData?.error?.message || response.statusText || "Unknown Groq error";
                console.error(`[GROQ_ERP] API Error (${response.status}):`, msg);
                throw new Error(`Groq API Error: ${msg} (${response.status})`);
            }

            const data: GroqResponse = await response.json();
            return data.choices[0]?.message?.content ?? "";
        } catch (error: any) {
            console.error("[GROQ_ERP] Fetch/Network Error:", error.message);
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. ASISTENTE GENERAL DEL ERP
    // ─────────────────────────────────────────────────────────────

    /**
     * Asistente con contexto del ERP e historial de conversación.
     */
    async asistente(
        userMessage: string,
        history: ChatMessage[] = [],
        erpContext = ""
    ): Promise<string> {
        let systemPrompt = `Eres un asistente inteligente integrado en un ERP empresarial avanzado.
    Ayudas con consultas sobre inventario, ventas, compras, contabilidad y RRHH.
    Responde siempre en español, de forma clara, profesional y concisa.
    
    PROTOCOLO DE ACCIÓN:
    Cuando el usuario mencione querer crear algo o ir a un módulo, SIEMPRE ofrece un botón de acción al final de tu respuesta usando este formato exacto:
    {{ACTION:Texto del Botón|/ruta/del/modulo}}
    
    Ejemplos de rutas comunes:
    - Crear Item (Producto/Servicio): /products?new=item
    - Ver Catálogo de Items: /products
    - Ver Facturas: /sales/invoices
    - Nueva Orden de Venta: /sales/orders/new
    - Ver Órdenes de Venta: /sales/orders
    - Punto de Venta (POS): /pos
    - Ver Clientes: /crm/customers
    - Nuevo Cliente: /crm/customers/new
    - Ver Usuarios/Roles: /admin/users
    
    Si el usuario tiene dudas técnicas sobre el sistema, ayuda con precisión.`;

        if (erpContext) systemPrompt += `\n\nContexto actual del sistema: ${erpContext}`;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userMessage },
        ];

        return this.chat(messages);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ANÁLISIS DE DATOS
    // ─────────────────────────────────────────────────────────────

    /**
     * Analiza datos y retorna insights estructurados.
     */
    async analizarDatos(
        data: unknown,
        tipoReporte: string
    ): Promise<AnalysisResult> {
        const dataStr = JSON.stringify(data, null, 2);

        const messages: ChatMessage[] = [
            {
                role: "system",
                content: `Eres un analista de negocios experto. Analiza los datos proporcionados y responde 
        ÚNICAMENTE en formato JSON con la siguiente estructura:
        {
          "summary": "resumen ejecutivo",
          "insights": ["insight 1", "insight 2"],
          "recommendations": ["recomendacción 1", "recomendación 2"]
        }`,
            },
            {
                role: "user",
                content: `Analiza estos datos de ${tipoReporte}:\n\n${dataStr}`,
            },
        ];

        const raw = await this.chat(messages, this.models.smart, 0.3);

        try {
            // Limpiar posible markdown del JSON si la IA lo incluye
            const jsonStr = raw.replace(/```json\n|```/g, "").trim();
            const parsed = JSON.parse(jsonStr);
            return { ...parsed, raw };
        } catch {
            return {
                summary: raw,
                insights: [],
                recommendations: [],
                raw,
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. GENERACIÓN DE DOCUMENTOS
    // ─────────────────────────────────────────────────────────────

    /**
     * Genera un documento y lo guarda en Supabase Storage si se desea.
     */
    async generarDocumento(
        tipoDocumento: string,
        datos: Record<string, unknown>,
        bucket = "erp-documentos"
    ): Promise<DocumentResult> {
        const messages: ChatMessage[] = [
            {
                role: "system",
                content: `Eres un experto en redacción empresarial formal. 
        Genera documentos profesionales y legales en español.`,
            },
            {
                role: "user",
                content: `Genera un ${tipoDocumento} con estos datos:
        ${JSON.stringify(datos, null, 2)}`,
            },
        ];

        const content = await this.chat(messages, this.models.smart, 0.4);
        const createdAt = new Date();
        const fileName = `${tipoDocumento}-${createdAt.getTime()}.txt`;

        try {
            const { error } = await this.supabase.storage
                .from(bucket)
                .upload(fileName, content, { contentType: "text/plain; charset=utf-8" });
            if (error) console.warn("Supabase Storage error:", error.message);
        } catch (e) {
            console.warn("No se pudo conectar con Supabase Storage para guardar el documento.");
        }

        return {
            title: `${tipoDocumento} - ${createdAt.toLocaleDateString("es-CO")}`,
            content,
            createdAt,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. CLASIFICACIÓN Y EXTRACCIÓN
    // ─────────────────────────────────────────────────────────────

    async clasificar(texto: string, categorias: string[]): Promise<string> {
        const messages: ChatMessage[] = [
            {
                role: "system",
                content: `Clasifica el texto en UNA de estas categorías: ${categorias.join(", ")}.
        Responde ÚNICAMENTE con el nombre exacto de la categoría, sin explicaciones.`,
            },
            { role: "user", content: texto },
        ];

        return (await this.chat(messages, this.models.fast, 0.1)).trim().toLowerCase();
    }

    async extraerDatos<T = Record<string, unknown>>(
        texto: string,
        esquema: Record<string, string>
    ): Promise<T> {
        const esquemaStr = JSON.stringify(esquema, null, 2);

        const messages: ChatMessage[] = [
            {
                role: "system",
                content: `Extrae información y responde ÚNICAMENTE en JSON válido: ${esquemaStr}`,
            },
            { role: "user", content: texto },
        ];

        const raw = await this.chat(messages, this.models.fast, 0.1);
        const jsonStr = raw.replace(/```json\n|```/g, "").trim();
        return JSON.parse(jsonStr) as T;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. RESUMEN
    // ─────────────────────────────────────────────────────────────

    async resumir(registros: unknown[], descripcion: string): Promise<string> {
        const messages: ChatMessage[] = [
            {
                role: "system",
                content: "Eres un asistente de negocios. Resume datos de forma concisa en español.",
            },
            {
                role: "user",
                content: `Resume estos ${descripcion}:\n\n${JSON.stringify(registros, null, 2)}`,
            },
        ];

        return this.chat(messages, this.models.fast, 0.5);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. LOGS
    // ─────────────────────────────────────────────────────────────

    async guardarLog(
        userId: string,
        module: string,
        prompt: string,
        response: string
    ): Promise<void> {
        try {
            await (this.supabase.from("ai_logs") as any).insert({
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
}
