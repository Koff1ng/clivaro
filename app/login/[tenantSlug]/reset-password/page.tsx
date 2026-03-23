'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LoadingScreen } from '@/components/ui/loading-screen'

export default function ResetPasswordPage({ params }: { params: { tenantSlug: string } }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    setToken(p.get('token'))
  }, [])

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

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!token) {
      setError('Enlace inválido. Solicite uno nuevo desde "Olvidé mi contraseña".')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'No se pudo actualizar la contraseña.')
        setLoading(false)
        return
      }

      setSuccess(data.message || 'Contraseña actualizada.')
      setPassword('')
      setPassword2('')
      setTimeout(() => {
        router.push(`/login/${params.tenantSlug}`)
      }, 2500)
    } catch {
      setError('Error de conexión.')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva contraseña</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tenantName ? `Empresa: ${tenantName}` : ''}
          </p>
        </div>

        {!token && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            Falta el token en el enlace. Abra el enlace completo del correo o solicite uno nuevo.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex flex-col gap-2">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p>{success}</p>
              </div>
              <p className="text-xs pl-8">Redirigiendo al inicio de sesión…</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading || !token}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password2">Confirmar contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="password2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={8}
                disabled={loading || !token}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12" disabled={loading || !token || !!success}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar contraseña'
            )}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href={`/login/${params.tenantSlug}`}
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
