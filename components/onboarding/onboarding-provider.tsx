'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WelcomeOnboarding } from './welcome-onboarding'

async function checkOnboarding() {
  try {
    const res = await fetch('/api/onboarding')
    if (!res.ok) {
      // Si hay error, retornar un objeto por defecto en lugar de lanzar error
      return { needsOnboarding: false, settings: null, plan: null }
    }
    return res.json()
  } catch (error) {
    console.error('Error checking onboarding:', error)
    // Retornar un objeto por defecto en lugar de lanzar error
    return { needsOnboarding: false, settings: null, plan: null }
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: checkOnboarding,
    staleTime: Infinity, // No refrescar automáticamente - solo cuando se complete el onboarding
    gcTime: Infinity, // Mantener en caché indefinidamente
  })

  useEffect(() => {
    if (!isLoading && data) {
      setIsChecking(false)
      if (data.needsOnboarding) {
        setShowOnboarding(true)
      }
    }
  }, [data, isLoading])

  if (isChecking) {
    return <>{children}</>
  }

  return (
    <>
      {showOnboarding && (
        <WelcomeOnboarding
          planName={data?.plan?.name}
          onComplete={() => {
            setShowOnboarding(false)
            // Invalidar query para refrescar
            window.location.reload()
          }}
        />
      )}
      {!showOnboarding && children}
    </>
  )
}

