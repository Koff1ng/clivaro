'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  Server,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  BarChart3,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Error cargando estadísticas')
      return res.json()
    },
    refetchInterval: 30000, // Refresh every 30s
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Panel de administración de la plataforma Clivaro"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const overview = stats?.overview || {}
  const revenue = stats?.revenue || {}
  const costs = stats?.costs || {}
  const planDist = stats?.planDistribution || {}
  const recentTenants = stats?.recentTenants || []
  const monthlyGrowth = stats?.monthlyGrowth || {}

  const formatCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Panel de administración de la plataforma Clivaro"
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.activeTenants} activos · {overview.inactiveTenants} inactivos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suscripciones</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overview.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.trialSubscriptions} prueba · {overview.expiredSubscriptions} expiradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCOP(revenue.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ ${revenue.mrrUsd || 0} USD/mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              En toda la plataforma
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second row: Costs & Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Costs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Costos Mensuales (USD)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Supabase Pro</span>
              <span className="text-sm font-semibold">${costs.supabase}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vercel Pro + IPv4</span>
              <span className="text-sm font-semibold">${costs.vercel}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Factus (FE)</span>
              <span className="text-sm font-semibold">${costs.factus?.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold text-red-500">${costs.total?.toFixed(2)}</span>
            </div>
            {revenue.mrrUsd > 0 && (
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Margen</span>
                  <Badge className={revenue.mrrUsd - costs.total > 0 ? 'bg-green-600' : 'bg-red-600'}>
                    {revenue.mrrUsd - costs.total > 0 ? '+' : ''}{(revenue.mrrUsd - costs.total).toFixed(2)} USD
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Distribución de Planes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(planDist).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin suscripciones activas</p>
            ) : (
              Object.entries(planDist).map(([plan, count]) => (
                <div key={plan} className="flex justify-between items-center">
                  <span className="text-sm">{plan}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${((count as number) / overview.totalTenants) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-6 text-right">{count as number}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Monthly Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Crecimiento Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(monthlyGrowth).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de crecimiento</p>
            ) : (
              Object.entries(monthlyGrowth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, count]) => {
                  const [y, m] = month.split('-')
                  const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
                  return (
                    <div key={month} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground capitalize">{label}</span>
                      <Badge variant="secondary">+{count as number} tenants</Badge>
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tenants Recientes
          </CardTitle>
          <Link href="/admin/tenants" className="text-xs text-blue-600 hover:underline">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTenants.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.active ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{t.plan}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
