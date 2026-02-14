
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Printer, Download, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function ProfitLossReportPage() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any[]>([])
    const [start, setStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
    const [end, setEnd] = useState(new Date().toISOString().split('T')[0])

    const fetchReport = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/accounting/reports/profit-loss?start=${start}&end=${end}`)
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

    const handlePrint = () => {
        window.print()
    }

    useEffect(() => {
        fetchReport()
    }, [])

    const totalRevenue = data.filter(a => a.code.startsWith('4')).reduce((sum, a) => sum + (a.code.length === 1 ? a.movement : 0), 0)
    const totalExpenses = data.filter(a => a.code.startsWith('5')).reduce((sum, a) => sum + (a.code.length === 1 ? a.movement : 0), 0)
    const totalCosts = data.filter(a => a.code.startsWith('6') || a.code.startsWith('7')).reduce((sum, a) => sum + (a.code.length === 1 ? a.movement : 0), 0)

    const netIncome = Math.abs(totalRevenue) - Math.abs(totalExpenses) - Math.abs(totalCosts)

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader title="Estado de Resultados" description="Informe de ingresos, gastos y utilidad del periodo." />
                    <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border print:hidden">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Periodo Desde</span>
                                <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-9 w-40" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                                <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-9 w-40" />
                            </div>
                            <Button onClick={fetchReport} disabled={loading} className="h-9">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Calcular Resultados
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <Card className="bg-emerald-50 border-emerald-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-emerald-600 uppercase">Ingresos</div>
                                    <div className="text-xl font-bold">{formatCurrency(Math.abs(totalRevenue))}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-orange-50 border-orange-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-orange-600 uppercase">Gastos</div>
                                    <div className="text-xl font-bold">({formatCurrency(Math.abs(totalExpenses))})</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-rose-50 border-rose-200">
                                <CardContent className="p-4">
                                    <div className="text-xs font-bold text-rose-600 uppercase">Costos</div>
                                    <div className="text-xl font-bold">({formatCurrency(Math.abs(totalCosts))})</div>
                                </CardContent>
                            </Card>
                            <Card className={netIncome >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}>
                                <CardContent className="p-4">
                                    <div className={`text-xs font-bold uppercase ${netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Utilidad/Pérdida</div>
                                    <div className="text-xl font-bold">{formatCurrency(netIncome)}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold">CÓDIGO</TableHead>
                                        <TableHead className="text-xs font-bold">CONCEPTO</TableHead>
                                        <TableHead className="text-xs font-bold text-right">VALOR PERIODO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-20">Analizando registros de ingresos y gastos...</TableCell></TableRow>
                                    ) : (
                                        data.map((acc) => (
                                            <TableRow key={acc.code} className={acc.code.length <= 2 ? "bg-slate-50 font-bold" : ""}>
                                                <TableCell className="text-xs font-mono">{acc.code}</TableCell>
                                                <TableCell className="text-xs uppercase">{acc.name}</TableCell>
                                                <TableCell className={`text-right text-xs font-mono font-bold ${acc.movement < 0 && acc.code.startsWith('4') ? 'text-green-600' : acc.movement > 0 ? 'text-red-600' : ''}`}>
                                                    {formatCurrency(Math.abs(acc.movement))}
                                                </TableCell>
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
