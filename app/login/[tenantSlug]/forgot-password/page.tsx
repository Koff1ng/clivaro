'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'

export default function ForgotPasswordPage({ params }: { params: { tenantSlug: string } }) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
      } catch {
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
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: params.tenantSlug,
          identifier: identifier.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar la solicitud.')
        setLoading(false)
        return
      }

      setSuccess(data.message || 'Revise su correo para continuar.')
      setIdentifier('')
    } catch {
      setError('Error de conexión. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return <LoadingScreen />
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">¿Olvidó su contraseña?</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tenantName ? `Empresa: ${tenantName}` : 'Recuperación de acceso'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ingrese el mismo <strong>usuario o correo</strong> que usa para iniciar sesión. Si su cuenta tiene correo
            registrado, le enviaremos un enlace para elegir una nueva contraseña.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="identifier">Usuario o correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="usuario o correo@empresa.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={loading}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar enlace de recuperación'
            )}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href={`/login/${params.tenantSlug}`}
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
