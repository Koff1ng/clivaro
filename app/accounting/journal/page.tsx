'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { AccountSelect } from '@/components/accounting/account-select'

export default function JournalBookPage() {
    const [loading, setLoading] = useState(true)
    const [lines, setLines] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const fetchLines = async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (startDate) params.append('start', startDate)
        if (endDate) params.append('end', endDate)

        try {
            const res = await fetch(`/api/accounting/journal?${params.toString()}`)
            const data = await res.json()
            setLines(Array.isArray(data) ? data : [])
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
                <PageHeader title="Libro Diario" description="Visualiza todos los movimientos contables en orden cronológico." />

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="space-y-2">
                                <span className="text-sm font-medium">Desde</span>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
                            </div>
                            <div className="space-y-2">
                                <span className="text-sm font-medium">Hasta</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
                            </div>
                            <Button onClick={fetchLines} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar
                            </Button>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Fecha</TableHead>
                                        <TableHead className="w-[100px]">Comprobante</TableHead>
                                        <TableHead className="w-[150px]">Cuenta</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Tercero</TableHead>
                                        <TableHead className="text-right w-[120px]">Débito</TableHead>
                                        <TableHead className="text-right w-[120px]">Crédito</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading && lines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">Cargando movimientos...</TableCell>
                                        </TableRow>
                                    ) : lines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">No hay movimientos en este periodo.</TableCell>
                                        </TableRow>
                                    ) : (
                                        lines.map(line => (
                                            <TableRow key={line.id}>
                                                <TableCell>{new Date(line.journalEntry.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-mono text-xs">{line.journalEntry.number}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs">{line.account.code}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{line.account.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{line.description}</TableCell>
                                                <TableCell className="text-sm">{line.thirdPartyName || '-'}</TableCell>
                                                <TableCell className="text-right font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
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
