'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import {
  CreditCard,
  Plus,
  Edit,
  Save,
  X,
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

export function SubscriptionsClient() {
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'plans' | 'billing'>('plans')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/plans')
      if (!res.ok) throw new Error('Error al cargar planes')
      return res.json()
    }
  })

  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error('Error al cargar tenants')
      return res.json()
    }
  })

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear plan')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
      setShowPlanForm(false)
      toast('Plan creado exitosamente', 'success')
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    }
  })

  const tenantsList = Array.isArray(tenants) ? tenants : []

  // Tenants with payment issues
  const overdueSubscriptions = tenantsList.filter((t: any) => {
    const sub = t.subscriptions?.[0]
    if (!sub) return false
    const endDate = sub.endDate ? new Date(sub.endDate) : null
    return endDate && endDate < new Date() && sub.status === 'active'
  })

  const pendingPayments = tenantsList.filter((t: any) => {
    const sub = t.subscriptions?.[0]
    return sub?.status === 'pending_payment'
  })

  const formatCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suscripciones y Pagos"
        description="Gestión de planes comerciales, pasarelas y automatización de cobranza."
        icon={<CreditCard className="h-5 w-5" />}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('plans')}
        >
          Planes de Suscripción
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'billing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('billing')}
        >
          Cobranza y Pagos
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planes Activos</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plans?.filter((p: any) => p.active).length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {tenantsList.filter((t: any) => t.subscriptions?.some((s: any) => s.status === 'active')).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overdueSubscriptions.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={() => setShowPlanForm(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Plan
            </Button>
          </div>

          {/* Plan Form */}
          {showPlanForm && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle>Crear Plan de Suscripción</CardTitle>
              </CardHeader>
              <CardContent>
                <PlanForm
                  onCancel={() => setShowPlanForm(false)}
                  onSubmit={(data: any) => createPlanMutation.mutate(data)}
                  isLoading={createPlanMutation.isPending}
                />
              </CardContent>
            </Card>
          )}

          {/* Plans Grid */}
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans?.map((plan: any) => {
                const subscriberCount = tenantsList.filter((t: any) =>
                  t.subscriptions?.some((s: any) => s.planId === plan.id && s.status === 'active')
                ).length
                const features = plan.features ? JSON.parse(plan.features) : []

                return (
                  <Card key={plan.id} className={`relative overflow-hidden ${!plan.active ? 'opacity-60' : ''}`}>
                    {plan.name === 'Business' && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        POPULAR
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                        </div>
                        <Badge variant={plan.active ? 'default' : 'secondary'}>
                          {plan.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <span className="text-3xl font-bold">{formatCOP(plan.price)}</span>
                        <span className="text-sm text-muted-foreground ml-1">
                          /{plan.interval === 'monthly' ? 'mes' : 'año'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{subscriberCount} suscriptor{subscriberCount !== 1 ? 'es' : ''}</span>
                      </div>

                      {features.length > 0 && (
                        <ul className="space-y-1.5">
                          {features.slice(0, 5).map((f: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                          {features.length > 5 && (
                            <li className="text-xs text-muted-foreground pl-5">
                              +{features.length - 5} más...
                            </li>
                          )}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Pasarelas Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pasarelas de Pago Configuradas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Wompi</p>
                    <p className="text-xs text-muted-foreground">Integración activa vía webhook</p>
                  </div>
                </div>
                <Badge className="bg-green-600">Conectado</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Clock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nequi / Daviplata</p>
                    <p className="text-xs text-muted-foreground">Pendiente de integración</p>
                  </div>
                </div>
                <Badge variant="secondary">Próximamente</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Suscripciones Vencidas ({overdueSubscriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueSubscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay suscripciones vencidas 🎉</p>
              ) : (
                <div className="space-y-3">
                  {overdueSubscriptions.map((t: any) => {
                    const sub = t.subscriptions?.[0]
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50 dark:bg-red-900/10">
                        <div>
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.slug} · Venció: {sub?.endDate ? formatDate(sub.endDate) : 'N/A'}</p>
                        </div>
                        <Badge variant="destructive">Vencida</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Pagos Pendientes ({pendingPayments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay pagos pendientes</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </div>
                      <Badge className="bg-amber-500">Pendiente</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function PlanForm({ onCancel, onSubmit, isLoading }: { onCancel: () => void; onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'COP',
    interval: 'monthly',
    features: '',
    active: true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const features = formData.features
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0)

    onSubmit({
      ...formData,
      price: parseFloat(formData.price),
      features,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nombre del Plan *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="ej. Premium"
            required
          />
        </div>
        <div>
          <Label>Precio *</Label>
          <Input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="99900"
            required
          />
        </div>
      </div>
      <div>
        <Label>Descripción</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción breve del plan"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Moneda</Label>
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
          >
            <option value="COP">COP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <Label>Intervalo</Label>
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={formData.interval}
            onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
          >
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Características (una por línea)</Label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg min-h-[120px] bg-background"
          value={formData.features}
          onChange={(e) => setFormData({ ...formData, features: e.target.value })}
          placeholder="Hasta 5 usuarios&#10;POS incluido&#10;Reportes avanzados"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Crear Plan
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  )
}
