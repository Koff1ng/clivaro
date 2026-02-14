
'use client'

import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Printer, Download, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export default function ExogenousReportPage() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any[]>([])
    const [year, setYear] = useState(new Date().getFullYear().toString())
    const [searchTerm, setSearchTerm] = useState('')

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

    const fetchReport = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/accounting/reports/exogenous?year=${year}`)
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
        documentTitle: `Información Exógena ${year}`,
    })

    const handleExport = () => {
        const headers = ["Formato", "Concepto", "Tipo Doc", "Identificación", "Nombre/Razón Social", "Débito", "Crédito", "Saldo Neto"]
        const csvContent = [
            headers.join(","),
            ...filteredData.map(row => [
                row.format,
                row.concept,
                row.idType,
                row.idNumber,
                `"${row.name.replace(/"/g, '""')}"`,
                row.debit,
                row.credit,
                row.amount
            ].join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `exogena_${year}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    useEffect(() => {
        fetchReport()
    }, [year])

    const filteredData = data.filter(row =>
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.idNumber.includes(searchTerm) ||
        row.format.includes(searchTerm) ||
        row.concept.includes(searchTerm)
    )

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader
                        title="Información Exógena"
                        description="Reporte agregado por Formato, Concepto y Tercero para la DIAN."
                    />
                    <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />Imprimir
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" />Exportar CSV
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border print:hidden">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Año Fiscal</span>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger className="w-32 h-9 bg-white">
                                        <SelectValue placeholder="Año" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 flex-1 max-w-xs">
                                <span className="text-xs font-bold text-slate-500 uppercase">Filtrar resultados</span>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre, NIT, Formato..."
                                        className="pl-8 h-9 bg-white"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button onClick={fetchReport} disabled={loading} className="h-9">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar Reporte
                            </Button>
                        </div>

                        <div className="rounded-md border overflow-hidden" ref={contentRef}>
                            <div className="bg-white p-6 hidden print:block border-b mb-4">
                                <h1 className="text-2xl font-bold">REPORTE DE INFORMACIÓN EXÓGENA</h1>
                                <p className="text-muted-foreground text-sm">Año Gravable: {year}</p>
                            </div>

                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-bold">FORMATO</TableHead>
                                        <TableHead className="text-[10px] font-bold">CONCEPTO</TableHead>
                                        <TableHead className="text-[10px] font-bold">DOC</TableHead>
                                        <TableHead className="text-[10px] font-bold">IDENTIFICACIÓN</TableHead>
                                        <TableHead className="text-[10px] font-bold">NOMBRE / RAZÓN SOCIAL</TableHead>
                                        <TableHead className="text-[10px] font-bold text-right">DÉBITO</TableHead>
                                        <TableHead className="text-[10px] font-bold text-right">CRÉDITO</TableHead>
                                        <TableHead className="text-[10px] font-bold text-right">SALDO NETO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-20">Analizando años de contabilidad...</TableCell>
                                        </TableRow>
                                    ) : filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-20 text-muted-foreground">
                                                {data.length === 0 ? "No hay cuentas configuradas con formatos de exógena o no hay movimientos." : "No se encontraron resultados para el filtro aplicado."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredData.map((row, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="text-[11px] font-bold text-blue-700">{row.format}</TableCell>
                                                <TableCell className="text-[11px] font-mono">{row.concept}</TableCell>
                                                <TableCell className="text-[11px]">{row.idType}</TableCell>
                                                <TableCell className="text-[11px] font-mono">{row.idNumber}</TableCell>
                                                <TableCell className="text-[11px] uppercase truncate max-w-[200px]">{row.name}</TableCell>
                                                <TableCell className="text-right text-[11px] font-mono">{formatCurrency(row.debit)}</TableCell>
                                                <TableCell className="text-right text-[11px] font-mono">{formatCurrency(row.credit)}</TableCell>
                                                <TableCell className="text-right text-[11px] font-mono font-bold">
                                                    {formatCurrency(row.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            <div className="bg-slate-50 p-4 text-[10px] text-muted-foreground text-center border-t">
                                Este reporte es una herramienta de apoyo y debe ser validado contra el Libro Mayor.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
