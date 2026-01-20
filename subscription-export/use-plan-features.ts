'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PlanName, hasFeature, getPlanFeatures, PlanFeatures } from '@/lib/plan-features'

interface TenantPlanResponse {
  planId: string | null
  status: string
  plan: {
    id: string
    name: string
    description: string | null
    price: number
    currency: string
    interval: string
    features: string | null
  } | null
  subscription: {
    id: string
    status: string
    startDate: string
    endDate: string | null
    autoRenew: boolean
  } | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
  lastPaymentStatus: string | null
  features: any | null
}

export function useTenantPlan() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

  const { data, isLoading, error } = useQuery<TenantPlanResponse>({
    queryKey: ['tenant-plan'],
    queryFn: async () => {
      // Super admin siempre tiene acceso a todo
      if (isSuperAdmin) {
        return {
          planId: 'enterprise',
          status: 'active',
          plan: null,
          subscription: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          nextBillingDate: null,
          cancelAtPeriodEnd: false,
          lastPaymentStatus: null,
          features: null,
        }
      }

      try {
        const res = await fetch('/api/tenant/plan')
        if (!res.ok) {
          // Si hay error, retornar plan free para que el sidebar muestre elementos basándose solo en permisos
          console.warn('Failed to fetch tenant plan, using free plan')
          return {
            planId: 'free',
            status: 'inactive',
            plan: null,
            subscription: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            nextBillingDate: null,
            cancelAtPeriodEnd: false,
            lastPaymentStatus: null,
            features: null,
          }
        }
        return res.json()
      } catch (err) {
        // Si hay error de red o conexión, retornar plan free
        console.warn('Error fetching tenant plan, using free plan:', err)
        return {
          planId: 'free',
          status: 'inactive',
          plan: null,
          subscription: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          nextBillingDate: null,
          cancelAtPeriodEnd: false,
          lastPaymentStatus: null,
          features: null,
        }
      }
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 2,
    retryDelay: 2000,
  })

  const planName = (data?.plan?.name as PlanName) || null
  const features = getPlanFeatures(planName)

  return {
    plan: data?.plan,
    subscription: data?.subscription,
    planName,
    planId: data?.planId || 'free',
    features,
    isLoading,
    error,
    isExpired: data?.status === 'expired' || data?.status === 'inactive',
    isActive: data?.status === 'active',
    isPending: data?.status === 'pending_payment',
    cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false,
    nextBillingDate: data?.nextBillingDate ? new Date(data.nextBillingDate) : null,
    currentPeriodStart: data?.currentPeriodStart ? new Date(data.currentPeriodStart) : null,
    currentPeriodEnd: data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null,
    lastPaymentStatus: data?.lastPaymentStatus,
    hasFeature: (feature: keyof PlanFeatures) => {
      if (isSuperAdmin) return true
      if (data?.planId === 'free') return false
      return hasFeature(planName, feature)
    },
  }
}
