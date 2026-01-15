'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Receipt, CreditCard, Settings as SettingsIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { UsersConfig } from './users-config'
import { ElectronicBillingConfig } from './electronic-billing-config'
import { SubscriptionConfig } from './subscription-config'
import { GeneralConfig } from './general-config'

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export function SettingsScreen() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('users')

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update settings')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast('Configuración actualizada exitosamente', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'No se pudo actualizar la configuración', 'error')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              No se pudieron cargar las configuraciones. Por favor, intenta de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const settings = data?.settings || null

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las configuraciones de tu empresa
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Facturación Electrónica
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Suscripción
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersConfig />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <ElectronicBillingConfig
            settings={settings}
            onSave={(data) => updateSettingsMutation.mutate(data)}
            isLoading={updateSettingsMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <SubscriptionConfig
            settings={settings}
            onSave={(data) => updateSettingsMutation.mutate(data)}
            isLoading={updateSettingsMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <GeneralConfig
            settings={settings}
            onSave={(data) => updateSettingsMutation.mutate(data)}
            isLoading={updateSettingsMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

