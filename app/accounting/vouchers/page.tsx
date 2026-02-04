'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Search, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

export default function VouchersPage() {
    const [vouchers, setVouchers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/accounting/vouchers')
            .then(res => res.json())
            .then(data => {
                setVouchers(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(err => setLoading(false))
    }, [])

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Comprobantes Contables"
                    description="Gestión de movimiento contable (Ingresos, Egresos, Diario)."
                    action={
                        <Link href="/accounting/vouchers/new">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Nuevo Comprobante
                            </Button>
                        </Link>
                    }
                />

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell></TableRow>
                                ) : vouchers.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8">No hay comprobantes</TableCell></TableRow>
                                ) : (
                                    vouchers.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell>{new Date(v.date).toLocaleDateString()}</TableCell>
                                            <TableCell>{v.number}</TableCell>
                                            <TableCell>{v.type}</TableCell>
                                            <TableCell>{v.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(v.totalDebit)}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${v.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        v.status === 'ANNULLED' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {v.status === 'DRAFT' ? 'Borrador' : v.status === 'APPROVED' ? 'Aprobado' : 'Anulado'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Link href={`/accounting/vouchers/${v.id}`}>
                                                    <Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
