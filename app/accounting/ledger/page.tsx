'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountSelect } from '@/components/accounting/account-select'
import { Book, Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type AccountBalance = {
    accountId: string
    accountCode: string
    accountName: string
    accountType: string
    initialBalance: number
    totalDebits: number
    totalCredits: number
    finalBalance: number
    movements: Array<{
        date: string
        entryNumber: string
        description: string
        debit: number
        credit: number
        balance: number
    }>
}

export default function GeneralLedgerPage() {
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccount, setSelectedAccount] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [ledgerData, setLedgerData] = useState<AccountBalance[]>([])
    const [loading, setLoading] = useState(false)

    // Load accounts on mount
    useEffect(() => {
        loadAccounts()
    }, [])

    async function loadAccounts() {
        try {
            const res = await fetch('/api/accounting/accounts')
            if (!res.ok) throw new Error('Failed to load accounts')
            const data = await res.json()
            setAccounts(flattenAccounts(data))
        } catch (error) {
            console.error('Error loading accounts:', error)
        }
    }

    function flattenAccounts(tree: any[]): any[] {
        const flat: any[] = []
        function traverse(nodes: any[]) {
            nodes.forEach((node: any) => {
                flat.push(node)
                if (node.children) traverse(node.children)
            })
        }
        traverse(tree)
        return flat
    }

    async function handleQuery() {
        if (!selectedAccount && !startDate && !endDate) {
            return // Require at least one filter
        }

        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedAccount) params.append('accountId', selectedAccount)
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)

            const res = await fetch(`/api/accounting/ledger?${params}`)
            if (!res.ok) throw new Error('Failed to load ledger')
            const data = await res.json()
            setLedgerData(data)
        } catch (error) {
            console.error('Error loading ledger:', error)
            alert('Error al cargar el Libro Mayor')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <PageHeader
                title="Libro Mayor"
                description="Consulta de movimientos y saldos por cuenta contable"
                icon={<Book className="h-6 w-6" />}
            />

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Cuenta (Opcional)</label>
                        <AccountSelect
                            value={selectedAccount}
                            onChange={setSelectedAccount}
                            accounts={accounts}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Fecha Desde</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Fecha Hasta</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button onClick={handleQuery} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Consultar
                    </Button>
                    <Button variant="outline" disabled>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Results */}
            {ledgerData.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-12">
                    <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecciona filtros y presiona Consultar</p>
                </div>
            )}

            {ledgerData.map((account) => (
                <div key={account.accountId} className="bg-white rounded-lg shadow mb-6 overflow-hidden">
                    <div className="bg-slate-100 px-6 py-3 border-b">
                        <h2 className="font-semibold text-lg">
                            {account.accountCode} - {account.accountName}
                        </h2>
                        <p className="text-sm text-gray-600">
                            Tipo: {account.accountType}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Fecha</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Comprobante</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Descripción</th>
                                    <th className="px-4 py-2 text-right text-sm font-medium">Débito</th>
                                    <th className="px-4 py-2 text-right text-sm font-medium">Crédito</th>
                                    <th className="px-4 py-2 text-right text-sm font-medium">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {account.initialBalance !== 0 && (
                                    <tr className="bg-blue-50">
                                        <td className="px-4 py-2" colSpan={3}>
                                            <strong>Saldo Inicial</strong>
                                        </td>
                                        <td className="px-4 py-2 text-right" colSpan={2}></td>
                                        <td className="px-4 py-2 text-right font-semibold">
                                            ${account.initialBalance.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                )}
                                {account.movements.map((mov, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm">
                                            {format(new Date(mov.date), 'dd/MM/yyyy', { locale: es })}
                                        </td>
                                        <td className="px-4 py-2 text-sm">{mov.entryNumber}</td>
                                        <td className="px-4 py-2 text-sm">{mov.description}</td>
                                        <td className="px-4 py-2 text-right text-sm">
                                            {mov.debit > 0
                                                ? `$${mov.debit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm">
                                            {mov.credit > 0
                                                ? `$${mov.credit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-medium">
                                            ${mov.balance.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-100 font-semibold">
                                    <td className="px-4 py-2" colSpan={3}>
                                        TOTALES
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        ${account.totalDebits.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        ${account.totalCredits.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        ${account.finalBalance.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    )
}
