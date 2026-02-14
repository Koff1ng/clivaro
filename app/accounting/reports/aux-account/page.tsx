
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Printer, Download, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { AccountSelect } from '@/components/accounting/account-select'

export default function AuxAccountReportPage() {
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccount, setSelectedAccount] = useState('')
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [ledgerData, setLedgerData] = useState<any[]>([])

    useEffect(() => {
        fetch('/api/accounting/accounts')
            .then(res => res.json())
            .then(data => setAccounts(flattenAccounts(data)))
    }, [])

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

    const fetchReport = async () => {
        if (!selectedAccount) return
        setLoading(true)
        try {
            const params = new URLSearchParams({
                accountId: selectedAccount,
                startDate,
                endDate
            })
            const res = await fetch(`/api/accounting/reports/aux-account?${params.toString()}`)
            if (res.ok) {
                const results = await res.json()
                setLedgerData(results)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader title="Auxiliar por Cuenta" description="Movimientos detallados y saldos de una cuenta específica." />
                    <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-lg border print:hidden">
                            <div className="md:col-span-1 space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Cuenta Contable</span>
                                <AccountSelect value={selectedAccount} onChange={setSelectedAccount} accounts={accounts} />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Desde</span>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
                            </div>
                            <Button onClick={fetchReport} disabled={loading || !selectedAccount} className="h-9">
                                <Search className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Consultar
                            </Button>
                        </div>

                        {ledgerData.map((account) => (
                            <div key={account.accountId} className="rounded-md border overflow-hidden mt-6">
                                <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-sm uppercase">{account.accountCode} - {account.accountName}</h3>
                                    <span className="text-xs font-bold bg-white px-2 py-1 rounded border">Saldo Inicial: {formatCurrency(account.initialBalance)}</span>
                                </div>
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-bold">FECHA</TableHead>
                                            <TableHead className="text-[10px] font-bold">COMPROBANTE</TableHead>
                                            <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
                                            <TableHead className="text-[10px] font-bold text-right">DÉBITO</TableHead>
                                            <TableHead className="text-[10px] font-bold text-right">CRÉDITO</TableHead>
                                            <TableHead className="text-[10px] font-bold text-right">SALDO CORTE</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {account.movements.map((mov: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-slate-50">
                                                <TableCell className="text-xs">{new Date(mov.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-mono text-[10px] text-blue-700 font-bold">{mov.entryNumber}</TableCell>
                                                <TableCell className="text-xs">{mov.description}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{mov.debit > 0 ? formatCurrency(mov.debit) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{mov.credit > 0 ? formatCurrency(mov.credit) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold">{formatCurrency(mov.balance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <div className="p-3 bg-slate-50 text-xs font-bold flex justify-end gap-8 border-t">
                                        <span>TOTAL DÉBITOS: {formatCurrency(account.totalDebits)}</span>
                                        <span>TOTAL CRÉDITOS: {formatCurrency(account.totalCredits)}</span>
                                        <span className="text-blue-700">SALDO FINAL: {formatCurrency(account.finalBalance)}</span>
                                    </div>
                                </Table>
                            </div>
                        ))}

                        {ledgerData.length === 0 && !loading && (
                            <div className="text-center py-20 text-slate-400 border rounded-md">
                                Selecciona una cuenta y presiona Consultar para ver el detalle.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
