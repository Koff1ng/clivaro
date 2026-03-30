'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, DollarSign, Target, 
  Trophy, XCircle, Clock, BarChart3, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  name: string
  color: string
  order: number
  isWon: boolean
  isLost: boolean
  _count: { opportunities: number }
}

interface Opportunity {
  id: string
  title: string
  value: number
  probability: number
  priority: string
  stageId: string
  pipelineStage?: Stage
  customer?: { name: string }
  createdAt: string
  closedDate?: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function formatCompact(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return formatCurrency(n)
}

export default function PipelineAnalytics() {
  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/pipeline-stages')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/opportunities')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  // Computed metrics
  const metrics = useMemo(() => {
    const total = opportunities.length
    const totalValue = opportunities.reduce((s, o) => s + o.value, 0)
    const weightedValue = opportunities.reduce((s, o) => s + (o.value * o.probability / 100), 0)
    
    const won = opportunities.filter(o => o.pipelineStage?.isWon)
    const lost = opportunities.filter(o => o.pipelineStage?.isLost)
    const active = opportunities.filter(o => !o.pipelineStage?.isWon && !o.pipelineStage?.isLost)
    
    const wonValue = won.reduce((s, o) => s + o.value, 0)
    const lostValue = lost.reduce((s, o) => s + o.value, 0)
    const activeValue = active.reduce((s, o) => s + o.value, 0)
    
    const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0
    const avgDealSize = total > 0 ? totalValue / total : 0

    // By stage
    const byStage = stages
      .filter(s => !s.isWon && !s.isLost)
      .map(stage => {
        const stageOpps = opportunities.filter(o => o.stageId === stage.id)
        return {
          ...stage,
          count: stageOpps.length,
          value: stageOpps.reduce((s, o) => s + o.value, 0),
          weighted: stageOpps.reduce((s, o) => s + (o.value * o.probability / 100), 0),
        }
      })

    // Top opportunities
    const topOpps = [...active]
      .sort((a, b) => (b.value * b.probability) - (a.value * a.probability))
      .slice(0, 5)

    // By priority
    const byPriority = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({
      priority: p,
      count: active.filter(o => o.priority === p).length,
      value: active.filter(o => o.priority === p).reduce((s, o) => s + o.value, 0),
    })).filter(p => p.count > 0)

    return {
      total, totalValue, weightedValue,
      won, lost, active,
      wonValue, lostValue, activeValue,
      winRate, avgDealSize,
      byStage, topOpps, byPriority,
    }
  }, [opportunities, stages])

  // Max value for bar chart scaling
  const maxStageValue = Math.max(...metrics.byStage.map(s => s.value), 1)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Pipeline Total"
          value={formatCompact(metrics.activeValue)}
          subtitle={`${metrics.active.length} activas`}
          icon={Target}
          color="text-indigo-500"
          bgColor="bg-indigo-50 dark:bg-indigo-950/30"
        />
        <KPICard
          title="Ponderado"
          value={formatCompact(metrics.weightedValue)}
          subtitle="valor × probabilidad"
          icon={TrendingUp}
          color="text-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-950/30"
        />
        <KPICard
          title="Ganadas"
          value={formatCompact(metrics.wonValue)}
          subtitle={`${metrics.won.length} cerradas`}
          icon={Trophy}
          color="text-green-500"
          bgColor="bg-green-50 dark:bg-green-950/30"
        />
        <KPICard
          title="Tasa de Cierre"
          value={`${metrics.winRate}%`}
          subtitle={`${metrics.won.length}/${metrics.total} total`}
          icon={BarChart3}
          color="text-amber-500"
          bgColor="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Value by Stage — Horizontal Bar Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Valor por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            ) : (
              metrics.byStage.map(stage => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="font-medium">{stage.name}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{stage.count}</Badge>
                    </span>
                    <span className="font-semibold">{formatCompact(stage.value)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max((stage.value / maxStageValue) * 100, 2)}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidades activas</p>
            ) : (
              <div className="space-y-2">
                {metrics.topOpps.map((opp, i) => (
                  <div key={opp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{opp.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {opp.customer?.name || 'Sin cliente'} · {opp.probability}% prob.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">{formatCompact(opp.value)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        pond. {formatCompact(opp.value * opp.probability / 100)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-purple-500" />
              Embudo de Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-1">
                {metrics.byStage.map((stage, i) => {
                  const maxCount = Math.max(...metrics.byStage.map(s => s.count), 1)
                  const widthPct = Math.max((stage.count / maxCount) * 100, 15)
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-24 truncate text-right">{stage.name}</span>
                      <div className="flex-1 flex justify-center">
                        <div
                          className="h-7 rounded-md flex items-center justify-center transition-all duration-700"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: stage.color + '30',
                            borderLeft: `3px solid ${stage.color}`,
                          }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: stage.color }}>
                            {stage.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              Por Prioridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.byPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidades activas</p>
            ) : (
              <div className="space-y-3">
                {metrics.byPriority.map(p => {
                  const configs: Record<string, { label: string; color: string }> = {
                    URGENT: { label: '🔴 Urgente', color: '#ef4444' },
                    HIGH: { label: '🟠 Alta', color: '#f97316' },
                    MEDIUM: { label: '🔵 Media', color: '#3b82f6' },
                    LOW: { label: '⚪ Baja', color: '#94a3b8' },
                  }
                  const cfg = configs[p.priority] || configs.MEDIUM
                  return (
                    <div key={p.priority} className="flex items-center justify-between">
                      <span className="text-sm">{cfg.label}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">{p.count}</Badge>
                        <span className="text-sm font-semibold w-24 text-right">{formatCompact(p.value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────
function KPICard({
  title, value, subtitle, icon: Icon, color, bgColor
}: {
  title: string; value: string; subtitle: string
  icon: any; color: string; bgColor: string
}) {
  return (
    <Card className={cn('border-none shadow-sm', bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
