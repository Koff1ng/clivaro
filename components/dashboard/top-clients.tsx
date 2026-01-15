'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Users, Building2 } from 'lucide-react'

async function fetchTopClients() {
  const res = await fetch('/api/dashboard/top-clients')
  if (!res.ok) {
    // Si el endpoint no existe, retornar array vacío
    return []
  }
  return res.json()
}

export function TopClients() {
  const { data, isLoading } = useQuery({
    queryKey: ['top-clients'],
    queryFn: fetchTopClients,
    refetchInterval: 60 * 1000, // Actualizar cada 60 segundos
    staleTime: 30 * 1000, // Los datos se consideran frescos por 30 segundos
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const clients = data || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay datos de clientes</p>
        ) : (
          <div className="space-y-3">
            {clients.slice(0, 3).map((client: any, index: number) => (
              <div key={client.id || index} className="flex items-center justify-between p-2 hover:bg-accent rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{client.name}</div>
                  </div>
                </div>
                <div className="font-semibold text-primary">
                  {formatCurrency(client.total || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

