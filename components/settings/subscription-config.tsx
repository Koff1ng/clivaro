'use client'

import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CreditCard, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface SubscriptionFormData {
  subscriptionTrialDays: number
  subscriptionGracePeriodDays: number
  subscriptionAutoRenew: boolean
}

interface SubscriptionConfigProps {
  settings: any
  onSave: (data: Partial<SubscriptionFormData>) => void
  isLoading: boolean
}

async function fetchSubscription() {
  const res = await fetch('/api/tenant/plan')
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return res.json()
}

export function SubscriptionConfig({ settings, onSave, isLoading }: SubscriptionConfigProps) {
  const { data: subscriptionData } = useQuery({
    queryKey: ['tenant-plan'],
    queryFn: fetchSubscription,
  })

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SubscriptionFormData>({
    defaultValues: {
      subscriptionTrialDays: settings?.subscriptionTrialDays || 14,
      subscriptionGracePeriodDays: settings?.subscriptionGracePeriodDays || 7,
      subscriptionAutoRenew: settings?.subscriptionAutoRenew ?? true,
    }
  })

  const autoRenew = watch('subscriptionAutoRenew')

  const onSubmit = (data: SubscriptionFormData) => {
    onSave(data)
  }

  const plan = subscriptionData?.plan
  const subscription = subscriptionData?.subscription

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
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold">Suscripción Actual</h4>
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
                    <div>
                      <span className="text-muted-foreground">Vence:</span>
                      <span className="ml-2 font-medium">
                        {new Date(subscription.endDate).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Días de Prueba */}
          <div className="space-y-2">
            <Label htmlFor="subscriptionTrialDays">Días de Prueba Gratuita</Label>
            <Input
              id="subscriptionTrialDays"
              type="number"
              min="0"
              max="90"
              {...register('subscriptionTrialDays', {
                required: 'Los días de prueba son requeridos',
                min: { value: 0, message: 'Debe ser mayor o igual a 0' },
                max: { value: 90, message: 'No puede exceder 90 días' },
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-muted-foreground">
              Número de días de prueba gratuita para nuevos usuarios
            </p>
            {errors.subscriptionTrialDays && (
              <p className="text-sm text-destructive">{errors.subscriptionTrialDays.message}</p>
            )}
          </div>

          {/* Período de Gracia */}
          <div className="space-y-2">
            <Label htmlFor="subscriptionGracePeriodDays">Días de Período de Gracia</Label>
            <Input
              id="subscriptionGracePeriodDays"
              type="number"
              min="0"
              max="30"
              {...register('subscriptionGracePeriodDays', {
                required: 'Los días de gracia son requeridos',
                min: { value: 0, message: 'Debe ser mayor o igual a 0' },
                max: { value: 30, message: 'No puede exceder 30 días' },
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-muted-foreground">
              Días adicionales después de la expiración antes de suspender el acceso
            </p>
            {errors.subscriptionGracePeriodDays && (
              <p className="text-sm text-destructive">{errors.subscriptionGracePeriodDays.message}</p>
            )}
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
              onCheckedChange={(checked) => setValue('subscriptionAutoRenew', checked)}
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

