'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, AlertCircle, Phone, User } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const formRef = useRef<HTMLFormElement>(null)
  const cardFormRef = useRef<any>(null)
  const isMountedRef = useRef(false)
  
  // Estados para los campos del formulario
  const [cardholderName, setCardholderName] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+57') // Colombia por defecto
  const [email, setEmail] = useState('')
  const [identificationType, setIdentificationType] = useState('CC') // CC por defecto para Colombia
  const [identificationNumber, setIdentificationNumber] = useState('')

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
    
    // Evitar múltiples montajes
    if (isMountedRef.current || cardFormRef.current) {
      return
    }

    try {
      const cardFormInstance = mp.cardForm({
        amount: amount.toString(),
        iframe: true,
        form: {
          id: 'mp-card-form',
          // Configuración de campos - Mercado Pago requiere que estos IDs existan en el DOM
          cardholderName: {
            id: 'form-checkout__cardholderName',
            placeholder: 'Nombre tal como aparece en la tarjeta',
          },
          cardholderEmail: {
            id: 'form-checkout__cardholderEmail',
            placeholder: 'email@ejemplo.com',
          },
          cardNumber: {
            id: 'form-checkout__cardNumber',
            placeholder: '1234 1234 1234 1234',
          },
          expirationDate: {
            id: 'form-checkout__expirationDate',
            placeholder: 'MM/YY',
          },
          securityCode: {
            id: 'form-checkout__securityCode',
            placeholder: 'CVC',
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
              const errorMsg = Array.isArray(error) && error[0]?.message 
                ? error[0].message 
                : 'Error al inicializar el formulario de pago'
              toast(errorMsg, 'error')
              isMountedRef.current = false
              cardFormRef.current = null
            } else {
              console.log('Card form mounted successfully')
              isMountedRef.current = true
            }
          },
          onValidityChange: (error: any, field: string) => {
            // Callback para validación en tiempo real
            if (error) {
              console.warn(`Validation error in field ${field}:`, error)
            }
          },
          onSubmit: async (event: any) => {
            event.preventDefault()
            
            // Prevenir múltiples envíos
            if (isProcessing) {
              console.warn('Payment already processing, ignoring duplicate submit')
              return
            }
            
            // Validar campos requeridos ANTES de procesar
            const domCardholderInput = document.getElementById('form-checkout__cardholderName') as HTMLInputElement | null
            const finalCardholderName = (domCardholderInput?.value || cardholderName || '').trim()

            if (!finalCardholderName) {
              toast('Por favor, ingresa el nombre del titular de la tarjeta', 'error')
              return
            }
            if (finalCardholderName.length < 3) {
              toast('El nombre del titular debe tener al menos 3 caracteres', 'error')
              return
            }
            if (finalCardholderName.length > 50) {
              toast('El nombre del titular no puede exceder 50 caracteres', 'error')
              return
            }
            if (!email.trim() || !email.includes('@')) {
              toast('Por favor, ingresa un email válido', 'error')
              return
            }
              if (!phone.trim()) {
                toast('Por favor, ingresa un número de teléfono', 'error')
                return
              }

            // Validar campos de identificación (obligatorios para Colombia)
            const identificationTypeValue = (document.getElementById('form-checkout__identificationType') as HTMLSelectElement)?.value || identificationType
            const identificationNumberValue = (document.getElementById('form-checkout__identificationNumber') as HTMLInputElement)?.value || identificationNumber

            if (!identificationTypeValue || identificationTypeValue === '') {
              toast('Por favor, selecciona el tipo de documento', 'error')
              return
            }

            if (!identificationNumberValue || identificationNumberValue.trim() === '') {
              toast('Por favor, ingresa el número de documento', 'error')
              return
            }

            // Validar formato del número de documento según el tipo
            if (identificationTypeValue === 'CC' || identificationTypeValue === 'CE') {
              // Cédula debe tener entre 7 y 10 dígitos
              const docNumber = identificationNumberValue.trim().replace(/\D/g, '')
              if (docNumber.length < 7 || docNumber.length > 10) {
                toast('El número de documento debe tener entre 7 y 10 dígitos', 'error')
                return
              }
            } else if (identificationTypeValue === 'NIT') {
              // NIT debe tener entre 9 y 11 dígitos
              const docNumber = identificationNumberValue.trim().replace(/\D/g, '')
              if (docNumber.length < 9 || docNumber.length > 11) {
                toast('El NIT debe tener entre 9 y 11 dígitos', 'error')
                return
              }
            }

            setIsProcessing(true)

            try {
              if (!cardFormRef.current) {
                throw new Error('El formulario de pago no está inicializado')
              }

              // Obtener los valores del formulario (ya validados arriba)
              const identificationTypeValue = (document.getElementById('form-checkout__identificationType') as HTMLSelectElement)?.value || identificationType
              const identificationNumberValue = (document.getElementById('form-checkout__identificationNumber') as HTMLInputElement)?.value || identificationNumber
              const installments = (document.getElementById('form-checkout__installments') as HTMLSelectElement)?.value || '1'

              // El CardForm de Mercado Pago genera el token automáticamente
              // Usamos getFormData() que es el método estándar
              let formData: any = null
              
              try {
                // Intentar usar getFormData() primero (método estándar)
                if (typeof cardFormRef.current.getFormData === 'function') {
                  formData = cardFormRef.current.getFormData()
                } 
                // Si no existe, intentar getCardFormData()
                else if (typeof cardFormRef.current.getCardFormData === 'function') {
                  const data = cardFormRef.current.getCardFormData()
                  // Puede ser una Promise
                  if (data && typeof data.then === 'function') {
                    formData = await data
                  } else {
                    formData = data
                  }
                } 
                // Si ninguno existe, el CardForm puede tener los datos directamente
                else if (cardFormRef.current.token) {
                  formData = {
                    token: cardFormRef.current.token,
                    paymentMethodId: cardFormRef.current.paymentMethodId,
                    issuerId: cardFormRef.current.issuerId,
                  }
                } else {
                  throw new Error('No se pudo obtener los datos del formulario. El CardForm puede no estar completamente inicializado.')
                }
                
                console.log('Form data retrieved:', {
                  hasToken: !!formData?.token,
                  hasPaymentMethodId: !!formData?.paymentMethodId,
                  formDataKeys: formData ? Object.keys(formData) : [],
                })
              } catch (getDataError: any) {
                console.error('Error getting card form data:', getDataError)
                throw new Error('Error al obtener los datos de la tarjeta. Verifica que todos los campos estén completos y válidos.')
              }

              // Extraer el token
              let token = formData?.token || formData?.id || formData?.cardTokenId
              let paymentMethodId = formData?.paymentMethodId || formData?.payment_method_id
              let issuerId = formData?.issuerId || formData?.issuer_id

              if (!token) {
                console.error('No token in form data:', formData)
                throw new Error('No se pudo generar el token de la tarjeta. Por favor, verifica que todos los campos de la tarjeta estén completos y correctos.')
              }

              // Procesar el pago
              const paymentRes = await fetch('/api/subscriptions/payment-method', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriptionId,
                  token: token,
                  paymentMethodId: paymentMethodId,
                  installments: parseInt(installments),
                  issuerId: issuerId,
                  identificationType: identificationTypeValue,
                  identificationNumber: identificationNumberValue.trim(),
                }),
              })

              const paymentData = await paymentRes.json()

              if (!paymentRes.ok) {
                // Extraer mensaje de error más descriptivo
                let errorMessage = paymentData.error || 'Error al procesar el pago'
                
                // Si hay un statusDetail, agregarlo al mensaje si el error no lo incluye ya
                if (paymentData.statusDetail && !errorMessage.includes(paymentData.statusDetail)) {
                  errorMessage = `${errorMessage} (${paymentData.statusDetail})`
                }
                
                throw new Error(errorMessage)
              }

              if (paymentData.success) {
                toast('¡Pago procesado exitosamente!', 'success')
                onPaymentSuccess?.()
              } else {
                const rejectionMessage = paymentData.payment?.statusDetail 
                  ? `El pago fue rechazado: ${paymentData.payment.statusDetail}`
                  : paymentData.error || 'El pago fue rechazado'
                throw new Error(rejectionMessage)
              }
            } catch (error: any) {
              console.error('Error processing payment:', error)
              const errorMessage = error?.message || 'Error al procesar el pago'
              toast(errorMessage, 'error')
              onPaymentError?.(errorMessage)
            } finally {
              setIsProcessing(false)
            }
          },
          onError: (error: any) => {
            // Manejar errores de validación del formulario
            console.error('CardForm validation error:', error)
            
            // Extraer mensaje de error más descriptivo
            let errorMessage = 'Error al validar los datos de la tarjeta'
            let errorCode = null
            
            if (Array.isArray(error) && error.length > 0) {
              const firstError = error[0]
              errorCode = firstError?.code || firstError?.error?.code
              
              if (typeof firstError === 'string') {
                errorMessage = firstError
              } else if (firstError?.message) {
                errorMessage = firstError.message
              } else if (firstError?.error?.message) {
                errorMessage = firstError.error.message
              } else if (firstError?.description) {
                errorMessage = firstError.description
              }
            } else if (error?.message) {
              errorMessage = error.message
              errorCode = error.code
            } else if (typeof error === 'string') {
              errorMessage = error
            }
            
            // Mensajes más específicos según el código de error
            if (errorCode) {
              switch (errorCode) {
                case 'E301':
                  errorMessage = 'El número de tarjeta es inválido'
                  break
                case 'E302':
                  errorMessage = 'La fecha de vencimiento es inválida'
                  break
                case 'E303':
                  errorMessage = 'El código de seguridad (CVV) es inválido'
                  break
                case 'E205':
                  errorMessage = 'El nombre del titular es requerido'
                  break
                default:
                  // Mantener el mensaje original si no hay un código conocido
                  break
              }
            }
            
            console.error('CardForm error details:', {
              error,
              errorCode,
              errorMessage,
            })
            
            toast(errorMessage, 'error')
            setIsProcessing(false)
            onPaymentError?.(errorMessage)
          },
          onFetching: (resource: string) => {
            // Mientras se obtienen los datos del recurso
            return () => {
              // Callback de limpieza
            }
          },
        },
      })

      cardFormRef.current = cardFormInstance
    } catch (error: any) {
      console.error('Error initializing card form:', error)
      toast('Error al inicializar el formulario de pago', 'error')
      isMountedRef.current = false
      cardFormRef.current = null
    }

    return () => {
      if (cardFormRef.current && isMountedRef.current) {
        try {
          // Verificar que el método unmount existe y el formulario está montado
          if (cardFormRef.current && typeof cardFormRef.current.unmount === 'function') {
            cardFormRef.current.unmount()
          }
        } catch (error) {
          // Ignorar errores si el formulario no está montado o ya fue desmontado
          console.warn('Error unmounting card form:', error)
        }
        cardFormRef.current = null
        isMountedRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp, publicKey, amount, subscriptionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <form id="mp-card-form" ref={formRef} className="space-y-5">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="form-checkout__cardholderName" className="text-sm font-medium">
              Nombre del titular (tal como aparece en la tarjeta):
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                id="form-checkout__cardholderName"
                value={cardholderName}
                onChange={(e) => {
                  // Permitir cualquier carácter que pueda aparecer en una tarjeta (letras, espacios, guiones, puntos, etc.)
                  const value = e.target.value
                  setCardholderName(value)
                }}
                className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ej: JUAN PEREZ, MARIA GONZALEZ, etc."
                required
                minLength={3}
                maxLength={50}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresa el nombre exactamente como aparece impreso en tu tarjeta (puede incluir mayúsculas, espacios y guiones)
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone:
            </Label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="flex h-11 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="+57">🇨🇴 +57</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+55">🇧🇷 +55</option>
                <option value="+56">🇨🇱 +56</option>
                <option value="+51">🇵🇪 +51</option>
              </select>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="+8917895190"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="form-checkout__cardholderEmail" className="text-sm font-medium">
              Email:
            </Label>
            <input
              type="email"
              id="form-checkout__cardholderEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="email@ejemplo.com"
              required
            />
          </div>

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="form-checkout__cardNumber" className="text-sm font-medium">
              Card number
            </Label>
            <div 
              id="form-checkout__cardNumber" 
              className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 flex items-center"
            ></div>
            {/* Los iconos de tarjetas se mostrarán automáticamente por Mercado Pago */}
          </div>

          {/* Expiration Date and Security Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="form-checkout__expirationDate" className="text-sm font-medium">
                Expiration date
              </Label>
              <div 
                id="form-checkout__expirationDate" 
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2"
              ></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-checkout__securityCode" className="text-sm font-medium">
                Security code
              </Label>
              <div 
                id="form-checkout__securityCode" 
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2"
              ></div>
            </div>
          </div>

          {/* Installments (Oculto por defecto, se mostrará si es necesario) */}
          <div className="space-y-2 hidden">
            <Label htmlFor="form-checkout__installments" className="text-sm font-medium">
              Cuotas
            </Label>
            <select
              id="form-checkout__installments"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="1">1 cuota</option>
            </select>
          </div>

          {/* Identification Type and Number (OBLIGATORIOS para Colombia) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="form-checkout__identificationType" className="text-sm font-medium">
                Tipo de documento <span className="text-red-500">*</span>
              </Label>
              <select
                id="form-checkout__identificationType"
                value={identificationType}
                onChange={(e) => setIdentificationType(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">Selecciona tipo</option>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="NIT">NIT</option>
                <option value="PP">Pasaporte</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Requerido para pagos en Colombia
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-checkout__identificationNumber" className="text-sm font-medium">
                Número de documento <span className="text-red-500">*</span>
              </Label>
              <input
                type="text"
                id="form-checkout__identificationNumber"
                value={identificationNumber}
                onChange={(e) => {
                  // Solo permitir números
                  const value = e.target.value.replace(/\D/g, '')
                  setIdentificationNumber(value)
                }}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="1234567890"
                required
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Sin puntos ni guiones
              </p>
            </div>
          </div>

          {/* Issuer (Oculto por defecto) */}
          <div className="space-y-2 hidden">
            <Label htmlFor="form-checkout__issuer" className="text-sm font-medium">
              Banco emisor
            </Label>
            <select
              id="form-checkout__issuer"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona banco</option>
            </select>
          </div>

          {/* Pay Button */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                Pay {formatCurrency(amount)}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
