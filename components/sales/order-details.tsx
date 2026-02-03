'use client'

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
import { Separator } from '@/components/ui/separator'
import { Mail, Phone, MapPin, User } from 'lucide-react'

export function OrderDetails({ order }: { order: any }) {
    if (!order) return <div className="p-4 text-center">No hay información de la orden</div>

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="default" className="bg-blue-600">Abierta</Badge>
            case 'COMPLETED': return <Badge variant="secondary" className="bg-green-100 text-green-800">Facturada</Badge>
            case 'CANCELLED': return <Badge variant="destructive">Cancelada</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Información de la Orden</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Número:</span>
                            <span className="font-medium">{order.number}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Fecha:</span>
                            <span>{formatDate(order.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estado:</span>
                            <span>{getStatusBadge(order.status)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Creado por:</span>
                            <span>{order.created_by?.name || 'Sistema'}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-2">Cliente</h3>
                    <div className="space-y-1 text-sm">
                        <div className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {order.customer?.name}
                        </div>
                        {order.customer?.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {order.customer.email}
                            </div>
                        )}
                        {order.customer?.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {order.customer.phone}
                            </div>
                        )}
                        {order.customer?.address && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {order.customer.address}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Separator />

            {/* Items Table */}
            <div>
                <h3 className="text-lg font-semibold mb-3">Productos</h3>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead className="text-right">Precio Unit.</TableHead>
                                <TableHead className="text-right">Desc.</TableHead>
                                <TableHead className="text-right">Impuesto</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.items?.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.product?.name}</div>
                                        {item.product?.sku && (
                                            <div className="text-xs text-muted-foreground">SKU: {item.product.sku}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-right text-red-600">
                                        {item.discount > 0 ? `-${item.discount}%` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {item.taxRate > 0 ? `${item.taxRate}%` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(item.subtotal)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-full md:w-1/3 space-y-2 bg-muted/20 p-4 rounded-lg">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                            <span>Descuento:</span>
                            <span>-{formatCurrency(order.discount)}</span>
                        </div>
                    )}
                    {order.tax > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Impuestos:</span>
                            <span>{formatCurrency(order.tax)}</span>
                        </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(order.total)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {order.notes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
                    <h4 className="font-semibold text-sm mb-1 text-yellow-800 dark:text-yellow-200">Notas:</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{order.notes}</p>
                </div>
            )}
        </div>
    )
}
