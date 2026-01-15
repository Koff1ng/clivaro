'use client'

import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CreditCard, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'

interface MercadoPagoFormData {
  mercadoPagoEnabled: boolean
  mercadoPagoAccessToken: string
  mercadoPagoPublicKey: string
}

interface MercadoPagoConfigProps {
  settings: any
  onSave: (data: Partial<MercadoPagoFormData>) => void
  isLoading: boolean
}

async function validateCredentials(accessToken: string) {
  const res = await fetch('/api/payments/mercadopago/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Error al validar credenciales')
  }
  return res.json()
}

export function MercadoPagoConfig({ settings, onSave, isLoading }: MercadoPagoConfigProps) {
  const { toast } = useToast()
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MercadoPagoFormData>({
    defaultValues: {
      mercadoPagoEnabled: settings?.mercadoPagoEnabled || false,
      mercadoPagoAccessToken: settings?.mercadoPagoAccessToken || '',
      mercadoPagoPublicKey: settings?.mercadoPagoPublicKey || '',
    }
  })

  const enabled = watch('mercadoPagoEnabled')
  const accessToken = watch('mercadoPagoAccessToken')

  const validateMutation = useMutation({
    mutationFn: validateCredentials,
    onSuccess: () => {
      setValidationResult('success')
      toast('Credenciales válidas', 'success')
    },
    onError: (error: any) => {
      setValidationResult('error')
      toast(error.message || 'Credenciales inválidas', 'error')
    },
  })

  const handleValidate = async () => {
    if (!accessToken.trim()) {
      toast('Ingresa el Access Token primero', 'warning')
      return
    }
    setIsValidating(true)
    setValidationResult(null)
    try {
      await validateMutation.mutateAsync(accessToken)
    } finally {
      setIsValidating(false)
    }
  }

  const onSubmit = (data: MercadoPagoFormData) => {
    onSave(data)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://your-domain.com'
  const webhookUrl = `${baseUrl}/api/payments/mercadopago/webhook`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Mercado Pago
        </CardTitle>
        <CardDescription>
          Configura tu integración con Mercado Pago para aceptar pagos en línea. Obtén tus credenciales en{' '}
          <a
            href="https://www.mercadopago.com.co/developers/panel/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            tu panel de desarrolladores
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Habilitar Mercado Pago */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="mercadoPagoEnabled" className="text-base">
                Habilitar Mercado Pago
              </Label>
              <p className="text-sm text-muted-foreground">
                Activa los pagos en línea con Mercado Pago
              </p>
            </div>
            <Switch
              id="mercadoPagoEnabled"
              checked={enabled}
              onCheckedChange={(checked) => setValue('mercadoPagoEnabled', checked)}
              disabled={isLoading}
            />
          </div>

          {enabled && (
            <>
              {/* Access Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mercadoPagoAccessToken">Access Token *</Label>
                  {accessToken && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleValidate}
                      disabled={isValidating || isLoading}
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        'Validar'
                      )}
                    </Button>
                  )}
                </div>
                <Input
                  id="mercadoPagoAccessToken"
                  type="password"
                  {...register('mercadoPagoAccessToken', {
                    required: enabled ? 'Access Token es requerido' : false,
                  })}
                  disabled={isLoading}
                  placeholder="APP_USR-xxxxxxxxxxxxx"
                />
                {errors.mercadoPagoAccessToken && (
                  <p className="text-sm text-destructive">{errors.mercadoPagoAccessToken.message}</p>
                )}
                {validationResult === 'success' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Credenciales válidas
                  </div>
                )}
                {validationResult === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Credenciales inválidas. Verifica tu Access Token.
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Token de acceso privado de Mercado Pago. Se usa para procesar pagos.
                </p>
              </div>

              {/* Public Key */}
              <div className="space-y-2">
                <Label htmlFor="mercadoPagoPublicKey">Public Key</Label>
                <Input
                  id="mercadoPagoPublicKey"
                  type="text"
                  {...register('mercadoPagoPublicKey')}
                  disabled={isLoading}
                  placeholder="APP_USR-xxxxxxxxxxxxx"
                />
                <p className="text-sm text-muted-foreground">
                  Clave pública de Mercado Pago. Se usa para inicializar el checkout en el frontend (opcional).
                </p>
              </div>

              {/* Webhook URL Info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Configura el Webhook en Mercado Pago
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                      Copia esta URL y configúrala en tu panel de Mercado Pago para recibir notificaciones de pagos:
                    </p>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-blue-300 dark:border-blue-700">
                      <code className="text-xs text-blue-900 dark:text-blue-100 break-all">
                        {webhookUrl}
                      </code>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      Ve a: Tu cuenta → Configuración → Webhooks → Agregar URL
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

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

