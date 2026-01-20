'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { SidebarProvider } from '@/lib/sidebar-context'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { SubscriptionGate } from '@/components/subscriptions/subscription-gate'

function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      <OnboardingProvider>
        <SubscriptionGate>
          <LayoutContent>{children}</LayoutContent>
        </SubscriptionGate>
      </OnboardingProvider>
    </SidebarProvider>
  )
}

