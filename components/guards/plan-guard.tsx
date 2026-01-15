'use client'

import { ReactNode } from 'react'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
import { hasFeature, PlanFeatures } from '@/lib/plan-features'
import { PlanRestriction } from '@/components/ui/plan-restriction'

type PlanGuardProps = {
  featureKey: keyof PlanFeatures
  featureLabel: string
  requiredPlan?: string
  children: ReactNode
}

export function PlanGuard({ featureKey, featureLabel, requiredPlan = 'Business', children }: PlanGuardProps) {
  const { planName, isLoading, error } = useTenantPlan()

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando plan...</div>
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        Error al validar el plan. Intenta recargar.
      </div>
    )
  }

  if (!hasFeature((planName as any) || null, featureKey)) {
    return <PlanRestriction feature={featureLabel} requiredPlan={requiredPlan} />
  }

  return <>{children}</>
}


