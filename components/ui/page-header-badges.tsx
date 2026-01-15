'use client'

import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'

function getSubscriptionLabel(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'Activa'
    case 'trial':
      return 'Prueba'
    case 'cancelled':
      return 'Cancelada'
    case 'paused':
      return 'Pausada'
    default:
      return status || null
  }
}

export function PageHeaderBadges() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false
  const { planName, subscription, isExpired, isLoading } = useTenantPlan()

  if (!session) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSuperAdmin && <Badge variant="secondary">Super Admin</Badge>}

      {!isSuperAdmin &&
        (isLoading ? (
          <Badge variant="outline">Plan: ...</Badge>
        ) : (
          planName && (
            <Badge className="border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              Plan: {planName}
            </Badge>
          )
        ))}

      {!isSuperAdmin && (
        <>
          {isExpired ? (
            <Badge variant="destructive">Suscripción Expirada</Badge>
          ) : (
            (() => {
              const label = getSubscriptionLabel(subscription?.status || null)
              return label ? <Badge variant="outline">Suscripción: {label}</Badge> : null
            })()
          )}
        </>
      )}
    </div>
  )
}


