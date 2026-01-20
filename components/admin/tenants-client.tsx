'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Search, 
  Building2, 
  Calendar, 
  DollarSign,
  Database,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { TenantForm } from './tenant-form'
import { TenantDetails } from './tenant-details'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'

export function TenantsClient() {
  const [showForm, setShowForm] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error('Error al cargar tenants')
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al eliminar tenant')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
      toast('Tenant eliminado exitosamente', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Error al eliminar tenant', 'error')
    }
  })

  const filteredTenants = tenants?.filter((tenant: any) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const getStatusBadge = (subscription: any) => {
    if (!subscription) return <Badge variant="secondary">Sin suscripción</Badge>
    
    const now = new Date()
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null
    
    if (subscription.status === 'cancelled') {
      return <Badge variant="destructive">Cancelada</Badge>
    }
    if (subscription.status === 'expired') {
      return <Badge variant="destructive">Expirada</Badge>
    }
    if (endDate && endDate < now) {
      return <Badge variant="destructive">Expirada</Badge>
    }
    if (subscription.status === 'trial') {
      return <Badge className="bg-yellow-500">Prueba</Badge>
    }
    return <Badge className="bg-green-600">Activa</Badge>
  }


  if (selectedTenant) {
    return (
      <TenantDetails
        tenantId={selectedTenant}
        onBack={() => setSelectedTenant(null)}
      />
    )
  }

  if (showForm) {
    return (
      <TenantForm
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false)
          queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Tenants"
        description="Administra empresas, planes y suscripciones desde el panel de super administrador."
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tenant
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, email o slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tenants?.filter((t: any) => t.active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Suscripción</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants?.filter((t: any) => t.subscriptions?.some((s: any) => s.status === 'active')).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiradas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {tenants?.filter((t: any) => {
                const sub = t.subscriptions?.[0]
                if (!sub || sub.status !== 'active') return false
                const endDate = sub.endDate ? new Date(sub.endDate) : null
                return endDate && endDate < new Date()
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants List */}
      {isLoading && (!tenants || tenants.length === 0) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando tenants...</span>
        </div>
      ) : (
      <div className="grid gap-4">
        {filteredTenants.map((tenant: any) => {
          const activeSubscription = tenant.subscriptions?.find((s: any) => s.status === 'active')
          const plan = plans?.find((p: any) => p.id === activeSubscription?.planId)
          
          return (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h3 className="text-xl font-semibold">{tenant.name}</h3>
                      {tenant.active ? (
                        <Badge className="bg-green-600">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                      {getStatusBadge(activeSubscription)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Slug:</span>
                        <span className="ml-2 font-mono">{tenant.slug}</span>
                      </div>
                      {tenant.email && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Email:</span>
                          <span className="ml-2">{tenant.email}</span>
                        </div>
                      )}
                      {plan && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                          <span className="ml-2 font-semibold">{plan.name}</span>
                        </div>
                      )}
                      {activeSubscription && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Vence:</span>
                          <span className="ml-2">
                            {activeSubscription.endDate 
                              ? formatDate(activeSubscription.endDate)
                              : 'Sin fecha'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTenant(tenant.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalles
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(tenant.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}

      {filteredTenants.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No se encontraron tenants' : 'No hay tenants registrados'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


