'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Users, Crown } from 'lucide-react'

async function fetchTopClients() {
  const res = await fetch('/api/dashboard/top-clients')
  if (!res.ok) return []
  return res.json()
}

const RANK_COLORS = ['bg-amber-500', 'bg-slate-400', 'bg-orange-400', 'bg-slate-300', 'bg-slate-200']

export function TopClients() {
  const { data, isLoading } = useQuery({
    queryKey: ['top-clients'],
    queryFn: fetchTopClients,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  const clients = data || []

  return (
    <Card className="border-slate-200/60 dark:border-slate-700/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Users size={16} className="text-pink-600" />
          </div>
          <div>
            <CardTitle className="text-sm">Top Clientes</CardTitle>
            <p className="text-[10px] text-slate-400 mt-0.5">Mayor facturación</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Sin datos de clientes
          </div>
        ) : (
          <div className="space-y-2">
            {clients.slice(0, 5).map((client: any, index: number) => (
              <div key={client.id || index} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-lg ${RANK_COLORS[index] || 'bg-slate-200'} flex items-center justify-center text-white text-[10px] font-black`}>
                    {index === 0 ? <Crown size={13} /> : index + 1}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                    {client.name}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(client.total || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
