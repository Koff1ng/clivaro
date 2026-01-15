'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle } from 'lucide-react'

async function fetchLowStock() {
  const res = await fetch('/api/inventory/low-stock')
  if (!res.ok) throw new Error('Failed to fetch low stock')
  return res.json()
}

export function LowStockAlert() {
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: fetchLowStock,
  })

  if (isLoading) {
    return <Card><CardContent>Cargando...</CardContent></Card>
  }

  const items = data || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Productos con Stock Bajo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-600">No hay productos con stock bajo</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Mínimo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.warehouseName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.minStock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

