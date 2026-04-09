'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  ToggleRight,
  Search,
  Loader2,
  Building2,
  Zap,
  FlaskConical,
  Package,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function FeatureFlagsClient() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTenant, setSelectedTenant] = useState<string>('all')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async () => {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error('Error al cargar feature flags')
      return res.json()
    }
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ tenantId, featureFlagId, enabled }: { tenantId: string; featureFlagId: string; enabled: boolean }) => {
      const res = await fetch('/api/admin/feature-flags/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, featureFlagId, enabled })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cambiar feature flag')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] })
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    }
  })

  const flags = data?.flags || []
  const tenants = data?.tenants || []

  const filteredFlags = useMemo(() => {
    return flags.filter((f: any) => {
      if (selectedCategory !== 'all' && f.category !== selectedCategory) return false
      if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase()) && !f.key.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [flags, selectedCategory, searchTerm])

  const filteredTenants = useMemo(() => {
    if (selectedTenant === 'all') return tenants
    return tenants.filter((t: any) => t.id === selectedTenant)
  }, [tenants, selectedTenant])

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'module': return <Package className="h-4 w-4 text-blue-500" />
      case 'feature': return <Zap className="h-4 w-4 text-amber-500" />
      case 'beta': return <FlaskConical className="h-4 w-4 text-purple-500" />
      default: return <ToggleRight className="h-4 w-4" />
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'module': return 'Módulo'
      case 'feature': return 'Feature'
      case 'beta': return 'Beta'
      default: return cat
    }
  }

  const isFlagEnabledForTenant = (flag: any, tenantId: string) => {
    if (flag.isGlobal) return true
    const tf = flag.tenantFlags?.find((tf: any) => tf.tenantId === tenantId)
    return tf?.enabled || false
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Feature Flags & Provisioning"
          description="Controla qué módulos ve cada tenant según su plan."
          icon={<ToggleRight className="h-5 w-5" />}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags & Provisioning"
        description="Controla qué módulos ve cada tenant según su plan."
        icon={<ToggleRight className="h-5 w-5" />}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar flag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="px-3 py-2 border rounded-lg bg-background text-sm"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">Todas las categorías</option>
          <option value="module">Módulos</option>
          <option value="feature">Features</option>
          <option value="beta">Beta Testing</option>
        </select>
        <select
          className="px-3 py-2 border rounded-lg bg-background text-sm"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="all">Todos los tenants</option>
          {tenants.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Módulos</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.filter((f: any) => f.category === 'module').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Features</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.filter((f: any) => f.category === 'feature').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Beta</CardTitle>
            <FlaskConical className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.filter((f: any) => f.category === 'beta').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Matriz de Permisos por Tenant</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium sticky left-0 bg-background z-10 min-w-[200px]">Feature</th>
                  {filteredTenants.map((t: any) => (
                    <th key={t.id} className="text-center p-3 font-medium min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs truncate max-w-[90px]">{t.name}</span>
                        {!t.active && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map((flag: any) => (
                  <tr key={flag.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(flag.category)}
                        <div>
                          <p className="font-medium">{flag.name}</p>
                          <p className="text-xs text-muted-foreground">{flag.key}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {getCategoryLabel(flag.category)}
                        </Badge>
                      </div>
                    </td>
                    {filteredTenants.map((tenant: any) => {
                      const isEnabled = isFlagEnabledForTenant(flag, tenant.id)
                      return (
                        <td key={tenant.id} className="text-center p-3">
                          <button
                            onClick={() => {
                              if (flag.isGlobal && isEnabled) {
                                toast('Este flag está habilitado globalmente. Desactívalo a nivel global primero.', 'error')
                                return
                              }
                              toggleMutation.mutate({
                                tenantId: tenant.id,
                                featureFlagId: flag.id,
                                enabled: !isEnabled,
                              })
                            }}
                            disabled={toggleMutation.isPending}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                              isEnabled
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={isEnabled ? 'Desactivar' : 'Activar'}
                          >
                            {isEnabled ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredFlags.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ToggleRight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No se encontraron feature flags</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
