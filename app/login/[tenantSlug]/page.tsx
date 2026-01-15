'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Mail, AlertCircle, Loader2, Building2 } from 'lucide-react'
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

        const { tenant } = await response.json()
        
        if (!tenant.active) {
          setError('Su cuenta está inactiva. Contacte al administrador.')
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
        setError('Credenciales inválidas. Verifique su usuario y contraseña.')
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4" style={{ padding: 0, margin: 0 }}>
            <Logo size="lg" showByline={true} />
          </div>
          {tenantName && (
            <div className="mb-2">
              <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
                <Building2 className="w-4 h-4" />
                {tenantName}
              </p>
            </div>
          )}
          <p className="text-gray-600 text-sm">Sistema de Gestión Integral</p>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center text-gray-900">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Usuario o Email
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="nombre_usuario o usuario@ejemplo.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  autoComplete="current-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link 
            href="/" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
          >
            ← Cambiar empresa
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 Clivaro by Clientum Studio. Todos los derechos reservados.
        </p>
      </div>

    </div>
  )
}


