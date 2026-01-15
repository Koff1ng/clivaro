'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CreditCard, Calendar, Clock, AlertCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { PaySubscriptionButton } from '@/components/subscriptions/pay-subscription-button'

interface SubscriptionConfigProps {
  settings: any
  onSave: (data: any) => void
  isLoading: boolean
}

async function fetchSubscription() {
  const res = await fetch('/api/tenant/plan')
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return res.json()
}

export function SubscriptionConfig({ settings, onSave, isLoading }: SubscriptionConfigProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [autoRenew, setAutoRenew] = useState(settings?.subscriptionAutoRenew ?? true)

  const { data: subscriptionData } = useQuery({
    queryKey: ['tenant-plan'],
    queryFn: fetchSubscription,
  })

  const updateAutoRenewMutation = useMutation({
    mutationFn: async (value: boolean) => {
      onSave({ subscriptionAutoRenew: value })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast('Configuración actualizada', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'Error al actualizar', 'error')
    },
  })

  const plan = subscriptionData?.plan
  const subscription = subscriptionData?.subscription

  // Calcular días restantes
  const getRemainingDays = () => {
    if (!subscription) return null

    const now = new Date()
    let targetDate: Date | null = null
    let label = ''

    if (subscription.status === 'trial' && subscription.trialEndDate) {
      targetDate = new Date(subscription.trialEndDate)
      label = 'días restantes de prueba'
    } else if (subscription.endDate) {
      targetDate = new Date(subscription.endDate)
      label = 'días restantes de suscripción'
    }

    if (!targetDate) return null

    const diffTime = targetDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return { days: diffDays, label }
  }

  const remainingDays = getRemainingDays()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Configuración de Suscripción
        </CardTitle>
        <CardDescription>
          Gestiona los tiempos de prueba, períodos de gracia y renovación automática
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información de la Suscripción Actual */}
        {plan && (
          <div className="p-4 bg-muted rounded-lg space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Suscripción Actual
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plan:</span>
                <span className="ml-2 font-medium">{plan.name}</span>
              </div>
              {subscription && (
                <>
                  <div>
                    <span className="text-muted-foreground">Estado:</span>
                    <span className="ml-2 font-medium capitalize">{subscription.status}</span>
                  </div>
                  {subscription.endDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">Vence:</span>
                        <span className="ml-2 font-medium">
                          {new Date(subscription.endDate).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  )}
                  {remainingDays && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">{remainingDays.label}:</span>
                        <span className={cn(
                          "ml-2 font-bold",
                          remainingDays.days <= 7 ? "text-red-600" : remainingDays.days <= 30 ? "text-orange-600" : "text-green-600"
                        )}>
                          {remainingDays.days} {remainingDays.days === 1 ? 'día' : 'días'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {subscription?.status === 'trial' && subscription?.trialEndDate && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Período de Prueba:</strong> Tu prueba gratuita finaliza el{' '}
                  {new Date(subscription.trialEndDate).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
            
            {/* Botón de pago para suscripciones expiradas o pendientes */}
            {subscription && (
              <div className="mt-4 space-y-2">
                {(subscription.status === 'expired' || 
                  subscription.status === 'pending_payment' || 
                  (subscription.status === 'trial' && subscription.trialEndDate && new Date(subscription.trialEndDate) < new Date()) ||
                  !subscription) && plan && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                          {subscription?.status === 'expired' ? 'Suscripción Expirada' : 
                           subscription?.status === 'pending_payment' ? 'Pago Pendiente' :
                           'Suscripción Requerida'}
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                          {subscription?.status === 'expired' 
                            ? 'Tu suscripción ha expirado. Renueva ahora para continuar usando el servicio.'
                            : subscription?.status === 'pending_payment'
                            ? 'Tienes un pago pendiente. Completa el pago para activar tu suscripción.'
                            : 'Activa tu suscripción para comenzar a usar el servicio.'}
                        </p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-orange-900 dark:text-orange-100">
                              <span className="font-semibold">Monto a pagar:</span>{' '}
                              <span className="text-lg font-bold">{formatCurrency(plan.price)}</span>
                            </p>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                              {plan.interval === 'monthly' ? 'Pago mensual' : 'Pago anual'}
                            </p>
                          </div>
                          {subscription && (
                            <PaySubscriptionButton
                              subscriptionId={subscription.id}
                              planName={plan.name}
                              amount={plan.price}
                              onPaymentCreated={() => {
                                queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 pt-4 border-t">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Nota:</strong> Los tiempos de prueba y período de gracia solo pueden ser modificados por el administrador del sistema.
            </p>
          </div>

          {/* Renovación Automática */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="subscriptionAutoRenew" className="text-base">
                Renovación Automática
              </Label>
              <p className="text-sm text-muted-foreground">
                Renovar automáticamente la suscripción al finalizar el período
              </p>
            </div>
            <Switch
              id="subscriptionAutoRenew"
              checked={autoRenew}
              onCheckedChange={(checked) => {
                setAutoRenew(checked)
                updateAutoRenewMutation.mutate(checked)
              }}
              disabled={updateAutoRenewMutation.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

