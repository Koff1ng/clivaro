'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Mail, AlertCircle, Loader2, ArrowRight, CheckCircle2, Building2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'
import Link from 'next/link'

export default function TenantLoginPage({ params }: { params: { tenantSlug: string } }) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    async function verifyTenant() {
      try {
        const response = await fetch(`/api/tenants/verify?slug=${params.tenantSlug}`)
        if (response.ok) {
          const data = await response.json()
          setTenantName(data.tenant.name)
        } else {
          router.push('/')
        }
      } catch (err) {
        console.error('Error verifying tenant:', err)
        router.push('/')
      } finally {
        setVerifying(false)
      }
    }
    verifyTenant()
  }, [params.tenantSlug, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username: identifier,
        password,
        tenantSlug: params.tenantSlug,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        const errorMessage = result.error
        let displayMessage = 'Credenciales inválidas. Verifique su correo y contraseña.'

        if (errorMessage.includes('USER_INACTIVE')) {
          displayMessage = 'Su cuenta está inactiva. Contacte al administrador.'
        } else if (errorMessage.includes('INVALID_CREDENTIALS')) {
          displayMessage = 'Usuario o contraseña incorrectos.'
        } else if (errorMessage.includes('TENANT_DB_ERROR')) {
          displayMessage = 'Error de conexión con la base de datos. Intente nuevamente.'
        } else if (errorMessage.includes('TENANT_NOT_READY')) {
          displayMessage = 'El sistema aún no está completamente configurado.'
        } else if (errorMessage) {
          displayMessage = errorMessage.replace(/^(INVALID_CREDENTIALS|USER_INACTIVE|TENANT_DB_ERROR|TENANT_NOT_READY):\s*/i, '')
        }

        setError(displayMessage)
        setLoading(false)
      } else if (result?.ok) {
        // Redirigir manualmente después del login exitoso
        await new Promise(resolve => setTimeout(resolve, 300))
        window.location.href = '/dashboard'
      } else {
        setError('Error al iniciar sesión. Por favor, intente nuevamente.')
        setLoading(false)
      }
    } catch (err) {
      setError('Error al conectar con el servidor. Por favor, intente nuevamente.')
      setLoading(false)
    }
  }

  // Show loading screen when verifying or loading
  if (verifying || loading) {
    return <LoadingScreen />
  }

  return (
    <div className="w-full h-screen grid lg:grid-cols-2 overflow-hidden">
      {/* Left Panel - Brand & Visuals */}
      <div className="hidden lg:flex relative flex-col justify-between pt-4 px-12 pb-12 bg-slate-950 text-white overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-3xl" />
        </div>

        <div>
          {/* Brand Header & Headline Grouped */}
          <div className="relative z-10 flex flex-col gap-0 mb-12">
            <div className="flex items-center justify-between w-full mb-2">
              <Logo
                size="lg"
                className="w-72 md:w-80 lg:w-96 h-auto -mb-10 ml-19"
              />
              <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2 h-fit">
                <Building2 className="w-3 h-3" />
                {tenantName || 'Acceso Corporativo'}
              </div>
            </div>
            <div className="max-w-lg -mt-10">
              <h2 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
                Bienvenido a {tenantName || 'tu espacio de trabajo'}.
              </h2>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-cyan-500" />
              <span>Acceso seguro y encriptado</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-cyan-500" />
              <span>Ambiente exclusivo para tu organización</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-cyan-500" />
              <span>Soporte técnico dedicado</span>
            </div>
          </div>
        </div>

        {/* Footer content */}
        <div className="relative z-10 text-sm text-slate-500">
          © 2026 Clivaro by Clientum Studio.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 w-full">
        <div className="w-full max-w-md space-y-8">

          {/* Header Mobile Only Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Iniciar Sesión
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Acceda a su cuenta corporativa
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2.5">
              <Label htmlFor="identifier" className="text-gray-700 dark:text-gray-300 font-medium">
                Usuario o Correo Electrónico
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="usuario o nombre@empresa.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all text-base"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium">
                  Contraseña
                </Label>
                <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
                  ¿Olvidó su contraseña?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all text-base"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  Entrar al Sistema
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-blue-600 font-medium hover:underline inline-flex items-center gap-1 transition-colors"
            >
              ← Cambiar de empresa
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
