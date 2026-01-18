'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

interface MercadoPagoCardFormProps {
  subscriptionId: string
  amount: number
  currency?: string
  onPaymentSuccess?: () => void
  onPaymentError?: (error: string) => void
}

declare global {
  interface Window {
    MercadoPago: any
  }
}

export function MercadoPagoCardForm({
  subscriptionId,
  amount,
  currency = 'COP',
  onPaymentSuccess,
  onPaymentError,
}: MercadoPagoCardFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [mp, setMp] = useState<any>(null)
  const [cardForm, setCardForm] = useState<any>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Cargar SDK de Mercado Pago
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = async () => {
      try {
        // Obtener la public key
        const res = await fetch('/api/subscriptions/payment-method')
        if (!res.ok) throw new Error('Error al obtener configuración de pago')
        const data = await res.json()
        setPublicKey(data.publicKey)

        if (window.MercadoPago && data.publicKey) {
          const mpInstance = new window.MercadoPago(data.publicKey, {
            locale: 'es-CO',
          })
          setMp(mpInstance)
        }
      } catch (error: any) {
        console.error('Error loading Mercado Pago:', error)
        toast('Error al cargar la pasarela de pago', 'error')
        onPaymentError?.(error.message)
      } finally {
        setIsLoading(false)
      }
    }
    script.onerror = () => {
      setIsLoading(false)
      toast('Error al cargar el SDK de Mercado Pago', 'error')
      onPaymentError?.('Error al cargar el SDK de Mercado Pago')
    }
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  // Inicializar el formulario de tarjeta
  useEffect(() => {
    if (!mp || !publicKey || !formRef.current) return

    try {
      const cardFormInstance = mp.cardForm({
        amount: amount.toString(),
        iframe: true,
        form: {
          id: 'mp-card-form',
          cardholderName: {
            id: 'form-checkout__cardholderName',
            placeholder: 'Titular de la tarjeta',
          },
          cardholderEmail: {
            id: 'form-checkout__cardholderEmail',
            placeholder: 'E-mail',
          },
          cardNumber: {
            id: 'form-checkout__cardNumber',
            placeholder: 'Número de tarjeta',
          },
          expirationDate: {
            id: 'form-checkout__expirationDate',
            placeholder: 'MM/AA',
          },
          securityCode: {
            id: 'form-checkout__securityCode',
            placeholder: 'Código de seguridad',
          },
          installments: {
            id: 'form-checkout__installments',
            placeholder: 'Cuotas',
          },
          identificationType: {
            id: 'form-checkout__identificationType',
            placeholder: 'Tipo de documento',
          },
          identificationNumber: {
            id: 'form-checkout__identificationNumber',
            placeholder: 'Número de documento',
          },
          issuer: {
            id: 'form-checkout__issuer',
            placeholder: 'Banco emisor',
          },
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) {
              console.error('Error mounting card form:', error)
              toast('Error al inicializar el formulario de pago', 'error')
            }
          },
          onSubmit: async (event: any) => {
            event.preventDefault()
            setIsProcessing(true)

            try {
              const { token, error } = await mp.getCardFormData('mp-card-form')

              if (error) {
                throw new Error(error.message || 'Error al procesar los datos de la tarjeta')
              }

              // Procesar el pago
              const paymentRes = await fetch('/api/subscriptions/payment-method', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriptionId,
                  token: token,
                  paymentMethodId: token.payment_method_id,
                  installments: parseInt(token.installments || '1'),
                  issuerId: token.issuer_id,
                }),
              })

              const paymentData = await paymentRes.json()

              if (!paymentRes.ok) {
                throw new Error(paymentData.error || 'Error al procesar el pago')
              }

              if (paymentData.success) {
                toast('Pago procesado exitosamente', 'success')
                onPaymentSuccess?.()
              } else {
                throw new Error(paymentData.payment?.statusDetail || 'El pago fue rechazado')
              }
            } catch (error: any) {
              console.error('Error processing payment:', error)
              toast(error.message || 'Error al procesar el pago', 'error')
              onPaymentError?.(error.message)
            } finally {
              setIsProcessing(false)
            }
          },
          onFetching: (resource: string) => {
            // Mientras se obtienen los datos del recurso
            return () => {
              // Callback de limpieza
            }
          },
        },
      })

      setCardForm(cardFormInstance)
    } catch (error: any) {
      console.error('Error initializing card form:', error)
      toast('Error al inicializar el formulario de pago', 'error')
    }
  }, [mp, publicKey, amount, subscriptionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Cargando pasarela de pago...</span>
      </div>
    )
  }

  if (!publicKey || !mp) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Error al cargar la pasarela de pago</span>
        </div>
        <p className="text-sm text-red-800 dark:text-red-200 mt-2">
          No se pudo inicializar Mercado Pago. Por favor, contacta al soporte.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Monto a pagar</span>
          <span className="text-xl font-bold">{formatCurrency(amount)}</span>
        </div>
      </div>

      <form id="mp-card-form" ref={formRef} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="form-checkout__cardholderName" className="text-sm font-medium">
              Titular de la tarjeta
            </label>
            <input
              type="text"
              id="form-checkout__cardholderName"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="form-checkout__cardholderEmail" className="text-sm font-medium">
              E-mail
            </label>
            <input
              type="email"
              id="form-checkout__cardholderEmail"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="email@ejemplo.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="form-checkout__cardNumber" className="text-sm font-medium">
            Número de tarjeta
          </label>
          <div id="form-checkout__cardNumber" className="h-10 w-full rounded-md border border-input bg-background"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="form-checkout__expirationDate" className="text-sm font-medium">
              Fecha de vencimiento
            </label>
            <div id="form-checkout__expirationDate" className="h-10 w-full rounded-md border border-input bg-background"></div>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-checkout__securityCode" className="text-sm font-medium">
              Código de seguridad
            </label>
            <div id="form-checkout__securityCode" className="h-10 w-full rounded-md border border-input bg-background"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="form-checkout__installments" className="text-sm font-medium">
              Cuotas
            </label>
            <div id="form-checkout__installments" className="h-10 w-full rounded-md border border-input bg-background"></div>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-checkout__identificationType" className="text-sm font-medium">
              Tipo de documento
            </label>
            <div id="form-checkout__identificationType" className="h-10 w-full rounded-md border border-input bg-background"></div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="form-checkout__identificationNumber" className="text-sm font-medium">
            Número de documento
          </label>
          <input
            type="text"
            id="form-checkout__identificationNumber"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="1234567890"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="form-checkout__issuer" className="text-sm font-medium">
            Banco emisor
          </label>
          <div id="form-checkout__issuer" className="h-10 w-full rounded-md border border-input bg-background"></div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando pago...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar {formatCurrency(amount)}
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

