'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'

interface PaySubscriptionButtonProps {
  subscriptionId: string
  planName: string
  amount: number
  onPaymentCreated?: (subscriptionId: string, initPoint: string) => void
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
  disabled = false,
}: PaySubscriptionButtonProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const createPaymentMutation = useMutation({
    mutationFn: createSubscriptionPayment,
    onSuccess: (data) => {
      // Priorizar sandbox_init_point si está disponible (credenciales de prueba)
      // Esto evita el error "Una de las partes con la que intentas hacer el pago es de prueba"
      const initPoint = data.sandboxInitPoint || data.initPoint
      
      if (initPoint) {
        // Abrir el checkout de Mercado Pago en una nueva ventana
        window.open(initPoint, '_blank')
        onPaymentCreated?.(data.subscriptionId, initPoint)
        toast(
          data.sandboxInitPoint 
            ? 'Redirigiendo a Mercado Pago (Modo Prueba)...' 
            : 'Redirigiendo a Mercado Pago...', 
          'success'
        )
      } else {
        toast('Error: No se pudo obtener la URL de pago', 'error')
      }
    },
    onError: (error: any) => {
      toast(error.message || 'Error al procesar el pago', 'error')
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

