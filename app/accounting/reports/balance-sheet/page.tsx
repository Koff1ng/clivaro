
'use client'

import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Printer, Download, Landmark } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function BalanceSheetReportPage() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any[]>([])
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    const fetchReport = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/accounting/reports/balance-sheet?date=${date}`)
            if (res.ok) {
                const results = await res.json()
                setData(results)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const contentRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: 'Balance General',
    })

    useEffect(() => {
        fetchReport()
    }, [])

    const totalAssets = data.filter(a => a.code.startsWith('1')).reduce((sum, a) => sum + (a.code.length === 1 ? a.balance : 0), 0)
    const totalLiabilities = data.filter(a => a.code.startsWith('2')).reduce((sum, a) => sum + (a.code.length === 1 ? a.balance : 0), 0)
    const totalEquity = data.filter(a => a.code.startsWith('3')).reduce((sum, a) => sum + (a.code.length === 1 ? a.balance : 0), 0)

    return (
        <MainLayout>
            <div className="space-y-6" ref={contentRef}>
                <div className="flex justify-between items-center">
                    <PageHeader title="Balance General" description="Estado de situación financiera (Activos, Pasivos y Patrimonio)." />
                    <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border print:hidden">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Fecha de Corte</span>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-44" />
                            </div>
                            <Button onClick={fetchReport} disabled={loading} className="h-9">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Generar Balance
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-blue-600 uppercase">Total Activos</div>
                                    <div className="text-2xl font-bold">{formatCurrency(totalAssets)}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50 border-red-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-red-600 uppercase">Total Pasivos</div>
                                    <div className="text-2xl font-bold">{formatCurrency(totalLiabilities)}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-green-600 uppercase">Total Patrimonio</div>
                                    <div className="text-2xl font-bold">{formatCurrency(totalEquity)}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold">CÓDIGO</TableHead>
                                        <TableHead className="text-xs font-bold">DESCRIPCIÓN</TableHead>
                                        <TableHead className="text-xs font-bold text-right">SALDO ACTUAL</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-20">Consolidando cuentas...</TableCell></TableRow>
                                    ) : (
                                        data.map((acc) => (
                                            <TableRow key={acc.code} className={acc.code.length <= 2 ? "bg-slate-50 font-bold" : ""}>
                                                <TableCell className="text-xs font-mono">{acc.code}</TableCell>
                                                <TableCell className="text-xs uppercase">{acc.name}</TableCell>
                                                <TableCell className={`text-right text-xs font-mono font-bold ${acc.balance < 0 ? 'text-red-600' : ''}`}>
                                                    {formatCurrency(acc.balance)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                <div className="p-4 bg-slate-100 text-xs font-bold flex justify-between border-t">
                                    <span>ECUACIÓN CONTABLE (Activo = Pasivo + Patrimonio)</span>
                                    <span className={Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                                        Diferencia: {formatCurrency(totalAssets - (totalLiabilities + totalEquity))}
                                    </span>
                                </div>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
