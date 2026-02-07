
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, Printer, ArrowLeft, Trash2 } from 'lucide-react'

export default function VoucherDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const [voucher, setVoucher] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)

    useEffect(() => {
        if (params.id) {
            fetch(`/api/accounting/vouchers/${params.id}`)
                .then(res => res.json())
                .then(data => {
                    setVoucher(data)
                    setLoading(false)
                })
                .catch(() => setLoading(false))
        }
    }, [params.id])

    const handleApprove = async () => {
        setApproving(true)
        try {
            const res = await fetch(`/api/accounting/vouchers/${params.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'approve' }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) throw new Error('Error al aprobar')

            toast('Comprobante aprobado y contabilizado', 'success')
            // Refresh
            const updated = await res.json()
            setVoucher(updated)
        } catch (e: any) {
            toast(e.message, 'error')
        } finally {
            setApproving(false)
        }
    }

    if (loading) return <MainLayout><div className="p-8 text-center uppercase font-bold text-slate-400">Cargando comprobante...</div></MainLayout>
    if (!voucher) return <MainLayout><div className="p-8 text-center text-red-500">Comprobante no encontrado</div></MainLayout>

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Button>
                        <PageHeader
                            title={`Comprobante ${voucher.number}`}
                            description={`${voucher.type} - ${new Date(voucher.date).toLocaleDateString()}`}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                        {voucher.status === 'DRAFT' && (
                            <Button onClick={handleApprove} disabled={approving}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {approving ? 'Aprobando...' : 'Contabilizar Ahora'}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="md:col-span-2">
                        <CardHeader className="bg-slate-50 border-b">
                            <CardTitle className="text-sm font-bold uppercase">Líneas de Detalle</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="text-[10px] font-bold">CUENTA</TableHead>
                                        <TableHead className="text-[10px] font-bold">TERCERO</TableHead>
                                        <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
                                        <TableHead className="text-[10px] font-bold text-right">DÉBITO</TableHead>
                                        <TableHead className="text-[10px] font-bold text-right">CRÉDITO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {voucher.lines.map((line: any) => (
                                        <TableRow key={line.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs">{line.account.code}</span>
                                                    <span className="text-[10px] text-muted-foreground">{line.account.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium uppercase truncate max-w-[150px]">
                                                {line.thirdPartyName || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs italic text-slate-600">
                                                {line.description || voucher.description}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-8 text-sm font-bold">
                                <span>TOTAL DÉBITO: {formatCurrency(voucher.totalDebit)}</span>
                                <span>TOTAL CRÉDITO: {formatCurrency(voucher.totalCredit)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="bg-slate-50 border-b">
                                <CardTitle className="text-sm font-bold uppercase">Información General</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Estado</span>
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${voucher.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                voucher.status === 'ANNULLED' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {voucher.status === 'DRAFT' ? 'Borrador' : voucher.status === 'APPROVED' ? 'Aprobado' : 'Anulado'}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Descripción</span>
                                    <p className="text-sm font-medium">{voucher.description}</p>
                                </div>
                                {voucher.reference && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Referencia</span>
                                        <p className="text-sm">{voucher.reference}</p>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Periodo</span>
                                    <p className="text-sm font-mono">{voucher.period}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
