import { aiClient } from '../client';
import { aiCalculations } from '../calculations';

/**
 * POS AI module for cross-selling and anomaly detection.
 */
export const posAI = {
    /**
     * Checks for anomalies in cash shifts and suggests items for cross-selling.
     */
    async analyzeSession(data: {
        currentShift: { total: number; cashHistory: number[] },
        cart: { productName: string; category: string }[],
        recommendationContext: { category: string; productName: string }[]
    }) {
        // 1. Anomaly Detection
        const anomaly = aiCalculations.detectAnomaly(
            data.currentShift.total,
            data.currentShift.cashHistory
        );

        // 2. Cross-selling Context
        const cartCategories = data.cart.map(i => i.category);
        const suggestions = data.recommendationContext
            .filter(item => !cartCategories.includes(item.category))
            .slice(0, 3);

        const context = `
      SESIÓN ACTUAL:
      - Total Turno: $${data.currentShift.total}
      - Alerta Anomalía: ${anomaly ? (anomaly.isAnomaly ? 'SÍ (Desviación Z: ' + anomaly.zScore.toFixed(2) + ')' : 'NO') : 'N/A'}
      
      CARRITO ACTUAL:
      ${data.cart.map(i => `- ${i.productName} (${i.category})`).join('\n')}
    `;

        const assistantPitch = await aiClient.complete(
            `Genera un 'script de venta' breve (1 frase) para sugerir estos productos adicionales: ${suggestions.map(s => s.productName).join(', ')}. Contexto:\n${context}`,
            'fast',
            'Eres un cajero proactivo y persuasivo en un Punto de Venta.'
        );

        return {
            anomaly,
            suggestions,
            assistantPitch
        };
    }
};
