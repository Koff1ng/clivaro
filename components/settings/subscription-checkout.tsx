'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, CreditCard, ArrowRight, Shield, Zap, Crown, Sparkles, AlertTriangle, Calendar, RefreshCw, ArrowDown } from 'lucide-react'
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
const PLAN_TIERS: Record<string, { icon: React.ReactNode; gradient: string; badge?: string; popular?: boolean; order: number }> = {
  STARTER: {
    icon: <Zap className="w-4 h-4" />,
    gradient: 'from-slate-600 to-slate-800',
    order: 1,
  },
  BUSINESS: {
    icon: <Crown className="w-4 h-4" />,
    gradient: 'from-indigo-500 to-blue-600',
    badge: 'Más Popular',
    popular: true,
    order: 2,
  },
  ENTERPRISE: {
    icon: <Sparkles className="w-4 h-4" />,
    gradient: 'from-violet-500 to-purple-700',
    badge: 'Premium',
    order: 3,
  },
}

function getPlanTier(planName: string) {
  const key = planName.toUpperCase()
  return PLAN_TIERS[key] || { ...PLAN_TIERS.STARTER, order: 0 }
}

function getPlanOrder(planName: string): number {
  return getPlanTier(planName).order
}

export function SubscriptionCheckout() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [activatedPlan, setActivatedPlan] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null)

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

  // Derive billing visibility from data — no useEffect needed
  // showPlans is only for user-triggered "Change Plan" action
  const hasBillingData = !!currentPlan?.plan
  const shouldShowBilling = hasBillingData && !showPlans
  const shouldShowPlans = showPlans || !hasBillingData

  // Check for redirect from Wompi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wompiRef = params.get('wompiRef')
    const txId = params.get('id')
    const urlPlanId = params.get('planId')

    if (wompiRef) {
      setVerifying(true)
      verifyPayment(wompiRef, txId, urlPlanId)
    }
  }, [])

  const verifyPayment = async (reference: string, transactionId?: string | null, planId?: string | null) => {
    try {
      let url = `/api/subscriptions/wompi/verify?ref=${reference}${transactionId ? `&id=${transactionId}` : ''}`
      if (planId) url += `&planId=${planId}`
      
      // Poll up to 5 times with 3s delay
      for (let attempt = 0; attempt < 5; attempt++) {
        console.log(`[Wompi] Verify attempt ${attempt + 1}/5`)
        const res = await fetch(url)
        const data = await res.json()
        const status = (data.status || '').toUpperCase()

        console.log('[Wompi] Verify response:', data)

        if (status === 'APPROVED') {
          setActivatedPlan(data.subscription?.planName || 'Tu nuevo plan')
          setPaymentComplete(true)
          queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
          window.history.replaceState({}, '', '/settings?tab=subscription')
          return
        } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
          toast('El pago no fue aprobado. Tu plan actual se mantiene sin cambios.', 'error')
          window.history.replaceState({}, '', '/settings?tab=subscription')
          setVerifying(false)
          return
        } else if (status === 'CONFIGURATION_ERROR') {
          toast('Error de configuración del servidor. Contacta soporte.', 'error')
          window.history.replaceState({}, '', '/settings?tab=subscription')
          setVerifying(false)
          return
        }

        if (attempt < 2) await new Promise(r => setTimeout(r, 2000))
      }

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

  // Aggressively clean all Wompi state to prevent stale acceptance tokens
  const cleanupWompiWidget = useCallback(() => {
    // Remove ALL Wompi scripts
    document.querySelectorAll('script[src*="checkout.wompi.co"]').forEach(el => el.remove())
    document.querySelectorAll('script[src*="wompi"]').forEach(el => el.remove())
    // Remove ALL Wompi iframes (the checkout modal)
    document.querySelectorAll('iframe[src*="wompi"]').forEach(el => el.remove())
    document.querySelectorAll('iframe[name*="wompi"]').forEach(el => el.remove())
    // Remove our container
    document.getElementById('wompi-checkout-container')?.remove()
    // Remove any Wompi overlay/backdrop
    document.querySelectorAll('[class*="wompi"]').forEach(el => {
      if (el.id !== 'wompi-checkout-container') el.remove()
    })
    // Clean Wompi global state
    if ((window as any).WidgetCheckout) delete (window as any).WidgetCheckout
    if ((window as any).$wompiWidget) delete (window as any).$wompiWidget
  }, [])

  const openWompiWidget = useCallback((session: PaymentSession) => {
    // Full cleanup first
    cleanupWompiWidget()

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
    script.src = `https://checkout.wompi.co/widget.js?t=${Date.now()}`
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

    document.getElementById('wompi-close-btn')?.addEventListener('click', () => {
      cleanupWompiWidget()
      setPaymentSession(null)
    })

    script.onload = () => {
      setTimeout(() => {
        const wompiButton = formContainer.querySelector('button:not(#wompi-close-btn)')
        if (wompiButton) (wompiButton as HTMLButtonElement).click()
      }, 500)
    }
  }, [cleanupWompiWidget])

  const handleSelectPlan = (plan: Plan) => {
    const currentPlanName = currentPlan?.plan?.name || ''
    const currentOrder = getPlanOrder(currentPlanName)
    const targetOrder = getPlanOrder(plan.name)

    // Downgrade — show confirmation dialog
    if (currentOrder > 0 && targetOrder < currentOrder) {
      setDowngradeTarget(plan)
      return
    }

    // Upgrade or same tier — proceed directly
    proceedToPayment(plan.id)
  }

  const proceedToPayment = (planId: string) => {
    setSelectedPlan(planId)
    setDowngradeTarget(null)
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

  const getLosingFeatures = (currentFeatures: string[], targetFeatures: string[]): string[] => {
    return currentFeatures.filter(f => !targetFeatures.includes(f))
  }

  // ── Verifying ──
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

  // ── Payment complete ──
  if (paymentComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-5 relative overflow-hidden"
      >
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
            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [0, -30] }}
            transition={{ delay: 0.3 + i * 0.1, duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          />
        ))}
        <motion.div
          className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">¡Bienvenido a {activatedPlan}!</h2>
          <p className="text-sm text-slate-500">Tu suscripción ha sido activada exitosamente</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl"
        >
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-indigo-700">{activatedPlan}</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">ACTIVO</span>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex gap-3 mt-2">
          <Button onClick={() => { setPaymentComplete(false); setShowPlans(false); queryClient.invalidateQueries({ queryKey: ['tenant-plan'] }) }} variant="outline" className="rounded-xl text-xs">
            Ver mi plan
          </Button>
          <Button onClick={() => window.location.href = '/dashboard'} className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700">
            Ir al Dashboard
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  if (loadingPlans) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const subscription = currentPlan?.subscription
  const plan = currentPlan?.plan
  const currentFeatures = plan ? parseFeatures(plan.features || '[]') : []

  return (
    <div className="space-y-6">
      {/* ── Current Plan Section ── */}
      {shouldShowBilling && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Tu Plan Actual</h2>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
              subscription?.status === 'active' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
              : subscription?.status === 'pending_payment' ? 'text-amber-600 bg-amber-50 border-amber-200'
              : subscription?.status === 'trial' ? 'text-blue-600 bg-blue-50 border-blue-200'
              : 'text-slate-600 bg-slate-50 border-slate-200'
            }`}>{subscription?.status === 'active' ? 'Activo' : subscription?.status === 'pending_payment' ? 'Pendiente' : subscription?.status === 'trial' ? 'Prueba' : subscription?.status || 'Activo'}</span>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 space-y-4">
            {/* Plan info row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getPlanTier(plan.name).gradient} text-white flex items-center justify-center`}>
                  {getPlanTier(plan.name).icon}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{plan.name}</h3>
                  {plan.description && <p className="text-[11px] text-slate-400">{plan.description}</p>}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-slate-900">{formatPrice(plan.price)}</span>
                <span className="text-xs text-slate-400 ml-1">/{plan.interval === 'annual' ? 'año' : 'mes'}</span>
              </div>
            </div>

            {/* Subscription details */}
            <div className="grid grid-cols-2 gap-3">
              {subscription.startDate && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Inicio</p>
                    <p className="text-xs font-bold text-slate-700">{new Date(subscription.startDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
              {subscription.endDate && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Renovación</p>
                    <p className="text-xs font-bold text-slate-700">{new Date(subscription.endDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Features */}
            {currentFeatures.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Incluido en tu plan</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Billing Details Section ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              Detalles de Facturación
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Next Renewal Card */}
              {subscription.endDate && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-400 uppercase font-bold">Próxima Renovación</p>
                      <p className="text-sm font-black text-indigo-900">
                        {new Date(subscription.endDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {(() => {
                    const daysLeft = Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return daysLeft > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.max(5, Math.min(100, ((30 - daysLeft) / 30) * 100))}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600">{daysLeft} días restantes</span>
                      </div>
                    ) : null
                  })()}
                </div>
              )}

              {/* Monthly Cost Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xs font-black">$</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-400 uppercase font-bold">Costo {plan.interval === 'annual' ? 'Anual' : 'Mensual'}</p>
                    <p className="text-sm font-black text-emerald-900">{formatPrice(plan.price)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-500 pl-10">Auto-renovación activa</p>
              </div>
            </div>

            {/* Last Payment Details */}
            {currentPlan?.billing && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Último Pago Realizado</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{formatPrice(currentPlan.billing.amount)}</p>
                        <p className="text-[10px] text-slate-400">
                          {currentPlan.billing.paidAt
                            ? new Date(currentPlan.billing.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : 'Fecha no disponible'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                      {currentPlan.billing.status || 'Aprobado'}
                    </span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    {currentPlan.billing.paymentMethod && (
                      <div>
                        <p className="text-slate-400 uppercase font-bold">Método</p>
                        <p className="text-slate-700 font-bold mt-0.5">
                          {currentPlan.billing.paymentMethod === 'CARD' ? '💳 Tarjeta'
                            : currentPlan.billing.paymentMethod === 'NEQUI' ? '📱 Nequi'
                            : currentPlan.billing.paymentMethod === 'PSE' ? '🏦 PSE'
                            : currentPlan.billing.paymentMethod === 'BANCOLOMBIA_TRANSFER' ? '🏦 Bancolombia'
                            : currentPlan.billing.paymentMethod}
                        </p>
                      </div>
                    )}
                    {currentPlan.billing.reference && (
                      <div>
                        <p className="text-slate-400 uppercase font-bold">Referencia</p>
                        <p className="text-slate-700 font-mono font-bold mt-0.5 truncate" title={currentPlan.billing.reference}>
                          {currentPlan.billing.reference}
                        </p>
                      </div>
                    )}
                    {currentPlan.billing.transactionId && (
                      <div className="col-span-2">
                        <p className="text-slate-400 uppercase font-bold">ID de Transacción</p>
                        <p className="text-slate-700 font-mono font-bold mt-0.5 truncate" title={currentPlan.billing.transactionId}>
                          {currentPlan.billing.transactionId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subscription Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Línea de Tiempo</p>
              <div className="relative pl-5 space-y-3">
                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gradient-to-b from-indigo-300 via-emerald-300 to-slate-200" />

                {subscription.startDate && (
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">Suscripción activada</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(subscription.startDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {currentPlan?.billing?.paidAt && (
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">Último pago procesado</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(currentPlan.billing.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}{formatPrice(currentPlan.billing.amount)}
                      </p>
                    </div>
                  </div>
                )}

                {subscription.endDate && (
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
                    <div>
                      <p className="text-[11px] font-bold text-slate-500">Próxima renovación</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(subscription.endDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Change plan button */}
          <Button onClick={() => setShowPlans(true)} variant="outline" className="w-full rounded-xl h-9 text-xs font-bold border-slate-300 hover:bg-slate-50">
            Cambiar Plan
          </Button>

          {/* Security footer */}
          <div className="flex items-center justify-center gap-2 text-slate-300 text-[10px]">
            <Shield className="w-3 h-3" />
            Pagos procesados de forma segura con Wompi
          </div>
        </motion.div>
      )}

      {/* ── Plans Grid (when changing or no plan) ── */}
      {shouldShowPlans && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                {plan ? 'Cambiar Plan' : 'Elige tu Plan'}
              </h2>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {plan ? 'Selecciona un nuevo plan. El cambio solo se aplica al confirmar el pago.' : 'Selecciona el plan ideal para tu negocio.'}
              </p>
            </div>
            {plan && subscription?.status === 'active' && (
              <Button onClick={() => setShowPlans(false)} variant="ghost" className="text-xs text-slate-400">
                ← Volver
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            {(plans as Plan[]).map((p, i) => {
              const tier = getPlanTier(p.name)
              const features = parseFeatures(p.features || '[]')
              const isCurrentPlan = plan?.id === p.id
              const isSelected = selectedPlan === p.id
              const isLoading = createSessionMutation.isPending && isSelected
              const isDowngrade = plan && getPlanOrder(plan.name) > getPlanOrder(p.name)

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                    tier.popular
                      ? 'border-indigo-400 shadow-lg shadow-indigo-50 scale-[1.02]'
                      : isSelected
                        ? 'border-slate-400 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {tier.badge && (
                    <div className={`absolute top-0 right-0 bg-gradient-to-r ${tier.gradient} text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl`}>
                      {tier.badge}
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tier.gradient} text-white flex items-center justify-center`}>
                        {tier.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">{p.name}</h3>
                        {p.description && <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">{formatPrice(p.price)}</span>
                      <span className="text-xs text-slate-400 font-medium">/{p.interval === 'annual' ? 'año' : 'mes'}</span>
                    </div>

                    <ul className="space-y-1.5">
                      {features.map((feature, fi) => (
                        <li key={fi} className="flex items-start gap-2 text-[11px] text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => !isCurrentPlan && handleSelectPlan(p)}
                      disabled={isCurrentPlan || isLoading}
                      className={`w-full rounded-xl h-9 font-bold text-[11px] uppercase tracking-wider transition-all ${
                        isCurrentPlan
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                          : isDowngrade
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            : tier.popular
                              ? `bg-gradient-to-r ${tier.gradient} text-white hover:opacity-90`
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrentPlan ? (
                        'Plan Actual'
                      ) : isDowngrade ? (
                        <><ArrowDown className="w-3 h-3 mr-1.5" /> Cambiar</>
                      ) : (
                        <>Suscribirse <ArrowRight className="w-3 h-3 ml-1.5" /></>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 py-2">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-medium">
              <Shield className="w-3.5 h-3.5" />
              Pago seguro con Wompi
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Downgrade Confirmation Dialog ── */}
      <AnimatePresence>
        {downgradeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">¿Cambiar a {downgradeTarget.name}?</h3>
                  <p className="text-xs text-slate-400 mt-1">Estás cambiando a un plan con menos beneficios</p>
                </div>
              </div>

              {/* Features you'll lose */}
              {(() => {
                const targetFeatures = parseFeatures(downgradeTarget.features || '[]')
                const losingFeatures = getLosingFeatures(currentFeatures, targetFeatures)

                return losingFeatures.length > 0 ? (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Perderás acceso a:</p>
                    <ul className="space-y-1.5">
                      {losingFeatures.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-[12px] text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              })()}

              {/* Price comparison */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Plan actual</p>
                  <p className="text-sm font-bold text-slate-700">{plan?.name} — {formatPrice(plan?.price || 0)}/mes</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Nuevo plan</p>
                  <p className="text-sm font-bold text-amber-700">{downgradeTarget.name} — {formatPrice(downgradeTarget.price)}/mes</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => setDowngradeTarget(null)} variant="outline" className="flex-1 rounded-xl text-xs font-bold">
                  Cancelar
                </Button>
                <Button
                  onClick={() => proceedToPayment(downgradeTarget.id)}
                  className="flex-1 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Confirmar cambio
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
