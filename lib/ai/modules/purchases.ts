import { aiClient } from '../client';

/**
 * Purchases AI module for supplier evaluation and planning.
 */
export const purchasesAI = {
    /**
     * Evaluates suppliers based on performance data.
     */
    async evaluateSuppliers(data: {
        suppliers: {
            name: string;
            avgLeadTime: number;
            fulfillmentRate: number; // 0-1
            pricesCompetitiveness: number; // 1-10
        }[]
    }) {
        const context = `
      LISTA DE PROVEEDORES:
      ${data.suppliers.map(s =>
            `- ${s.name}: Entrega Promedio ${s.avgLeadTime} días, Cumplimiento ${(s.fulfillmentRate * 100).toFixed(0)}%, Competitividad Precio ${s.pricesCompetitiveness}/10`
        ).join('\n')}
    `;

        const ranking = await aiClient.complete(
            `Genera un ranking de los 3 mejores proveedores y una recomendación de quién necesita renegociación:\n${context}`,
            'smart',
            'Eres un Gerente de Abastecimiento con visión estratégica.'
        );

        return { ranking };
    }
};
