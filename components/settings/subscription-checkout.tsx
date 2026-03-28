'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, CreditCard, Smartphone, Building2, ArrowRight, Shield, Zap, Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  interval: string
  features: string
  description?: string
}

interface PaymentSession {
  publicKey: string
  reference: string
  amountInCents: number
  currency: string
  signature: string
  redirectUrl: string
  planName: string
  planPrice: number
}

// Plan tier config — visual styling
const PLAN_TIERS: Record<string, { icon: React.ReactNode; gradient: string; badge?: string; popular?: boolean }> = {
  STARTER: {
    icon: <Zap className="w-6 h-6" />,
    gradient: 'from-slate-600 to-slate-800',
  },
  BUSINESS: {
    icon: <Crown className="w-6 h-6" />,
    gradient: 'from-indigo-500 to-blue-600',
    badge: 'Más Popular',
    popular: true,
  },
  ENTERPRISE: {
    icon: <Sparkles className="w-6 h-6" />,
    gradient: 'from-violet-500 to-purple-700',
    badge: 'Premium',
  },
}

function getPlanTier(planName: string) {
  const key = planName.toUpperCase()
  return PLAN_TIERS[key] || PLAN_TIERS.STARTER
}

export function SubscriptionCheckout() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)

  // Fetch available plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['available-plans'],
    queryFn: async () => {
      const res = await fetch('/api/plans')
      if (!res.ok) return []
      const data = await res.json()
      return (data.plans || data || []).filter((p: Plan) => p.price > 0)
    },
    retry: false,
  })

  // Fetch current subscription
  const { data: currentPlan } = useQuery({
    queryKey: ['tenant-plan'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/plan')
      if (!res.ok) return null
      return res.json()
    },
    retry: false,
  })

  // Check for redirect from Wompi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wompiRef = params.get('wompiRef')
    const txId = params.get('id')

    if (wompiRef) {
      setVerifying(true)
      verifyPayment(wompiRef, txId)
    }
  }, [])

  const verifyPayment = async (reference: string, transactionId?: string | null) => {
    try {
      const url = `/api/subscriptions/wompi/verify?ref=${reference}${transactionId ? `&id=${transactionId}` : ''}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.status === 'APPROVED') {
        setPaymentComplete(true)
        toast('¡Pago aprobado! Tu suscripción está activa', 'success')
        queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
        // Clean URL
        window.history.replaceState({}, '', '/settings/billing')
      } else if (data.status === 'PENDING') {
        toast('Pago pendiente — verificaremos en unos momentos', 'info')
      } else {
        toast(`Pago ${data.status || 'no completado'}`, 'error')
      }
    } catch {
      toast('Error verificando el pago', 'error')
    } finally {
      setVerifying(false)
    }
  }

  // Create payment session
  const createSessionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch('/api/subscriptions/wompi/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear sesión de pago')
      }
      return res.json() as Promise<PaymentSession>
    },
    onSuccess: (session) => {
      setPaymentSession(session)
      // Load and open Wompi Widget
      openWompiWidget(session)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const openWompiWidget = useCallback((session: PaymentSession) => {
    // Dynamically load the Wompi Widget script
    const existingScript = document.querySelector('script[src*="checkout.wompi.co"]')
    if (existingScript) existingScript.remove()

    // Create a form container
    const formContainer = document.createElement('div')
    formContainer.id = 'wompi-checkout-container'
    formContainer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)'

    const form = document.createElement('form')
    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.setAttribute('data-render', 'button')
    script.setAttribute('data-public-key', session.publicKey)
    script.setAttribute('data-currency', session.currency)
    script.setAttribute('data-amount-in-cents', String(session.amountInCents))
    script.setAttribute('data-reference', session.reference)
    script.setAttribute('data-signature:integrity', session.signature)
    script.setAttribute('data-redirect-url', session.redirectUrl)

    form.appendChild(script)
    formContainer.appendChild(form)
    document.body.appendChild(formContainer)

    // Auto-click the button after load
    script.onload = () => {
      setTimeout(() => {
        const wompiButton = formContainer.querySelector('button')
        if (wompiButton) {
          wompiButton.click()
        }
      }, 500)
    }

    // Click outside to close
    formContainer.addEventListener('click', (e) => {
      if (e.target === formContainer) {
        formContainer.remove()
        setPaymentSession(null)
      }
    })
  }, [])

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    createSessionMutation.mutate(planId)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price)
  }

  const parseFeatures = (featuresJson: string): string[] => {
    try {
      return JSON.parse(featuresJson)
    } catch {
      return []
    }
  }

  // Verifying state
  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-lg font-bold text-slate-700">Verificando tu pago...</p>
        <p className="text-sm text-slate-400">Esto puede tomar unos segundos</p>
      </div>
    )
  }

  // Payment complete
  if (paymentComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-6"
      >
        <motion.div
          className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Check className="w-10 h-10 text-emerald-600" />
        </motion.div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">¡Pago Exitoso!</h2>
        <p className="text-slate-500">Tu suscripción ha sido activada correctamente</p>
        <Button onClick={() => window.location.reload()} className="rounded-full px-8">
          Continuar
        </Button>
      </motion.div>
    )
  }

  if (loadingPlans) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Elige tu Plan</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Selecciona el plan que mejor se adapte a tu negocio. Todos incluyen soporte técnico.
        </p>
      </div>

      {/* Current Plan Badge */}
      {currentPlan?.plan && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-bold text-emerald-700">
            <Check className="w-4 h-4" />
            Plan actual: {currentPlan.plan.name}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {(plans as Plan[]).map((plan, i) => {
          const tier = getPlanTier(plan.name)
          const features = parseFeatures(plan.features || '[]')
          const isCurrentPlan = currentPlan?.plan?.id === plan.id
          const isSelected = selectedPlan === plan.id
          const isLoading = createSessionMutation.isPending && isSelected

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-3xl overflow-hidden border-2 transition-all duration-300 ${
                tier.popular
                  ? 'border-indigo-400 shadow-xl shadow-indigo-100 scale-[1.02]'
                  : isSelected
                    ? 'border-slate-400 shadow-lg'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* Popular Badge */}
              {tier.badge && (
                <div className={`absolute top-0 right-0 bg-gradient-to-r ${tier.gradient} text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl`}>
                  {tier.badge}
                </div>
              )}

              <div className="p-6 space-y-6">
                {/* Plan Header */}
                <div className="space-y-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tier.gradient} text-white flex items-center justify-center`}>
                    {tier.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-[12px] text-slate-400 mt-1">{plan.description}</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{formatPrice(plan.price)}</span>
                    <span className="text-sm text-slate-400 font-medium">
                      /{plan.interval === 'annual' ? 'año' : 'mes'}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5">
                  {features.map((feature, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-[13px] text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => !isCurrentPlan && handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || isLoading}
                  className={`w-full rounded-2xl h-12 font-black text-xs uppercase tracking-widest transition-all ${
                    isCurrentPlan
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                      : tier.popular
                        ? `bg-gradient-to-r ${tier.gradient} text-white hover:opacity-90`
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    'Plan Actual'
                  ) : (
                    <>Suscribirse <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Payment Methods */}
      <div className="flex items-center justify-center gap-6 py-4">
        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-medium">
          <Shield className="w-4 h-4" />
          Pago seguro con Wompi
        </div>
        <div className="flex items-center gap-3 text-slate-300">
          <CreditCard className="w-5 h-5" title="Tarjeta de crédito/débito" />
          <Smartphone className="w-5 h-5" title="Nequi" />
          <Building2 className="w-5 h-5" title="PSE / Transferencia" />
        </div>
      </div>
    </div>
  )
}
