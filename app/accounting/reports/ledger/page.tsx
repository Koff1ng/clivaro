
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Printer, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function LedgerReportPage() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any[]>([])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const fetchLedger = async () => {
        setLoading(true)
        const params = new URLSearchParams({
            asOfDate: endDate
        })

        try {
            const res = await fetch(`/api/accounting/reports/ledger?date=${endDate}`)
            if (res.ok) {
                const results = await res.json()
                setData(results.accounts)
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

    useEffect(() => {
        fetchLedger()
    }, [])

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader title="Libro Mayor y Balance" description="Resumen de saldos acumulados por cuenta contable." />
                    <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border print:hidden">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Corte a fecha</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-44" />
                            </div>
                            <Button onClick={fetchLedger} disabled={loading} className="h-9">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar Libro
                            </Button>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold">CÓDIGO</TableHead>
                                        <TableHead className="text-xs font-bold">DESCRIPCIÓN DE LA CUENTA</TableHead>
                                        <TableHead className="text-xs font-bold text-right">DÉBITO</TableHead>
                                        <TableHead className="text-xs font-bold text-right">CRÉDITO</TableHead>
                                        <TableHead className="text-xs font-bold text-right">SALDO DÉBITO</TableHead>
                                        <TableHead className="text-xs font-bold text-right">SALDO CRÉDITO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-20">Procesando saldos...</TableCell></TableRow>
                                    ) : (
                                        data.map((acc) => (
                                            <TableRow key={acc.code} className={acc.code.length <= 2 ? "bg-slate-50 font-bold" : ""}>
                                                <TableCell className="text-xs font-mono">{acc.code}</TableCell>
                                                <TableCell className="text-xs uppercase">{acc.name}</TableCell>
                                                <TableCell className="text-right text-xs font-mono">{formatCurrency(acc.debit)}</TableCell>
                                                <TableCell className="text-right text-xs font-mono">{formatCurrency(acc.credit)}</TableCell>
                                                <TableCell className="text-right text-xs font-mono font-bold">{formatCurrency(acc.debitBalance)}</TableCell>
                                                <TableCell className="text-right text-xs font-mono font-bold">{formatCurrency(acc.creditBalance)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
