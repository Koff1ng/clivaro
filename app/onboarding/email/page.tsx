import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import EmailSetupFlow from '@/components/email-setup/EmailSetupFlow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default async function EmailOnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session || !(session.user as any).tenantId) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                Bienvenido a <span className="text-blue-600">Clivaro</span>
            </h1>
            <p className="text-lg text-gray-600">
                Solo un paso más para profesionalizar tus comunicaciones.
            </p>
        </div>
        
        <EmailSetupFlow mode="onboarding" />
        
        <p className="text-center text-sm text-gray-500 mt-8">
            Si necesitas ayuda, contacta a nuestro equipo de soporte técnico.
        </p>
      </div>
    </div>
  )
}
