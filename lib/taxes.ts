export interface TaxRateInfo {
    id: string
    name: string
    rate: number
    type: string
}

export interface TaxCalculationResult {
    baseAmount: number
    taxes: {
        taxRateId: string
        name: string
        rate: number
        amount: number
    }[]
    totalTax: number
}

/**
 * Calculates granular taxes for a base amount given a list of tax rates.
 * Colombia specific: Usually taxes are calculated on the same base.
 */
export function calculateGranularTaxes(
    baseAmount: number,
    rates: TaxRateInfo[]
): TaxCalculationResult {
    const taxes = rates.map(r => {
        // In Colombia, most taxes (IVA, ICA, Retente) are calculated on the Net Base
        // Retentions are subtractive, so we apply a negative sign to the amount
        let multiplier = 1
        if (r.type && (r.type.startsWith('RETE') || r.type === 'RETENTION')) {
            multiplier = -1
        }

        // Rounding to 2 decimal places is standard for financial docs in COL
        const amount = Math.round((baseAmount * r.rate * multiplier) / 100 * 100) / 100

        return {
            taxRateId: r.id,
            name: r.name,
            rate: r.rate, // Keep rate positive for display
            amount
        }
    })

    const totalTax = taxes.reduce((sum, t) => sum + t.amount, 0)

    return {
        baseAmount: Math.round(baseAmount * 100) / 100,
        taxes,
        totalTax: Math.round(totalTax * 100) / 100
    }
}
