'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Server, Wrench } from 'lucide-react'

async function fetchRecentProducts() {
  const res = await fetch('/api/products?limit=5&orderBy=createdAt')
  if (!res.ok) {
    return []
  }
  const data = await res.json()
  return data.products || []
}

export function RecentProducts() {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-products'],
    queryFn: fetchRecentProducts,
    refetchInterval: 60 * 1000, // Actualizar cada 60 segundos
    staleTime: 30 * 1000, // Los datos se consideran frescos por 30 segundos
    refetchOnWindowFocus: true,
  })

  const products = data || []

  const getProductIcon = (category: string) => {
    if (category?.toLowerCase().includes('hosting') || category?.toLowerCase().includes('servicio')) {
      return <Server className="h-5 w-5 text-blue-600" />
    }
    return <Wrench className="h-5 w-5 text-orange-600" />
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Productos Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay productos recientes</p>
        ) : (
          <div className="space-y-3">
            {products.slice(0, 3).map((product: any, index: number) => (
              <div key={product.id || index} className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors">
                {getProductIcon(product.category)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.sku || 'Sin SKU'}
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

