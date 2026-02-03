'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Printer, FileText, XCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { MainLayout } from '@/components/layout/main-layout'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import Link from 'next/link'

export default function SalesOrderDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const { data: order, isLoading, isError, error } = useQuery({
        queryKey: ['sales-order', id],
        queryFn: async () => {
            const res = await fetch(`/api/sales-orders/${id}`)
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
                throw new Error(err.error || 'Orden no encontrada')
            }
            return res.json()
        },
        retry: 1
    })

    // ... (useQuery above)

    const convertMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/sales-orders/${id}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al convertir orden')
            }
            return res.json()
        },
        onSuccess: (invoice) => {
            toast({
                title: "Orden Convertida",
                description: `Factura ${invoice.number} creada exitosamente`,
                variant: 'default'
            } as any)
            queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
            // Optional: Redirect to invoice?
            // router.push(`/admin/sales/invoices/${invoice.id}`)
        },
        onError: (err: any) => {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive"
            } as any)
        }
    })

    // Cancel Mutation (Reuse DELETE)
    const cancelMutation = useMutation({
        mutationFn: async () => {
            if (!confirm('¿Estás seguro de cancelar esta orden?')) throw new Error('Cancelado por usuario')
            const res = await fetch(`/api/sales-orders/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Error al cancelar')
            return res.json()
        },
        onSuccess: () => {
            toast({ title: "Orden Cancelada", variant: "default" } as any)
            queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
        }
    })

    if (isLoading) return (
        <MainLayout>
            <div className="flex justify-center items-center main-h-[50vh] p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p>Cargando detalles...</p>
                </div>
            </div>
        </MainLayout>
    )

    if (isError) return (
        <MainLayout>
            <div className="p-8 text-center text-red-500">
                <h3 className="text-lg font-bold">Error</h3>
                <p>{error?.message || 'No se pudo cargar la orden'}</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/sales/orders')}>
                    Volver a la lista
                </Button>
            </div>
        </MainLayout>
    )

    if (!order) return (
        <MainLayout>
            <div className="p-8 text-center">Orden no encontrada</div>
        </MainLayout>
    )

    return (
        <MainLayout>
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{order.number}</h1>
                            <Badge variant={order.status === 'OPEN' ? 'default' : order.status === 'COMPLETED' ? 'secondary' : 'destructive'}>
                                {order.status === 'OPEN' ? 'ABIERTA' : order.status === 'COMPLETED' ? 'FACTURADA' : 'CANCELADA'}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Creada el {formatDate(order.createdAt)} por {order.created_by?.name || 'Sistema'}
                        </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                        <Button variant="outline" onClick={() => window.print()}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                        {order.status === 'OPEN' && (
                            <>
                                <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={() => convertMutation.mutate()}
                                    disabled={convertMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Convertir a Factura
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Items de la Orden</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Cant.</TableHead>
                                        <TableHead className="text-right">Precio Unit.</TableHead>
                                        <TableHead className="text-right">Desc.</TableHead>
                                        <TableHead className="text-right">Impuesto</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.items.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {item.product?.name || 'Producto Desconocido'}
                                                <div className="text-xs text-muted-foreground">{item.product?.sku}</div>
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                            <TableCell className="text-right">{item.discount}%</TableCell>
                                            <TableCell className="text-right">{item.taxRate}%</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Cliente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-semibold text-lg">{order.customer?.name}</p>
                                    <p className="text-sm text-muted-foreground">{order.customer?.email}</p>
                                    <p className="text-sm text-muted-foreground">{order.customer?.phone}</p>
                                    <p className="text-xs text-muted-foreground mt-2">ID: {order.customer?.taxId || 'N/A'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen Financiero</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Descuentos</span>
                                    <span>- {formatCurrency(order.discount)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Impuestos</span>
                                    <span>+ {formatCurrency(order.tax)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-xl pt-4 border-t">
                                    <span>TOTAL</span>
                                    <span>{formatCurrency(order.total)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {order.notes && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Notas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
