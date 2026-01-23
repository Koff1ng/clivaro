'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Mail, AlertCircle, Loader2, Building2, CheckCircle2, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'
import Link from 'next/link'

export default function TenantLoginPage() {
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenantSlug as string

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    // Verificar que el tenant existe
    const verifyTenant = async () => {
      try {
        const response = await fetch(`/api/tenants/verify?slug=${encodeURIComponent(tenantSlug)}`)

        if (!response.ok) {
          setError('Empresa no encontrada. Verifique el identificador.')
          setVerifying(false)
          return
        }

        const { tenant, dbMode } = await response.json()

        if (!tenant.active) {
          setError('Su cuenta está inactiva. Contacte al administrador.')
          setVerifying(false)
          return
        }

        if (dbMode === 'legacy_sqlite') {
          setError('Esta empresa aún no está configurada en producción. Contacte al administrador para migrarla.')
          setVerifying(false)
          return
        }

        setTenantName(tenant.name)
        setVerifying(false)
      } catch (err) {
        setError('Error al verificar la empresa. Por favor, intente nuevamente.')
        setVerifying(false)
      }
    }

    if (tenantSlug) {
      verifyTenant()
    } else {
      setError('Identificador de empresa no válido')
      setVerifying(false)
    }
  }, [tenantSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        tenantSlug, // Pasar el tenant slug al provider
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        // Show actionable error from CredentialsProvider when available
        const msg = typeof result.error === 'string' ? result.error : 'Credenciales inválidas.'
        setError(msg)
        setLoading(false)
      } else if (result?.ok) {
        // Wait a bit to ensure session is fully established
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
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-slate-950 text-white overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-3xl" />
        </div>

        {/* Header content */}
        <div className="relative z-10 flex items-center justify-between">
          <Logo size="lg" className="w-fit" />
          <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            {tenantName || 'Acceso Corporativo'}
          </div>
        </div>

        {/* Feature/Testimonial Content */}
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
            Bienvenido a {tenantName || 'tu espacio de trabajo'}.
          </h2>
          <div className="space-y-4">
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
              Ingrese sus credenciales de colaborador
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
              <Label htmlFor="username" className="text-gray-700 dark:text-gray-300 font-medium">
                Usuario o Email
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all text-base"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium">
                Contraseña
              </Label>
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
              className="w-full h-12 bg-gray-900 hover:bg-black text-white font-semibold text-lg shadow-lg hover:shadow-gray-900/25 transition-all duration-200 dark:bg-blue-600 dark:hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  Iniciar Sesión
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
              ← Cambiar empresa
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


