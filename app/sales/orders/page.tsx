'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, FileText } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/use-debounce'

export default function SalesOrdersPage() {
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 500)
    const [page, setPage] = useState(1)

    const { data, isLoading } = useQuery({
        queryKey: ['sales-orders', page, debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search: debouncedSearch,
            })
            const res = await fetch(`/api/sales-orders?${params}`)
            if (!res.ok) throw new Error('Error al cargar órdenes')
            return res.json()
        },
    })

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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Órdenes de Venta</h1>
                    <p className="text-muted-foreground">Gestiona pedidos antes de facturar</p>
                </div>
                <Link href="/sales/orders/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Orden
                    </Button>
                </Link>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por número o cliente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        ) : data?.items?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                    No se encontraron órdenes de venta
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.items?.map((order: any) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.number}</TableCell>
                                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                                    <TableCell>{order.customer?.name || 'Cliente General'}</TableCell>
                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                    <TableCell className="text-center">{order._count?.items || 0}</TableCell>
                                    <TableCell className="text-right font-bold">
                                        {formatCurrency(order.total)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/sales/orders/${order.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <FileText className="h-4 w-4 mr-2" />
                                                Detalles
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Basic Pagination */}
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data || page >= data.totalPages || isLoading}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    )
}
