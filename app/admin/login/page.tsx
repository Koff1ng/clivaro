'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Mail, AlertCircle, Loader2, Shield, CheckCircle2, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Login sin tenantSlug para super admin (usa BD maestra)
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        const errorMessage = result.error
        let displayMessage = 'Credenciales inválidas. Verifique su usuario y contraseña.'

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

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="w-full h-screen grid lg:grid-cols-2 overflow-hidden">
      {/* Left Panel - Brand & Visuals */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-slate-950 text-white overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl" />
        </div>

        {/* Header content */}
        <div className="relative z-10 flex items-center justify-between">
          <Logo size="lg" className="w-fit" />
          <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2">
            <Shield className="w-3 h-3" />
            Acceso Administrativo
          </div>
        </div>

        {/* Feature/Testimonial Content */}
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
            Panel de Control Centralizado.
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              <span>Gestión global de inquilinos y suscripciones</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              <span>Monitoreo de sistema y auditoría</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              <span>Configuración avanzada de plataforma</span>
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
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-8 h-8 text-indigo-600 hidden lg:block" />
              Portal de Administración
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Ingrese sus credenciales de super-administrador
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
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin@clivaro.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all text-base"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium">
                Contraseña
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-600 transition-colors">
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
                  className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all text-base"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg shadow-lg hover:shadow-indigo-500/25 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-indigo-600 font-medium hover:underline inline-flex items-center gap-1 transition-colors"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


