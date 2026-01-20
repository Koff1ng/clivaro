'use client'

import { ReactNode, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SubscriptionGateProps {
  children: ReactNode
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

  const { subscription, isExpired, isLoading } = useTenantPlan()

  // Nombre de la empresa / tenant si está disponible en la sesión
  const tenantLabel =
    (session?.user as any)?.tenantName ||
    (session?.user as any)?.companyName ||
    (session?.user as any)?.tenantSlug ||
    null

  const { shouldBlock, statusLabel } = useMemo(() => {
    if (isSuperAdmin) {
      return { shouldBlock: false, statusLabel: null as string | null }
    }

    // Siempre permitir acceder a configuración (incluye pestaña de suscripción)
    if (pathname?.startsWith('/settings')) {
      return { shouldBlock: false, statusLabel: null as string | null }
    }

    // Mientras está cargando, no bloquear para evitar parpadeos
    if (isLoading) {
      return { shouldBlock: false, statusLabel: null as string | null }
    }

    if (!subscription) {
      // Sin suscripción, bloquear acceso a módulos operativos
      return { shouldBlock: true, statusLabel: 'sin_suscripcion' }
    }

    if (isExpired) {
      return { shouldBlock: true, statusLabel: 'expired' }
    }

    const rawStatus = (subscription.status || '').toLowerCase()

    if (rawStatus === 'active') {
      return { shouldBlock: false, statusLabel: 'active' }
    }

    // pending_payment, pending, trial, u otros estados no activos -> bloquear
    return { shouldBlock: true, statusLabel: rawStatus || 'inactive' }
  }, [isSuperAdmin, pathname, isLoading, subscription, isExpired])

  if (!shouldBlock) {
    return <>{children}</>
  }

  const goToSubscription = () => {
    router.push('/settings?tab=subscription')
  }

  const getTitleAndMessage = () => {
    const empresa = tenantLabel ? ` de ${tenantLabel}` : ''

    switch (statusLabel) {
      case 'expired':
        return {
          title: 'Tu suscripción ha expirado',
          message:
            `Para seguir usando todas las funciones de ClientumExpress${empresa}, renueva tu suscripción desde el módulo de Suscripción. Tu información y datos permanecen seguros mientras regularizas el pago.`,
        }
      case 'pending_payment':
      case 'pending':
        return {
          title: 'Tienes un pago de suscripción pendiente',
          message:
            `Detectamos un pago pendiente en la suscripción${empresa}. Completa el proceso de pago para activar inmediatamente todas las funciones de la plataforma.`,
        }
      case 'trial':
        return {
          title: 'Tu período de prueba ha finalizado',
          message:
            `El período de prueba de la suscripción${empresa} ha terminado. Elige un plan y realiza el pago para seguir utilizando el sistema sin interrupciones.`,
        }
      case 'sin_suscripcion':
      case 'inactive':
      default:
        return {
          title: 'No se encontró una suscripción activa',
          message:
            `Para que${empresa || ' tu empresa'} utilice ClientumExpress necesitas una suscripción activa. Configura tu plan y realiza el pago desde el módulo de Suscripción.`,
        }
    }
  }

  const { title, message } = getTitleAndMessage()

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4">
      <Card className="max-w-xl w-full shadow-2xl border border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center text-center space-y-3 pb-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 shadow-lg mb-1">
            {statusLabel === 'expired' ? (
              <AlertCircle className="h-8 w-8 text-white" />
            ) : (
              <Lock className="h-8 w-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-white">{title}</CardTitle>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Acceso restringido por suscripción
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-300 text-center leading-relaxed">{message}</p>

          <div className="space-y-3">
            <Button
              className="w-full h-11 text-base font-semibold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25"
              onClick={goToSubscription}
            >
              <CreditCard className="h-5 w-5" />
              Ir a la sección de Suscripción y pago
            </Button>
            <p className="text-xs text-slate-400 text-center">
              Después de completar el pago, tu suscripción se activará automáticamente y podrás seguir
              trabajando sin interrupciones.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="text-[11px] text-slate-500 text-center">
              Si crees que esto es un error, contacta con el administrador de tu empresa o con el soporte de
              ClientumExpress.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


