'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WelcomeOnboarding } from './welcome-onboarding'
import { ProductTour } from '@/components/tutorial/product-tour'

async function checkOnboarding() {
  try {
    const res = await fetch('/api/onboarding')
    if (!res.ok) {
      return { needsOnboarding: false, settings: null, plan: null }
    }
    return res.json()
  } catch (error) {
    console.error('Error checking onboarding:', error)
    return { needsOnboarding: false, settings: null, plan: null }
  }
}

interface OnboardingProviderProps {
  children: React.ReactNode
  forceShow?: boolean
  onForceClose?: () => void
}

export function OnboardingProvider({ children, forceShow, onForceClose }: OnboardingProviderProps) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: checkOnboarding,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  useEffect(() => {
    if (!isLoading && data) {
      setIsChecking(false)
      if (data.needsOnboarding) {
        setShowOnboarding(true)
      }
    }
  }, [data, isLoading])

  // Demo mode: force show when prop changes
  useEffect(() => {
    if (forceShow) setShowOnboarding(true)
  }, [forceShow])

  if (isChecking && !forceShow) {
    return <>{children}</>
  }

  return (
    <>
      {showOnboarding && (
        <WelcomeOnboarding
          planName={data?.plan?.name}
          isDemo={forceShow}
          onComplete={() => {
            setShowOnboarding(false)
            if (forceShow && onForceClose) {
              onForceClose()
            } else {
              // After onboarding, trigger the product tour
              setShowTour(true)
              // Also reload to refresh data
              window.location.reload()
            }
          }}
        />
      )}
      {!showOnboarding && (
        <>
          {children}
          {/* Product Tour — auto starts if not completed */}
          <ProductTour
            autoStart={!showOnboarding}
            forceShow={showTour}
            onComplete={() => setShowTour(false)}
          />
        </>
      )}
    </>
  )
}
