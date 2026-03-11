import { aiClient } from '../client';
import { aiCalculations } from '../calculations';

/**
 * Inventory AI module for stock optimization and waste analysis.
 */
export const inventoryAI = {
    /**
     * Analyzes stock rotation and identifies reorder risks.
     */
    async analyzeStockStatus(data: {
        products: {
            id: string;
            name: string;
            stock: number;
            avgDailyUsage: number;
            leadTime: number;
            stdDevUsage: number;
            percentageMerma: number;
        }[]
    }) {
        const results = data.products.map(p => {
            const reorderPoint = aiCalculations.calculateReorderPoint(
                p.avgDailyUsage,
                p.leadTime,
                p.stdDevUsage
            );

            const status = p.stock <= reorderPoint ? 'REORDER' : (p.stock <= reorderPoint * 1.5 ? 'WARNING' : 'OK');

            return {
                ...p,
                reorderPoint,
                status,
                mermaImpact: p.percentageMerma > 10 ? 'HIGH' : 'LOW'
            };
        });

        const context = `
      ESTADO DE INVENTARIO CRÍTICO:
      ${results.filter(r => r.status !== 'OK').map(r =>
            `- ${r.name}: Stock ${r.stock}, Punto Reorden ${r.reorderPoint.toFixed(1)} [${r.status}]`
        ).join('\n')}
      
      IMPACTO POR MERMA:
      ${results.filter(r => r.mermaImpact === 'HIGH').map(r =>
            `- ${r.name}: Merma del ${r.percentageMerma}%`
        ).join('\n')}
    `;

        const summary = await aiClient.complete(
            `Genera una breve recomendación de compras basada en estos datos de inventario:\n${context}`,
            'fast',
            'Eres un jefe de compras experto. Tu objetivo es optimizar el stock y reducir mermas.'
        );

        return { results, summary };
    }
};
