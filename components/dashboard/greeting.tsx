'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

async function fetchOnboardingData() {
  try {
    const res = await fetch('/api/onboarding')
    if (!res.ok) return null
    return res.json()
  } catch (error) {
    console.error('Error fetching onboarding data:', error)
    return null
  }
}

export function DashboardGreeting() {
  const { data: session } = useSession()
  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  })

  // Si hay error o no hay datos, usar valores por defecto
  const userName = onboardingData?.settings?.onboardingUserName || session?.user?.name || 'Usuario'
  const firstName = userName.split(' ')[0]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Buen día'
    if (hour >= 12 && hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="mb-4 pb-4 border-b border-border/40">
      <h1 className="text-lg font-light text-foreground tracking-tight">
        {getGreeting()}, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground mt-0.5 font-light">
        Resumen general de tu operación
      </p>
    </div>
  )
}

