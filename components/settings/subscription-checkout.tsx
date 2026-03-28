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
    icon: <Zap className="w-4 h-4" />,
    gradient: 'from-slate-600 to-slate-800',
  },
  BUSINESS: {
    icon: <Crown className="w-4 h-4" />,
    gradient: 'from-indigo-500 to-blue-600',
    badge: 'Más Popular',
    popular: true,
  },
  ENTERPRISE: {
    icon: <Sparkles className="w-4 h-4" />,
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
  const [activatedPlan, setActivatedPlan] = useState<string | null>(null)
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
      
      // Poll up to 3 times with delay (Wompi might not be instant)
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url)
        const data = await res.json()

        if (data.status === 'APPROVED') {
          setActivatedPlan(data.subscription?.planName || 'Tu nuevo plan')
          setPaymentComplete(true)
          queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
          window.history.replaceState({}, '', '/settings?tab=subscription')
          return
        } else if (data.status === 'DECLINED' || data.status === 'VOIDED' || data.status === 'ERROR') {
          toast('El pago no fue aprobado. Intenta nuevamente.', 'error')
          window.history.replaceState({}, '', '/settings?tab=subscription')
          setVerifying(false)
          return
        }

        // Wait 2s before next attempt
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      // After 3 attempts still pending
      toast('Tu pago está siendo procesado. Te notificaremos cuando se complete.', 'info')
      window.history.replaceState({}, '', '/settings?tab=subscription')
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
      openWompiWidget(session)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const openWompiWidget = useCallback((session: PaymentSession) => {
    const existingScript = document.querySelector('script[src*="checkout.wompi.co"]')
    if (existingScript) existingScript.remove()

    // Remove any existing container
    const existingContainer = document.getElementById('wompi-checkout-container')
    if (existingContainer) existingContainer.remove()

    // Create branded full-screen overlay that hides the entire app
    const formContainer = document.createElement('div')
    formContainer.id = 'wompi-checkout-container'
    formContainer.innerHTML = `
      <style>
        #wompi-checkout-container {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
          display: flex; align-items: center; justify-content: center; flex-direction: column;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%);
          font-family: system-ui, -apple-system, sans-serif;
        }
        #wompi-checkout-container::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
          background-size: 32px 32px;
        }
        .wompi-brand-header {
          position: absolute; top: 32px; left: 40px;
          display: flex; align-items: center; gap: 10px;
          color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 700;
          letter-spacing: 0.05em;
        }
        .wompi-brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; }
        .wompi-status-text {
          text-align: center; color: rgba(255,255,255,0.5); font-size: 13px;
          margin-top: 24px; z-index: 1;
        }
        .wompi-status-text strong { color: rgba(255,255,255,0.8); }
        .wompi-pulse-ring {
          width: 80px; height: 80px; border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.3);
          display: flex; align-items: center; justify-content: center;
          animation: wompiPulse 2s ease-in-out infinite; z-index: 1;
        }
        .wompi-inner-ring {
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.3);
        }
        .wompi-inner-ring svg { width: 24px; height: 24px; color: white; }
        @keyframes wompiPulse {
          0%, 100% { transform: scale(1); border-color: rgba(99, 102, 241, 0.3); }
          50% { transform: scale(1.1); border-color: rgba(99, 102, 241, 0.6); }
        }
        .wompi-close-btn {
          position: absolute; top: 28px; right: 32px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6); border-radius: 12px; padding: 8px 20px;
          font-size: 12px; cursor: pointer; font-weight: 600;
          transition: all 0.2s;
        }
        .wompi-close-btn:hover { background: rgba(255,255,255,0.15); color: white; }
        .wompi-form-wrap { z-index: 2; margin-top: 20px; }
        .wompi-amount {
          color: white; font-size: 28px; font-weight: 900; margin-top: 16px;
          letter-spacing: -0.02em; z-index: 1;
        }
        .wompi-plan-name {
          color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.15em; font-weight: 700; margin-top: 6px; z-index: 1;
        }
        .wompi-secure {
          position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
          color: rgba(255,255,255,0.25); font-size: 11px;
          display: flex; align-items: center; gap: 6px;
        }
      </style>
      <div class="wompi-brand-header">
        <div class="wompi-brand-dot"></div>
        Clivaro
      </div>
      <button class="wompi-close-btn" id="wompi-close-btn">✕ Cancelar</button>
      <div class="wompi-pulse-ring">
        <div class="wompi-inner-ring">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
          </svg>
        </div>
      </div>
      <div class="wompi-amount">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(session.amountInCents / 100)}</div>
      <div class="wompi-plan-name">${session.planName}</div>
      <div class="wompi-status-text"><strong>Procesando pago seguro</strong><br>serás redirigido al checkout de Wompi</div>
      <div class="wompi-form-wrap" id="wompi-form-wrap"></div>
      <div class="wompi-secure">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        Pago cifrado y seguro con Wompi
      </div>
    `

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
    
    document.body.appendChild(formContainer)
    const formWrap = document.getElementById('wompi-form-wrap')
    if (formWrap) formWrap.appendChild(form)

    // Close button
    document.getElementById('wompi-close-btn')?.addEventListener('click', () => {
      formContainer.remove()
      setPaymentSession(null)
    })

    script.onload = () => {
      setTimeout(() => {
        const wompiButton = formContainer.querySelector('button:not(#wompi-close-btn)')
        if (wompiButton) (wompiButton as HTMLButtonElement).click()
      }, 500)
    }
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

  // ── Verifying state ──
  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
          <CreditCard className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-slate-800">Verificando tu pago...</p>
          <p className="text-xs text-slate-400 mt-1">Consultando el estado de la transacción</p>
        </div>
      </div>
    )
  }

  // ── Payment complete — Premium welcome ──
  if (paymentComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-5 relative overflow-hidden"
      >
        {/* Celebration particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][i % 6],
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              y: [0, -30],
            }}
            transition={{ delay: 0.3 + i * 0.1, duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          />
        ))}

        {/* Animated checkmark */}
        <motion.div
          className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">¡Bienvenido a {activatedPlan}!</h2>
          <p className="text-sm text-slate-500">Tu suscripción ha sido activada exitosamente</p>
        </motion.div>

        {/* Plan badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl"
        >
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-indigo-700">{activatedPlan}</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">ACTIVO</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-3 mt-2"
        >
          <Button
            onClick={() => { setPaymentComplete(false); queryClient.invalidateQueries({ queryKey: ['tenant-plan'] }) }}
            variant="outline"
            className="rounded-xl text-xs"
          >
            Ver mi plan
          </Button>
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700"
          >
            Ir al Dashboard
          </Button>
        </motion.div>
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
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Elige tu Plan</h2>
        <p className="text-slate-500 text-xs max-w-md mx-auto">
          Selecciona el plan ideal para tu negocio. Todos incluyen soporte técnico.
        </p>
      </div>

      {/* Current Plan Badge */}
      {currentPlan?.plan && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
            <Check className="w-4 h-4" />
            Plan actual: {currentPlan.plan.name}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
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
                <div className={`absolute top-0 right-0 bg-gradient-to-r ${tier.gradient} text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl`}>
                  {tier.badge}
                </div>
              )}

              <div className="p-4 space-y-4">
                {/* Plan Header */}
                <div className="space-y-2">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tier.gradient} text-white flex items-center justify-center`}>
                    {tier.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{plan.description}</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{formatPrice(plan.price)}</span>
                    <span className="text-sm text-slate-400 font-medium">
                      /{plan.interval === 'annual' ? 'año' : 'mes'}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-1.5">
                  {features.map((feature, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => !isCurrentPlan && handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || isLoading}
                  className={`w-full rounded-xl h-10 font-bold text-[11px] uppercase tracking-wider transition-all ${
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
          <CreditCard className="w-5 h-5" />
          <Smartphone className="w-5 h-5" />
          <Building2 className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
