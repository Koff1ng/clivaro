import { aiClient } from '../client';
import { aiCalculations } from '../calculations';

/**
 * CRM AI module for lead scoring and customer churn prediction.
 */
export const crmAI = {
    /**
     * Scores leads and predicts churn for a batch of customers.
     */
    async analyzeLeadsAndCustomers(data: {
        leads: { id: string; name: string; interactions: number; lastContactDays: number; sourceQuality: number }[],
        customers: { id: string; name: string; lastPurchaseDays: number; avgInterval: number }[]
    }) {
        const leadScores = data.leads.map(l => ({
            ...l,
            score: aiCalculations.scoreLead({
                interactions: l.interactions,
                daysSinceLastContact: l.lastContactDays,
                sourceQuality: l.sourceQuality
            })
        }));

        const churnRisks = data.customers.map(c => ({
            ...c,
            churnProbability: aiCalculations.calculateChurnProbability(c.lastPurchaseDays, c.avgInterval)
        }));

        const context = `
      TOP LEADS (POTENCIALES):
      ${leadScores.sort((a, b) => b.score - a.score).slice(0, 5).map(l =>
            `- ${l.name}: Score ${l.score}/100`
        ).join('\n')}
      
      CLIENTES EN RIESGO DE FUGA (CHURN):
      ${churnRisks.filter(c => c.churnProbability > 0.7).map(c =>
            `- ${c.name}: Probabilidad Churn ${(c.churnProbability * 100).toFixed(0)}%`
        ).join('\n')}
    `;

        const nextActions = await aiClient.complete(
            `Basado en este análisis CRM, sugiere la 'Siguiente Mejor Acción' para los 3 casos más urgentes:\n${context}`,
            'smart',
            'Eres un VP de Ventas enfocado en retención y conversión.'
        );

        return { leadScores, churnRisks, nextActions };
    }
};
