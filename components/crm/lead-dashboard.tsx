'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Target, Users, Clock, Trophy, AlertTriangle } from 'lucide-react'

export function LeadDashboard({ leads }: { leads: any[] }) {
  const stats = useMemo(() => {
    const total = leads.length
    const byStage = {
      NEW: leads.filter(l => l.stage === 'NEW').length,
      CONTACTED: leads.filter(l => l.stage === 'CONTACTED').length,
      QUOTED: leads.filter(l => l.stage === 'QUOTED').length,
      WON: leads.filter(l => l.stage === 'WON').length,
      LOST: leads.filter(l => l.stage === 'LOST').length,
    }
    
    const totalRevenue = leads.reduce((sum, l) => sum + (l.expectedRevenue || 0), 0)
    const weightedValue = leads.reduce((sum, l) => {
      const prob = (l.probability || 0) / 100
      return sum + ((l.expectedRevenue || 0) * prob)
    }, 0)
    
    const wonRevenue = leads
      .filter(l => l.stage === 'WON')
      .reduce((sum, l) => sum + (l.expectedRevenue || 0), 0)
    
    const conversionRate = total > 0 ? ((byStage.WON + byStage.LOST) > 0 
      ? (byStage.WON / (byStage.WON + byStage.LOST)) * 100 
      : 0) : 0

    const avgDealSize = total > 0 ? totalRevenue / total : 0

    // Deals aging: no activity in 7+ days
    const now = Date.now()
    const staleLeads = leads.filter(l => {
      if (l.stage === 'WON' || l.stage === 'LOST') return false
      const updated = new Date(l.updatedAt || l.createdAt).getTime()
      return (now - updated) > 7 * 24 * 60 * 60 * 1000
    })

    // Conversion funnel data
    const funnel = [
      { stage: 'NEW', label: 'Nueva', count: byStage.NEW, color: '#3b82f6' },
      { stage: 'CONTACTED', label: 'Contactado', count: byStage.CONTACTED, color: '#eab308' },
      { stage: 'QUOTED', label: 'Cotizado', count: byStage.QUOTED, color: '#8b5cf6' },
      { stage: 'WON', label: 'Ganada', count: byStage.WON, color: '#22c55e' },
      { stage: 'LOST', label: 'Perdida', count: byStage.LOST, color: '#ef4444' },
    ]

    return {
      total,
      byStage,
      totalRevenue,
      weightedValue,
      wonRevenue,
      conversionRate,
      avgDealSize,
      staleLeads,
      funnel,
    }
  }, [leads])

  const stageLabels: Record<string, string> = {
    NEW: 'Nueva',
    CONTACTED: 'Contactado',
    QUOTED: 'Cotizado',
    WON: 'Ganada',
    LOST: 'Perdida',
  }

  const maxFunnelCount = Math.max(...stats.funnel.map(f => f.count), 1)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Oportunidades</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Valor Ponderado</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.weightedValue)}</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Tasa de Conversión</p>
              <p className="text-2xl font-bold mt-1">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Ganadas</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(stats.wonRevenue)}</p>
            </div>
            <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Embudo de Conversión
          </h3>
          <div className="space-y-2">
            {stats.funnel.map((stage, i) => {
              const widthPct = Math.max((stage.count / maxFunnelCount) * 100, 10)
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right truncate">{stage.label}</span>
                  <div className="flex-1 flex justify-center">
                    <div
                      className="h-8 rounded-md flex items-center justify-center transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.color + '25',
                        borderLeft: `3px solid ${stage.color}`,
                      }}
                    >
                      <span className="text-xs font-bold" style={{ color: stage.color }}>
                        {stage.count}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pipeline by Stage */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Valor por Etapa
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byStage).map(([stage, count]) => {
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              const stageRevenue = leads
                .filter(l => l.stage === stage)
                .reduce((sum, l) => sum + (l.expectedRevenue || 0), 0)
              
              return (
                <div key={stage}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium">{stageLabels[stage]}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-muted-foreground">{count} oport.</span>
                      <span className="font-semibold">{formatCurrency(stageRevenue)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        stage === 'WON' ? 'bg-green-500' :
                        stage === 'LOST' ? 'bg-red-500' :
                        stage === 'QUOTED' ? 'bg-purple-500' :
                        stage === 'CONTACTED' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stale Deals Alert */}
        {stats.staleLeads.length > 0 && (
          <div className="bg-card p-6 rounded-lg border border-amber-200 dark:border-amber-800 shadow-sm">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Deals sin Actividad ({stats.staleLeads.length})
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Sin actualización en 7+ días</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.staleLeads.slice(0, 8).map(lead => {
                const daysSince = Math.floor((Date.now() - new Date(lead.updatedAt || lead.createdAt).getTime()) / (24*60*60*1000))
                return (
                  <div key={lead.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{lead.name}</p>
                      <p className="text-muted-foreground">{lead.company || 'Sin empresa'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{daysSince}d</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Opportunities */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top Oportunidades
          </h3>
          <div className="space-y-2">
            {leads
              .map(l => ({
                ...l,
                weighted: (l.expectedRevenue || 0) * ((l.probability || 0) / 100),
              }))
              .sort((a, b) => b.weighted - a.weighted)
              .slice(0, 5)
              .map((lead, i) => (
                <div key={lead.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {lead.company || 'Sin empresa'} · {lead.probability || 0}% prob.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-green-600">{formatCurrency(lead.weighted)}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
