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
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {isSuperAdmin && (
        <Badge variant="outline" className="border-border/60 bg-background/80 text-foreground/80">
          Super Admin
        </Badge>
      )}

      {!isSuperAdmin &&
        (isLoading ? (
          <Badge variant="outline" className="border-border/60 bg-background/80 text-muted-foreground">
            Plan: ...
          </Badge>
        ) : (
          planName && (
            <Badge
              variant="outline"
              className="border-border/60 bg-background/80 text-foreground/80"
            >
              Plan: {planName}
            </Badge>
          )
        ))}

      {!isSuperAdmin && (
        <>
          {isExpired ? (
            <Badge variant="destructive" className="text-xs">
              Suscripción expirada
            </Badge>
          ) : (
            (() => {
              const label = getSubscriptionLabel(subscription?.status || null)
              return label ? (
                <Badge
                  variant="outline"
                  className="border-border/60 bg-background/80 text-foreground/80"
                >
                  Suscripción: {label}
                </Badge>
              ) : null
            })()
          )}
        </>
      )}
    </div>
  )
}


