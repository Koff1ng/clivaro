'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface LedgerItem {
    id: string
    number: string
    date: string
    total: number
    paid: number
    balance: number
    status: string
    payments: any[]
}

export function CustomerLedger({ customerId }: { customerId: string }) {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [selectedInvoice, setSelectedInvoice] = useState<LedgerItem | null>(null)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('CASH')
    const [paymentReference, setPaymentReference] = useState('')
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)

    const { data: ledger = [], isLoading } = useQuery({
        queryKey: ['customer-ledger', customerId],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/ledger`)
            if (!res.ok) throw new Error('Failed to fetch ledger')
            return res.json()
        }
    })

    const paymentMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/invoices/${selectedInvoice?.id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to record payment')
            }
            return res.json()
        },
        onSuccess: () => {
            toast('Pago registrado correctamente', 'success')
            setIsPaymentOpen(false)
            setPaymentAmount('')
            setPaymentReference('')
            queryClient.invalidateQueries({ queryKey: ['customer-ledger', customerId] })
            // Also invalidate customer details to update header stats
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
        },
        onError: (err: any) => {
            toast(err.message || 'Error al registrar pago', 'error')
        }
    })

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedInvoice) return

        paymentMutation.mutate({
            amount: parseFloat(paymentAmount),
            method: paymentMethod,
            reference: paymentReference
        })
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pagada</Badge>
            case 'PENDING': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>
            case 'ANULADA': return <Badge variant="destructive">Anulada</Badge>
            case 'EN_COBRANZA': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">En Cobro</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    const openPaymentDialog = (item: LedgerItem) => {
        setSelectedInvoice(item)
        setPaymentAmount(Math.min(item.balance, item.total).toString())
        setIsPaymentOpen(true)
    }

    if (isLoading) return <div className="p-4 text-center">Cargando cartera...</div>

    const totalDebt = ledger.reduce((sum: number, item: any) => sum + (item.balance || 0), 0)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                    <h3 className="text-sm font-medium text-orange-800">Total Deuda Actual</h3>
                    <p className="text-2xl font-bold text-orange-900">{formatCurrency(totalDebt)}</p>
                </div>
                <div>
                    {/* Future: Button to Pay All */}
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Factura</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Abonado</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ledger.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    El cliente no tiene facturas registradas
                                </TableCell>
                            </TableRow>
                        ) : (
                            ledger.map((item: LedgerItem) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.number}</TableCell>
                                    <TableCell>{formatDate(item.date)}</TableCell>
                                    <TableCell>{formatCurrency(item.total)}</TableCell>
                                    <TableCell className="text-green-600 font-medium">
                                        {formatCurrency(item.paid)}
                                    </TableCell>
                                    <TableCell className="text-orange-600 font-bold">
                                        {formatCurrency(item.balance)}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    <TableCell className="text-right">
                                        {item.balance > 1 && item.status !== 'ANULADA' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openPaymentDialog(item)}
                                            >
                                                Abonar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Abono - Factura {selectedInvoice?.number}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                        <div className="p-3 bg-muted rounded text-sm space-y-1">
                            <div className="flex justify-between">
                                <span>Total Factura:</span>
                                <span className="font-semibold">{formatCurrency(selectedInvoice?.total || 0)}</span>
                            </div>
                            <div className="flex justify-between text-orange-600">
                                <span>Saldo Pendiente:</span>
                                <span className="font-bold">{formatCurrency(selectedInvoice?.balance || 0)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monto a abonar</label>
                            <Input
                                type="number"
                                step="0.01"
                                max={selectedInvoice?.balance}
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Método de Pago</label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CASH">Efectivo</SelectItem>
                                    <SelectItem value="CARD">Tarjeta</SelectItem>
                                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Referencia (Opcional)</label>
                            <Input
                                value={paymentReference}
                                onChange={e => setPaymentReference(e.target.value)}
                                placeholder="# Recibo / Voucher"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={paymentMutation.isPending}>
                                {paymentMutation.isPending ? 'Registrando...' : 'Confirmar Pago'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
