
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter, RefreshCw, Printer, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function JournalReportPage() {
    const [loading, setLoading] = useState(true)
    const [lines, setLines] = useState<any[]>([])
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const fetchLines = async () => {
        setLoading(true)
        const params = new URLSearchParams({
            start: startDate,
            end: endDate
        })

        try {
            const res = await fetch(`/api/accounting/reports/journal?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setLines(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLines()
    }, [])

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader title="Libro Diario" description="Detalle cronológico de todos los registros contables." />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Desde</span>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40" />
                            </div>
                            <Button onClick={fetchLines} disabled={loading} className="h-9">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Generar Reporte
                            </Button>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold w-[100px]">FECHA</TableHead>
                                        <TableHead className="text-xs font-bold w-[120px]">COMPROBANTE</TableHead>
                                        <TableHead className="text-xs font-bold">CUENTA</TableHead>
                                        <TableHead className="text-xs font-bold">DETALLE / TERCERO</TableHead>
                                        <TableHead className="text-xs font-bold text-right w-[140px]">DÉBITO</TableHead>
                                        <TableHead className="text-xs font-bold text-right w-[140px]">CRÉDITO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-slate-400">Generando reporte...</TableCell>
                                        </TableRow>
                                    ) : lines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-slate-400">No se encontraron movimientos en este periodo.</TableCell>
                                        </TableRow>
                                    ) : (
                                        lines.map((line) => (
                                            <TableRow key={line.id} className="hover:bg-slate-50">
                                                <TableCell className="text-xs">{new Date(line.journalEntry.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-mono text-[10px] font-bold text-blue-700">{line.journalEntry.number}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs">{line.account.code}</span>
                                                        <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{line.account.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-[11px] leading-tight font-medium">{line.description}</div>
                                                    {line.thirdPartyName && (
                                                        <div className="text-[10px] text-primary font-bold mt-0.5 uppercase">{line.thirdPartyName}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
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
