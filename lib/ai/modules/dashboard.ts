import { aiClient } from '../client';
import { aiCalculations } from '../calculations';
import { aiCache } from '../cache';

/**
 * Dashboard AI module for daily summaries and forecasts.
 */
export const dashboardAI = {
    /**
     * Generates a daily insight summary for the manager.
     */
    async getDailyInsight(tenantId: string, data: {
        sales: { date: Date; amount: number }[],
        expenses: number,
        topProducts: { name: string; sales: number }[],
        pendingTasks: number
    }) {
        const cacheKey = `dashboard_insight_${tenantId}_${new Date().toISOString().split('T')[0]}`;
        const cached = aiCache.get<string>(cacheKey);
        if (cached) return cached;

        // 1. Calculate forecast
        const forecast = aiCalculations.projectSales(data.sales, 7);

        // 2. Build prompt context
        const context = `
      RESUMEN FINANCIERO:
      - Ventas hoy: $${data.sales[data.sales.length - 1]?.amount || 0}
      - Gastos totales: $${data.expenses}
      - Margen bruto estimado: $${(data.sales.reduce((a, b) => a + b.amount, 0) - data.expenses).toFixed(2)}
      
      FORECAST (PRÓXIMOS 7 DÍAS):
      ${forecast?.projections.map(p => `- Día ${p.period}: $${p.projectedAmount.toFixed(2)}`).join('\n') || 'No disponible'}
      Tendencia (Pendiente): ${forecast && forecast.slope !== undefined ? (forecast.slope > 0 ? 'Creciente' : 'Decreciente') + ' (' + forecast.slope.toFixed(2) + ')' : 'Estable'}
      
      PRODUCTOS MÁS VENDIDOS:
      ${data.topProducts.map(p => `- ${p.name}: ${p.sales} unidades`).join('\n')}
      
      OPERACIONES:
      - Tareas pendientes: ${data.pendingTasks}
    `;

        const systemPrompt = `Eres un analista experto en negocios y ERP. Tu tarea es narrar los resultados estadísticos de manera accionable y estratégica para el dueño del negocio. Sé breve, profesional y directo. No menciones que eres una IA.`;

        const insight = await aiClient.complete(
            `Analiza estos datos y genera un 'Manager Insight' de máximo 2 párrafos:\n${context}`,
            'smart',
            systemPrompt
        );

        aiCache.set(cacheKey, insight, 14400); // 4 hours cache for daily summary
        return insight;
    }
};
