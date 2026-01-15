'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function fetchLowStock() {
  const res = await fetch('/api/inventory/low-stock')
  if (!res.ok) throw new Error('Failed to fetch low stock')
  return res.json()
}

export function LowStockDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['low-stock'],
    queryFn: fetchLowStock,
    refetchInterval: 30 * 1000, // Actualizar cada 30 segundos
    staleTime: 20 * 1000, // Los datos se consideran frescos por 20 segundos
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Error al cargar productos con stock bajo
          </div>
        </CardContent>
      </Card>
    )
  }

  const items = data || []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stock Bajo
          </CardTitle>
          <Link href="/inventory">
            <Button variant="ghost" size="sm" className="text-xs">
              Ver todo
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No hay productos con stock bajo
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {item.productName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.warehouseName}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-orange-600">
                      {item.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mín: {item.minStock}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

