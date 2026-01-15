'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  Label,
} from 'recharts'

async function fetchProductCategories() {
  const res = await fetch('/api/dashboard/product-categories')
  if (!res.ok) return []
  const data = await res.json().catch(() => ({} as any))
  return data.categories || []
}

const COLORS = ['#0088FE', '#FF8042', '#00C49F', '#FFBB28', '#8884d8']

export function ProductCategories() {
  const { data, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: fetchProductCategories,
    refetchInterval: 60 * 1000, // Actualizar cada 60 segundos
    staleTime: 30 * 1000, // Los datos se consideran frescos por 30 segundos
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-gray-100 animate-pulse rounded"></div>
        </CardContent>
      </Card>
    )
  }

  const categories = data || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Productos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay categorías</p>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value.toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => Number(value || 0).toLocaleString()}
                  labelStyle={{ color: 'inherit' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-3">Categorías de Productos</div>
              <div className="space-y-2">
                {categories.map((category: any, index: number) => (
                  <div key={category.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {category.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

