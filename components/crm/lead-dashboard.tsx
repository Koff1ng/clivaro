'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Target, Users } from 'lucide-react'

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

    return {
      total,
      byStage,
      totalRevenue,
      weightedValue,
      wonRevenue,
      conversionRate,
    }
  }, [leads])

  const stageLabels: Record<string, string> = {
    NEW: 'Nueva',
    CONTACTED: 'Contactado',
    QUOTED: 'Cotizado',
    WON: 'Ganada',
    LOST: 'Perdida',
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Oportunidades</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ingreso Total Esperado</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valor Ponderado</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.weightedValue)}</p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tasa de Conversión</p>
              <p className="text-2xl font-bold mt-1">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Pipeline by Stage */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Pipeline por Etapa</h3>
        <div className="space-y-3">
          {Object.entries(stats.byStage).map(([stage, count]) => {
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
            const stageRevenue = leads
              .filter(l => l.stage === stage)
              .reduce((sum, l) => sum + (l.expectedRevenue || 0), 0)
            
            return (
              <div key={stage}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{stageLabels[stage]}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600">{count} oportunidades</span>
                    <span className="font-semibold">{formatCurrency(stageRevenue)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
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

      {/* Top Opportunities */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Top Oportunidades por Valor Ponderado</h3>
        <div className="space-y-2">
          {leads
            .map(l => ({
              ...l,
              weighted: (l.expectedRevenue || 0) * ((l.probability || 0) / 100),
            }))
            .sort((a, b) => b.weighted - a.weighted)
            .slice(0, 5)
            .map((lead) => (
              <div key={lead.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-sm text-gray-600">{lead.company || 'Sin empresa'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(lead.weighted)}</p>
                  <p className="text-xs text-gray-500">{lead.probability || 0}% probabilidad</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

