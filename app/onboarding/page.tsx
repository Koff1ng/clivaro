import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export const metadata: Metadata = {
  title: 'Bienvenido a Clivaro',
  description: 'Configura tu espacio de trabajo en minutos',
}

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session || !(session.user as any).tenantId) {
    redirect('/login')
  }

  return <OnboardingFlow />
}
