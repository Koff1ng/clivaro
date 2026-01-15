'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

async function fetchTopProducts() {
  const res = await fetch('/api/dashboard/top-products')
  if (!res.ok) throw new Error('Failed to fetch top products')
  return res.json()
}

export function TopProducts() {
  const { data, isLoading } = useQuery({
    queryKey: ['top-products'],
    queryFn: fetchTopProducts,
  })

  if (isLoading) {
    return <Card><CardContent>Cargando...</CardContent></Card>
  }

  const products = data || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Productos Más Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-gray-600">No hay datos de ventas</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product: any, index: number) => (
                <TableRow key={product.productId || index}>
                  <TableCell>{product.productName}</TableCell>
                  <TableCell>{product.totalQuantity}</TableCell>
                  <TableCell>{formatCurrency(product.totalRevenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

