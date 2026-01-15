'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WelcomeOnboarding } from './welcome-onboarding'

async function checkOnboarding() {
  const res = await fetch('/api/onboarding')
  if (!res.ok) throw new Error('Failed to check onboarding')
  return res.json()
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: checkOnboarding,
    staleTime: 5 * 60 * 1000, // 5 minutos
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

