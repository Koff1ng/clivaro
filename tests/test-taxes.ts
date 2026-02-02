import { calculateGranularTaxes, TaxRateInfo } from '../lib/taxes'

function testTaxCalculations() {
    const base = 100000 // 100,000 COP

    const rates: TaxRateInfo[] = [
        { id: 'tax-iva', name: 'IVA 19%', rate: 19, type: 'IVA' },
        { id: 'tax-ica', name: 'ICA 0.966%', rate: 0.966, type: 'ICA' },
        { id: 'tax-ret', name: 'Retefuente 2.5%', rate: -2.5, type: 'WHT' } // Negative for deductions
    ]

    const result = calculateGranularTaxes(base, rates)

    console.log('--- Tax Calculation Test ---')
    console.log(`Base: ${result.baseAmount}`)
    result.taxes.forEach(t => {
        console.log(`- ${t.name}: ${t.amount} (${t.rate}%)`)
    })
    console.log(`Total Tax Effect: ${result.totalTax}`)
    console.log(`Final Total (Theoretical): ${result.baseAmount + result.totalTax}`)

    // Assertions (mental or console)
    // IVA: 19000
    // ICA: 966
    // Ret: -2500
    // Total Tax: 19000 + 966 - 2500 = 17466
}

testTaxCalculations()
