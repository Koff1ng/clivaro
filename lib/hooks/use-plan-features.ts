'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PlanName, hasFeature, getPlanFeatures, PlanFeatures } from '@/lib/plan-features'

interface TenantPlan {
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
    trialEndDate: string | null
    createdAt: string
  } | null
  features: string[] | null
  expired?: boolean
  previousPlan?: {
    id: string
    name: string
  } | null
  isRecentChange?: boolean
}

export function useTenantPlan() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

  const { data, isLoading, error } = useQuery<TenantPlan>({
    queryKey: ['tenant-plan'],
    queryFn: async () => {
      // Super admin siempre tiene acceso a todo
      if (isSuperAdmin) {
        return {
          plan: { name: 'Enterprise' } as any,
          subscription: null,
          features: null,
        }
      }

      try {
        const res = await fetch('/api/tenant/plan')
        if (!res.ok) {
          // Si hay error, retornar null para que el sidebar muestre elementos basándose solo en permisos
          console.warn('Failed to fetch tenant plan, using permissions-only mode')
          return {
            plan: null,
            subscription: null,
            features: null,
          }
        }
        return res.json()
      } catch (err) {
        // Si hay error de red o conexión, retornar null para que el sidebar funcione
        console.warn('Error fetching tenant plan, using permissions-only mode:', err)
        return {
          plan: null,
          subscription: null,
          features: null,
        }
      }
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 2, // Reintentar 2 veces antes de usar el fallback
    retryDelay: 2000, // Esperar 2 segundos entre reintentos
  })

  const planName = (data?.plan?.name as PlanName) || null
  const previousPlanName = (data?.previousPlan?.name as PlanName) || null
  const features = getPlanFeatures(planName)
  const previousFeatures = getPlanFeatures(previousPlanName)

  // Determinar qué features son nuevas comparando con el plan anterior
  const getNewFeatures = (): string[] => {
    if (!data?.isRecentChange || !previousPlanName || !planName) {
      return []
    }

    const newFeatures: string[] = []
    const currentFeatures = (features ?? ({} as PlanFeatures)) as PlanFeatures
    const prevFeatures = (previousFeatures ?? ({} as PlanFeatures)) as PlanFeatures

    // Comparar cada feature
    Object.keys(currentFeatures).forEach((feature) => {
      const currentHas = currentFeatures[feature as keyof PlanFeatures]
      const prevHas = prevFeatures[feature as keyof PlanFeatures] || false

      // Si el plan actual tiene la feature pero el anterior no, es nueva
      if (currentHas && !prevHas) {
        newFeatures.push(feature)
      }
    })

    return newFeatures
  }

  const newFeatures = getNewFeatures()

  return {
    plan: data?.plan,
    subscription: data?.subscription,
    planName,
    previousPlanName,
    features,
    previousFeatures,
    isLoading,
    error,
    isExpired: data?.expired || false,
    isRecentChange: data?.isRecentChange || false,
    newFeatures,
    hasFeature: (feature: keyof PlanFeatures) => {
      if (isSuperAdmin) return true
      return hasFeature(planName, feature)
    },
    isNewFeature: (feature: keyof PlanFeatures) => {
      return newFeatures.includes(feature as string)
    },
  }
}

