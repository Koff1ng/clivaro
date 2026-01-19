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
      // Los tokens de prueba de Mercado Pago generalmente contienen "test" o son de tipo APP_USR
      const isTestMode = data.sandboxInitPoint || 
                        (data.initPoint && (data.initPoint.includes('sandbox') || data.initPoint.includes('test')))
      
      // Priorizar sandbox_init_point si está disponible (credenciales de prueba)
      // Si no hay sandboxInitPoint pero el initPoint es de sandbox, usarlo
      // Esto evita el error "Una de las partes con la que intentas hacer el pago es de prueba"
      let initPoint = data.sandboxInitPoint || data.initPoint
      
      // Si estamos en modo prueba pero no hay sandboxInitPoint, verificar si el initPoint es de sandbox
      if (!data.sandboxInitPoint && data.initPoint && isTestMode) {
        initPoint = data.initPoint
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

