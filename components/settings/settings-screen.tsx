'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Receipt, CreditCard, Settings as SettingsIcon, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UsersConfig } from './users-config'
import { ElectronicBillingConfig } from './electronic-billing-config'
import { SubscriptionConfig } from './subscription-config'
import { GeneralConfig } from './general-config'
import { DataConfig } from './data-config'
import { AlegraConfig } from './alegra-config'
import { PaymentMethodsConfig } from './payment-methods-config'
import { TaxesPage } from './taxes-page'
import { Wallet, Percent } from 'lucide-react'

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export function SettingsScreen() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('users')

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

  // Referencia para rastrear si ya se procesaron los parámetros de pago
  const processedPaymentRef = useRef<string | null>(null)

  // Manejar parámetros de redirección de Mercado Pago
  useEffect(() => {
    const paymentStatus = searchParams.get('payment')
    const externalReference = searchParams.get('external_reference')
    const preferenceId = searchParams.get('preference_id')
    const collectionId = searchParams.get('collection_id')
    const collectionStatus = searchParams.get('collection_status')
    const paymentId = searchParams.get('payment_id')
    const status = searchParams.get('status')

    // Función helper para verificar si un valor es válido (no es 'null' string)
    const isValidValue = (value: string | null) => value && value !== 'null' && value.trim() !== ''

    // Crear una clave única para este conjunto de parámetros
    const paymentKey = `${paymentStatus || ''}-${externalReference || ''}-${preferenceId || ''}-${collectionId || ''}`

    // Si ya procesamos estos parámetros, no hacer nada
    if (processedPaymentRef.current === paymentKey) {
      return
    }

    if (paymentStatus || (externalReference && isValidValue(externalReference))) {
      // Marcar como procesado ANTES de hacer cualquier cosa
      processedPaymentRef.current = paymentKey

      // Cambiar a la pestaña de suscripción
      setActiveTab('subscription')

      // Invalidar queries para actualizar datos
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] })

      // Mostrar mensaje según el estado del pago
      if (paymentStatus === 'success') {
        toast('¡Pago procesado exitosamente! Tu suscripción ha sido activada.', 'success')
      } else if (paymentStatus === 'failure') {
        // Construir mensaje de error más informativo
        let errorMessage = 'El pago no pudo ser procesado.'

        if (isValidValue(paymentId)) {
          errorMessage = `El pago fue rechazado. ID de pago: ${paymentId}.`
        } else if (isValidValue(collectionStatus)) {
          errorMessage = `El pago no pudo ser procesado. Estado: ${collectionStatus}.`
        } else if (isValidValue(status)) {
          errorMessage = `El pago no pudo ser procesado. Estado: ${status}.`
        }

        errorMessage += ' Puedes intentar nuevamente desde la sección de suscripción.'
        toast(errorMessage, 'error')
      } else if (paymentStatus === 'pending') {
        toast('Tu pago está siendo procesado. Te notificaremos cuando se complete.', 'info')
      } else if (!paymentStatus && isValidValue(externalReference)) {
        // Si hay external_reference pero no payment status, puede ser una redirección incompleta
        // El webhook debería procesar el pago, pero mostramos un mensaje informativo
        toast('Procesando información del pago. Por favor, espera unos momentos...', 'info')
      }

      // Limpiar los parámetros de la URL INMEDIATAMENTE para evitar re-ejecuciones
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('payment')
      newUrl.searchParams.delete('external_reference')
      newUrl.searchParams.delete('preference_id')
      newUrl.searchParams.delete('collection_id')
      newUrl.searchParams.delete('collection_status')
      newUrl.searchParams.delete('payment_id')
      newUrl.searchParams.delete('status')
      newUrl.searchParams.delete('payment_type')
      newUrl.searchParams.delete('merchant_order_id')
      newUrl.searchParams.delete('site_id')
      newUrl.searchParams.delete('processing_mode')
      newUrl.searchParams.delete('merchant_account_id')

      // Mantener solo el tab si está presente
      const tabParam = newUrl.searchParams.get('tab')
      if (tabParam) {
        newUrl.searchParams.set('tab', 'subscription')
      }

      // Reemplazar la URL inmediatamente para evitar re-ejecuciones del efecto
      router.replace(newUrl.pathname + newUrl.search, { scroll: false })
    } else if (searchParams.get('tab')) {
      // Si hay un parámetro tab, cambiar a esa pestaña
      setActiveTab(searchParams.get('tab') || 'users')
    }
  }, [searchParams, queryClient, router, toast])

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
        <TabsList className="flex w-full overflow-x-auto h-auto p-1 gap-1 bg-muted/20">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Facturación Electrónica
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Mercado Pago
            </TabsTrigger>
          )}
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Suscripción
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="payments-methods" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="taxes" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Impuestos
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Datos / Backups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersConfig />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <AlegraConfig tenantId={(session?.user as any)?.tenantId} />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mercado Pago - Configuración Global</CardTitle>
                <CardDescription>
                  Las credenciales de Mercado Pago se configuran mediante variables de entorno.
                  Los tenants no tienen acceso a esta configuración ya que los pagos se procesan
                  directamente a Clivaro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
                      <strong>Variables de entorno requeridas:</strong>
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li><code>MERCADOPAGO_ACCESS_TOKEN</code> - Token de acceso de Mercado Pago</li>
                      <li><code>MERCADOPAGO_PUBLIC_KEY</code> - Clave pública de Mercado Pago (opcional)</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-900 dark:text-green-100">
                      <strong>Estado:</strong> {process.env.NEXT_PUBLIC_MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '⚠️ No configurado'}
                    </p>
                    <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                      Las credenciales se cargan desde las variables de entorno del servidor.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

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

        <TabsContent value="payments-methods" className="space-y-4">
          <PaymentMethodsConfig />
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <TaxesPage />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataConfig
            settings={settings}
            onSave={(data) => updateSettingsMutation.mutate(data)}
            isLoading={updateSettingsMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

