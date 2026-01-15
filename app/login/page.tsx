'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir a la página de selección de tenant
    router.replace('/')
  }, [router])

  return <LoadingScreen />
}
