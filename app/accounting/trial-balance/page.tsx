'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Scale, Download, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type TrialBalanceAccount = {
    code: string
    name: string
    type: string
    debit: number
    credit: number
    debitBalance: number
    creditBalance: number
}

type TrialBalanceData = {
    accounts: TrialBalanceAccount[]
    totals: {
        totalDebits: number
        totalCredits: number
        totalDebitBalance: number
        totalCreditBalance: number
    }
}

export default function TrialBalancePage() {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [data, setData] = useState<TrialBalanceData | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleQuery() {
        setLoading(true)
        try {
            const params = new URLSearchParams({ date })
            const res = await fetch(`/api/accounting/trial-balance?${params}`)
            if (!res.ok) throw new Error('Failed to load trial balance')
            const result = await res.json()
            setData(result)
        } catch (error) {
            console.error('Error loading trial balance:', error)
            alert('Error al cargar el Balance de Prueba')
        } finally {
            setLoading(false)
        }
    }

    const isBalanced =
        data && Math.abs(data.totals.totalDebits - data.totals.totalCredits) < 0.01

    return (
        <div className="container mx-auto px-4 py-6">
            <PageHeader
                title="Balance de Prueba"
                description="Verificación de partida doble y saldos contables"
                icon={<Scale className="h-6 w-6" />}
            />

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">Fecha de Corte</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleQuery} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar Balance
                    </Button>
                    <Button variant="outline" disabled>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Balance Status */}
            {data && (
                <div
                    className={`rounded-lg p-4 mb-6 flex items-center gap-3 ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}
                >
                    {isBalanced ? (
                        <>
                            <CheckCircle className="h-6 w-6 text-green-600" />
                            <div>
                                <p className="font-semibold text-green-900">Balance Correcto</p>
                                <p className="text-sm text-green-700">
                                    Los débitos y créditos coinciden perfectamente
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle className="h-6 w-6 text-red-600" />
                            <div>
                                <p className="font-semibold text-red-900">Balance  Desbalanceado</p>
                                <p className="text-sm text-red-700">
                                    Diferencia: $
                                    {Math.abs(data.totals.totalDebits - data.totals.totalCredits).toLocaleString('es-CO', {
                                        minimumFractionDigits: 2,
                                    })}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Results Table */}
            {data && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Código</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Cuenta</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Tipo</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Débito</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Crédito</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo Deudor</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo Acreedor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.accounts.map((account, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-2 font-mono text-sm">{account.code}</td>
                                        <td className="px-4 py-2 text-sm">{account.name}</td>
                                        <td className="px-4 py-2 text-center text-xs">
                                            <span className="px-2 py-1 bg-gray-100 rounded">
                                                {account.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm">
                                            ${account.debit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm">
                                            ${account.credit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-medium">
                                            {account.debitBalance > 0
                                                ? `$${account.debitBalance.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-medium">
                                            {account.creditBalance > 0
                                                ? `$${account.creditBalance.toLocaleString('es-CO', {
                                                    minimumFractionDigits: 2,
                                                })}`
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                                    <td className="px-4 py-3" colSpan={3}>
                                        TOTALES
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        ${data.totals.totalDebits.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        ${data.totals.totalCredits.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        $
                                        {data.totals.totalDebitBalance.toLocaleString('es-CO', {
                                            minimumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        $
                                        {data.totals.totalCreditBalance.toLocaleString('es-CO', {
                                            minimumFractionDigits: 2,
                                        })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 text-sm text-gray-600">
                        <p>
                            <strong>Nota Legal:</strong> Este balance de prueba es un documento auxiliar para verificación interna.
                            Los estados financieros oficiales deben ser preparados según las Normas Internacionales de
                            Información Financiera (NIIF/IFRS) aplicables en Colombia.
                        </p>
                    </div>
                </div>
            )}

            {!data && !loading && (
                <div className="text-center text-gray-500 py-12">
                    <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecciona una fecha y presiona Generar Balance</p>
                </div>
            )}
        </div>
    )
}
