'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  DollarSign,
  Database,
  Plus,
  Edit,
  Save,
  X,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

interface TenantDetailsProps {
  tenantId: string
  onBack: () => void
}

interface TenantEditFormProps {
  tenant: any
  isEditing: boolean
  onSave: (data: any) => void
  onCancel: () => void
}

function TenantEditForm({ tenant, isEditing, onSave, onCancel }: TenantEditFormProps) {
  const [formData, setFormData] = useState({
    name: tenant.name,
    email: tenant.email || '',
    phone: tenant.phone || '',
    address: tenant.address || '',
    active: tenant.active,
    databaseUrl: tenant.databaseUrl
  })

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <Label>Nombre</Label>
          <p className="text-sm font-medium">{tenant.name}</p>
        </div>
        <div>
          <Label>Slug</Label>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400">{tenant.slug}</p>
        </div>
        <div>
          <Label>Email</Label>
          <p className="text-sm">{tenant.email || 'N/A'}</p>
        </div>
        <div>
          <Label>Teléfono</Label>
          <p className="text-sm">{tenant.phone || 'N/A'}</p>
        </div>
        <div>
          <Label>Base de Datos</Label>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
            {tenant.databaseUrl}
          </p>
        </div>
        <div>
          <Label>Estado</Label>
          <p className="text-sm">{tenant.active ? 'Activo' : 'Inactivo'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <Label>Slug</Label>
        <p className="text-sm font-mono text-gray-600 dark:text-gray-400">{tenant.slug}</p>
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div>
        <Label>Teléfono</Label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>
      <div>
        <Label>Base de Datos</Label>
        <Input
          value={formData.databaseUrl}
          onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
        />
      </div>
      <div>
        <Label>Estado</Label>
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant={formData.active ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormData({ ...formData, active: true })}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Activo
          </Button>
          <Button
            variant={!formData.active ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormData({ ...formData, active: false })}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Inactivo
          </Button>
        </div>
      </div>
      <div className="flex gap-2 pt-4">
        <Button
          onClick={() => onSave(formData)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          <Save className="h-4 w-4 mr-2" />
          Guardar
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </div>
  )
}

export function TenantDetails({ tenantId, onBack }: TenantDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin-tenant', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}`)
      if (!res.ok) throw new Error('Error al cargar tenant')
      return res.json()
    }
  })

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/plans')
      if (!res.ok) throw new Error('Error al cargar planes')
      return res.json()
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar tenant')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
      setIsEditing(false)
      toast('Tenant actualizado exitosamente', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Error al actualizar tenant', 'error')
    }
  })

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear suscripción')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      setShowSubscriptionForm(false)
      toast('Suscripción creada exitosamente. Las funciones del nuevo plan están ahora disponibles.', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Error al crear suscripción', 'error')
    }
  })

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/subscriptions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar suscripción')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      setEditingSubscriptionId(null)
      toast('Suscripción actualizada exitosamente. Las funciones del nuevo plan están ahora disponibles.', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Error al actualizar suscripción', 'error')
    }
  })

  if (isLoading) {
    return <div className="text-center py-12">Cargando...</div>
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tenant no encontrado</p>
        <Button onClick={onBack} className="mt-4">Volver</Button>
      </div>
    )
  }

  const activeSubscription = tenant.subscriptions?.find((s: any) => s.status === 'active')
  const plan = plans?.find((p: any) => p.id === activeSubscription?.planId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">{tenant.name}</h1>
        {tenant.active ? (
          <Badge className="bg-green-600">Activo</Badge>
        ) : (
          <Badge variant="destructive">Inactivo</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Información del Tenant */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Información del Tenant</CardTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    updateMutation.mutate({
                      name: tenant.name,
                      email: tenant.email,
                      phone: tenant.phone,
                      address: tenant.address,
                      active: tenant.active,
                      databaseUrl: tenant.databaseUrl
                    })
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <TenantEditForm
              tenant={tenant}
              isEditing={isEditing}
              onSave={(data) => {
                updateMutation.mutate(data)
              }}
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>

        {/* Suscripciones */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Suscripciones</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowSubscriptionForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Suscripción
            </Button>
          </CardHeader>
          <CardContent>
            {showSubscriptionForm ? (
              <SubscriptionForm
                plans={plans || []}
                onCancel={() => setShowSubscriptionForm(false)}
                onSubmit={(data: any) => {
                  createSubscriptionMutation.mutate(data)
                }}
              />
            ) : (
              <div className="space-y-4">
                {tenant.subscriptions?.length > 0 ? (
                  tenant.subscriptions.map((sub: any) => {
                    const subPlan = plans?.find((p: any) => p.id === sub.planId)
                    const isEditing = editingSubscriptionId === sub.id
                    return (
                      <div key={sub.id} className="p-4 border rounded-lg">
                        {isEditing ? (
                          <SubscriptionForm
                            plans={plans || []}
                            subscription={sub}
                            onCancel={() => setEditingSubscriptionId(null)}
                            onSubmit={(data: any) => {
                              updateSubscriptionMutation.mutate({
                                subscriptionId: sub.id,
                                ...data
                              })
                            }}
                          />
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold text-lg">{subPlan?.name || 'Plan'}</div>
                                <Badge
                                  variant={
                                    sub.status === 'active' ? 'default' :
                                    sub.status === 'cancelled' ? 'destructive' :
                                    'secondary'
                                  }
                                  className={
                                    sub.status === 'active' ? 'bg-green-600' : ''
                                  }
                                >
                                  {sub.status === 'active' ? 'Activa' : 
                                   sub.status === 'cancelled' ? 'Cancelada' :
                                   sub.status === 'expired' ? 'Expirada' : sub.status}
                                </Badge>
                              </div>
                              {subPlan && (
                                <div className="text-right">
                                  <div className="font-semibold text-lg">
                                    ${subPlan.price.toLocaleString()} {subPlan.currency}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    /{subPlan.interval === 'monthly' ? 'mes' : 'año'}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-3">
                              <div>
                                <span className="text-gray-500">Inicio:</span>
                                <div className="font-medium">{formatDate(sub.startDate)}</div>
                              </div>
                              {sub.endDate && (
                                <div>
                                  <span className="text-gray-500">Fin:</span>
                                  <div className="font-medium">{formatDate(sub.endDate)}</div>
                                </div>
                              )}
                            </div>
                            {sub.status === 'active' && (
                              <div className="mt-3 pt-3 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingSubscriptionId(sub.id)}
                                  className="w-full"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Cambiar Plan
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="text-gray-500 text-center py-8">No hay suscripciones</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SubscriptionForm({ plans, subscription, onCancel, onSubmit }: any) {
  const isEditing = !!subscription
  const [formData, setFormData] = useState({
    planId: subscription?.planId || '',
    startDate: subscription?.startDate 
      ? new Date(subscription.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    endDate: subscription?.endDate 
      ? new Date(subscription.endDate).toISOString().split('T')[0]
      : '',
    status: subscription?.status || 'active',
    autoRenew: subscription?.autoRenew !== undefined ? subscription.autoRenew : true
  })

  const selectedPlan = plans?.find((p: any) => p.id === formData.planId)
  const currentPlan = subscription ? plans?.find((p: any) => p.id === subscription.planId) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Plan *</Label>
        <select
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.planId}
          onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
          required
        >
          <option value="">Seleccionar plan</option>
          {plans.map((plan: any) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} - ${plan.price.toLocaleString()} {plan.currency}/{plan.interval === 'monthly' ? 'mes' : 'año'}
            </option>
          ))}
        </select>
        {isEditing && currentPlan && selectedPlan && currentPlan.id !== selectedPlan.id && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Cambio de Plan: {currentPlan.name} → {selectedPlan.name}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Al guardar, la suscripción actual se cancelará y se creará una nueva con el plan seleccionado. 
              Las funciones del nuevo plan estarán disponibles inmediatamente.
            </p>
          </div>
        )}
      </div>

      <div>
        <Label>Fecha de Inicio *</Label>
        <Input
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          required
        />
      </div>

      <div>
        <Label>Fecha de Fin</Label>
        <Input
          type="date"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
        />
      </div>

      <div>
        <Label>Estado</Label>
        <select
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          <option value="active">Activa</option>
          <option value="trial">Prueba</option>
          <option value="cancelled">Cancelada</option>
          <option value="expired">Expirada</option>
        </select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600">
          {isEditing ? 'Actualizar Suscripción' : 'Crear Suscripción'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

