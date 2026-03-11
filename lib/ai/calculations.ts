/**
 * Pure TypeScript mathematical and statistical logic for ERP analysis.
 * No LLM calls here, only raw numbers.
 */

export const aiCalculations = {
    /**
     * Simple Linear Regression for Sales Projection
     * Returns projected value for the next 'n' periods
     */
    projectSales(historicalData: { date: Date; amount: number }[], periodsForward: number = 7) {
        if (historicalData.length < 2) return null;

        const n = historicalData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += historicalData[i].amount;
            sumXY += i * historicalData[i].amount;
            sumXX += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const projections: { period: number; projectedAmount: number }[] = [];
        for (let i = 1; i <= periodsForward; i++) {
            projections.push({
                period: n + i,
                projectedAmount: Math.max(0, slope * (n + i) + intercept)
            });
        }

        return { slope, intercept, projections };
    },

    /**
     * Dynamic Reorder Point (ROP)
     * ROP = (Average Daily Usage * Lead Time) + Safety Stock
     */
    calculateReorderPoint(avgDailyUsage: number, leadTimeDays: number, stdDevUsage: number, serviceLevelZ: number = 1.645) {
        const safetyStock = serviceLevelZ * Math.sqrt(leadTimeDays) * stdDevUsage;
        return (avgDailyUsage * leadTimeDays) + safetyStock;
    },

    /**
     * Anomaly Detection (Z-Score)
     * Detects if a value deviates significantly from the mean
     */
    detectAnomaly(value: number, history: number[], threshold: number = 2.5) {
        if (history.length < 5) return false;

        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const stdDev = Math.sqrt(history.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / history.length);

        if (stdDev === 0) return false;

        const zScore = Math.abs((value - mean) / stdDev);
        return {
            isAnomaly: zScore > threshold,
            zScore,
            deviation: ((value - mean) / mean) * 100
        };
    },

    /**
     * Lead Scoring (0-100)
     * Based on interactions, source, and historical conversion
     */
    scoreLead(data: { interactions: number; daysSinceLastContact: number; sourceQuality: number }) {
        let score = 0;

        // Interaction weight (max 40)
        score += Math.min(40, data.interactions * 5);

        // Recency weight (max 30)
        const recencyPenalty = Math.min(30, data.daysSinceLastContact * 2);
        score += (30 - recencyPenalty);

        // Source quality (max 30) - 1 to 10 scale
        score += (data.sourceQuality * 3);

        return Math.min(100, Math.max(0, score));
    },

    /**
     * Churn Score
     * Estimated probability that a customer will stop buying
     */
    calculateChurnProbability(daysSinceLastPurchase: number, avgPurchaseInterval: number) {
        if (avgPurchaseInterval === 0) return 0;

        const ratio = daysSinceLastPurchase / avgPurchaseInterval;
        // Sigmoid-like curve for probability
        const probability = 1 / (1 + Math.exp(-(ratio - 2) * 2));

        return probability;
    }
};
