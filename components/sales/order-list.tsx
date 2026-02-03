'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Eye, Trash2, Loader2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrderDetails } from '@/components/sales/order-details'

async function fetchOrders(page: number, search: string, status: string) {
    const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
    })
    if (search) params.append('search', search)
    // if (status) params.append('status', status) // Uncomment if backend supports status filter

    const res = await fetch(`/api/sales-orders?${params}`)
    if (!res.ok) throw new Error('Failed to fetch orders')
    return res.json()
}

export function OrderList() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set()) // For animation/loading state
    const [viewOrder, setViewOrder] = useState<any>(null)
    const router = useRouter()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    // Debounce search
    const debouncedSearch = useDebounce(search, 500)

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        setPage(1)
    }, [])

    const { data, isLoading } = useQuery({
        queryKey: ['sales-orders', page, debouncedSearch, statusFilter],
        queryFn: () => fetchOrders(page, debouncedSearch, statusFilter),
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    })

    const deleteOrderMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/sales-orders/${id}`, {
                method: 'DELETE',
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to delete order')
            }
            return res.json()
        },
        onSuccess: (_, orderId) => {
            setDeletingIds(prev => new Set(prev).add(orderId))
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
                setDeletingIds(prev => {
                    const next = new Set(prev)
                    next.delete(orderId)
                    return next
                })
                toast({ title: 'Orden eliminada', variant: 'default' } as any) // Assuming standard variant is safe, checked InvoiceList used 'success' but toast types differ
            }, 500)
        },
        onError: (error: any) => {
            toast({ title: error.message || 'Error al eliminar orden', variant: 'destructive' } as any)
        },
    })

    const handleDelete = async (order: any) => {
        if (confirm(`¿Está seguro de eliminar la orden ${order.number}? Esta acción no se puede deshacer.`)) {
            try {
                await deleteOrderMutation.mutateAsync(order.id)
            } catch (error: any) {
                // Handled in onError
            }
        }
    }

    const handleView = async (orderSummary: any) => {
        try {
            // Fetch full details including items which might be paginated or not fully loaded in list
            const res = await fetch(`/api/sales-orders/${orderSummary.id}`)
            if (!res.ok) throw new Error('Error al cargar detalles')
            const fullOrder = await res.json()
            setViewOrder(fullOrder)
        } catch (error) {
            toast({ title: 'Error al cargar los detalles de la orden', variant: 'destructive' } as any)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="default" className="bg-blue-600">Abierta</Badge>
            case 'COMPLETED': return <Badge variant="secondary" className="bg-green-100 text-green-800">Facturada</Badge>
            case 'CANCELLED': return <Badge variant="destructive">Cancelada</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    const { orders, pagination } = useMemo(() => {
        if (!data) return { orders: [], pagination: { totalPages: 1, total: 0, page: 1 } }
        // API returns { items: [], totalPages: x, ... } usually
        return {
            orders: data.items || [],
            pagination: {
                totalPages: data.totalPages || 1,
                total: data.total || 0,
                page: data.page || page
            }
        }
    }, [data, page])

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar órdenes (número, cliente)..."
                        value={search}
                        onChange={handleSearchChange}
                        className="pl-9 rounded-full text-sm"
                    />
                </div>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <Link href="/sales/orders/new">
                        <Button className="rounded-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Orden
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading && orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                    <span className="text-muted-foreground">Cargando órdenes...</span>
                </div>
            ) : (
                <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                            <TableRow>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Número</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Fecha</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Cliente</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Estado</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm text-center">Items</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Total</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                                        No se encontraron órdenes de venta
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order: any) => {
                                    const isDeleting = deletingIds.has(order.id)
                                    return (
                                        <TableRow
                                            key={order.id}
                                            className={`${isDeleting ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b transition-colors`}
                                        >
                                            <TableCell className="font-medium">{order.number}</TableCell>
                                            <TableCell>{formatDate(order.createdAt)}</TableCell>
                                            <TableCell>{order.customer?.name || 'Cliente General'}</TableCell>
                                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                                            <TableCell className="text-center">{order._count?.items || 0}</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(order.total)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Ver detalles"
                                                        onClick={() => handleView(order)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>

                                                    {order.status === 'OPEN' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(order)}
                                                            title="Eliminar orden"
                                                            disabled={deleteOrderMutation.isPending}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Página {pagination.page} de {pagination.totalPages} ({pagination.total} órdenes)
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                            disabled={page === pagination.totalPages}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalles de la Orden {viewOrder?.number}</DialogTitle>
                    </DialogHeader>
                    {viewOrder && <OrderDetails order={viewOrder} />}
                </DialogContent>
            </Dialog>
        </div>
    )
}
