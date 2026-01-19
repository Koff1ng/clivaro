'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'

interface PaySubscriptionButtonProps {
  subscriptionId: string
  planName?: string
  amount?: number
  onPaymentCreated?: (subscriptionId: string, initPoint: string) => void
  onSuccess?: () => void
  onError?: (error: string) => void
  disabled?: boolean
}

async function createSubscriptionPayment(subscriptionId: string) {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Error al crear pago')
  }
  return res.json()
}

export function PaySubscriptionButton({
  subscriptionId,
  planName,
  amount,
  onPaymentCreated,
  onSuccess,
  onError,
  disabled = false,
}: PaySubscriptionButtonProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const createPaymentMutation = useMutation({
    mutationFn: createSubscriptionPayment,
    onSuccess: (data) => {
      // Detectar si estamos usando credenciales de prueba
      const isTestMode = data.isTestMode || 
                        data.sandboxInitPoint || 
                        (data.initPoint && (data.initPoint.includes('sandbox') || data.initPoint.includes('test')))
      
      // CRÍTICO: Si estamos en modo prueba, DEBEMOS usar sandboxInitPoint
      // Si no hay sandboxInitPoint, NO usar initPoint de producción (causará error)
      let initPoint: string | null = null
      
      if (isTestMode) {
        // En modo prueba, priorizar sandboxInitPoint
        if (data.sandboxInitPoint) {
          initPoint = data.sandboxInitPoint
        } else if (data.initPoint && (data.initPoint.includes('sandbox') || data.initPoint.includes('test'))) {
          // Si el initPoint es explícitamente de sandbox, usarlo
          initPoint = data.initPoint
        } else {
          // Si estamos en modo prueba pero no hay sandboxInitPoint y el initPoint no es de sandbox,
          // no podemos proceder (causaría el error "Una de las partes... es de prueba")
          const errorMsg = 'Error: No se pudo obtener la URL de pago en modo prueba. Por favor, verifica la configuración de Mercado Pago.'
          console.error('Mercado Pago sandbox error:', {
            hasSandboxInitPoint: !!data.sandboxInitPoint,
            hasInitPoint: !!data.initPoint,
            initPoint: data.initPoint,
            isTestMode,
          })
          onError?.(errorMsg)
          toast(errorMsg, 'error')
          return
        }
      } else {
        // En modo producción, usar initPoint normal
        initPoint = data.initPoint || null
      }
      
      if (initPoint) {
        // Abrir el checkout de Mercado Pago en una nueva ventana
        window.open(initPoint, '_blank')
        onPaymentCreated?.(data.subscriptionId, initPoint)
        onSuccess?.()
        toast(
          isTestMode
            ? 'Redirigiendo a Mercado Pago (Modo Prueba)...' 
            : 'Redirigiendo a Mercado Pago...', 
          'success'
        )
      } else {
        const errorMsg = 'Error: No se pudo obtener la URL de pago'
        onError?.(errorMsg)
        toast(errorMsg, 'error')
      }
    },
    onError: (error: any) => {
      const errorMsg = error.message || 'Error al procesar el pago'
      onError?.(errorMsg)
      toast(errorMsg, 'error')
    },
    onSettled: () => {
      setIsProcessing(false)
    },
  })

  const handleClick = () => {
    setIsProcessing(true)
    createPaymentMutation.mutate(subscriptionId)
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isProcessing || createPaymentMutation.isPending}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      {isProcessing || createPaymentMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Procesando...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          Pagar Suscripción
          <ExternalLink className="h-4 w-4 ml-2" />
        </>
      )}
    </Button>
  )
}

