
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Printer, Download, Search, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ThirdPartySelect } from '@/components/accounting/third-party-select'

export default function AuxThirdPartyReportPage() {
    const [loading, setLoading] = useState(false)
    const [selectedThirdParty, setSelectedThirdParty] = useState('')
    const [thirdPartyName, setThirdPartyName] = useState('')
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [movements, setMovements] = useState<any[]>([])

    const fetchReport = async () => {
        if (!selectedThirdParty) return
        setLoading(true)
        try {
            const params = new URLSearchParams({
                thirdPartyId: selectedThirdParty,
                start: startDate,
                end: endDate
            })
            const res = await fetch(`/api/accounting/reports/aux-third-party?${params.toString()}`)
            if (res.ok) {
                const results = await res.json()
                setMovements(results)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const totalDebits = movements.reduce((sum, m) => sum + m.debit, 0)
    const totalCredits = movements.reduce((sum, m) => sum + m.credit, 0)

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <PageHeader title="Auxiliar por Tercero" description="Detalle de movimientos contables asociados a un NIT específico." />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-lg border">
                            <div className="md:col-span-1 space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Seleccionar Tercero</span>
                                <ThirdPartySelect
                                    value={selectedThirdParty}
                                    onChange={(id, name) => {
                                        setSelectedThirdParty(id)
                                        setThirdPartyName(name)
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Desde</span>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
                            </div>
                            <Button onClick={fetchReport} disabled={loading || !selectedThirdParty} className="h-9">
                                <Search className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Consultar Movimientos
                            </Button>
                        </div>

                        {movements.length > 0 ? (
                            <div className="rounded-md border overflow-hidden mt-6">
                                <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-sm uppercase">MOVIMIENTOS: {thirdPartyName}</h3>
                                    <span className="text-xs font-bold bg-white px-2 py-1 rounded border">Neto: {formatCurrency(totalDebits - totalCredits)}</span>
                                </div>
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-bold">FECHA</TableHead>
                                            <TableHead className="text-[10px] font-bold">CUENTA</TableHead>
                                            <TableHead className="text-[10px] font-bold">COMPROBANTE</TableHead>
                                            <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
                                            <TableHead className="text-[10px] font-bold text-right">DÉBITO</TableHead>
                                            <TableHead className="text-[10px] font-bold text-right">CRÉDITO</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {movements.map((mov: any) => (
                                            <TableRow key={mov.id} className="hover:bg-slate-50">
                                                <TableCell className="text-xs">{new Date(mov.journalEntry.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-xs font-bold">{mov.account.code} - {mov.account.name}</TableCell>
                                                <TableCell className="font-mono text-[10px] text-blue-700 font-bold">{mov.journalEntry.number}</TableCell>
                                                <TableCell className="text-[11px] leading-tight">{mov.description || mov.journalEntry.description}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{mov.debit > 0 ? formatCurrency(mov.debit) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{mov.credit > 0 ? formatCurrency(mov.credit) : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <div className="p-3 bg-slate-50 text-xs font-bold flex justify-end gap-8 border-t">
                                        <span>TOTAL DÉBITOS: {formatCurrency(totalDebits)}</span>
                                        <span>TOTAL CRÉDITOS: {formatCurrency(totalCredits)}</span>
                                        <span className={totalDebits - totalCredits >= 0 ? "text-blue-700" : "text-red-700 font-bold"}>
                                            SALDO NETO: {formatCurrency(totalDebits - totalCredits)}
                                        </span>
                                    </div>
                                </Table>
                            </div>
                        ) : (
                            !loading && (
                                <div className="text-center py-20 text-slate-400 border rounded-md mt-6 flex flex-col items-center gap-2">
                                    <Users className="h-8 w-8 opacity-20" />
                                    <span>Selecciona un tercero para ver su historial de movimientos.</span>
                                </div>
                            )
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
