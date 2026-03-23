'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface ForcedCredentialModalProps {
  open: boolean
  tenantSlug: string
}

export function ForcedCredentialModal({ open, tenantSlug }: ForcedCredentialModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        setSuccess(true)
        // Redirigir al inicio de sesión en 2 segundos
        setTimeout(() => {
          signOut({ callbackUrl: `/login/${tenantSlug}` })
        }, 2000)
      } else {
        const data = await response.json()
        setError(data.error || 'Error al actualizar credenciales.')
        setLoading(false)
      }
    } catch (err) {
      setError('Error de conexión con el servidor.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Actualización de Seguridad Requerida
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            El administrador del sistema ha restablecido tus credenciales cortas.
            <br />
            Por razones de seguridad, debes configurar un nuevo usuario y contraseña personalizados antes de continuar.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-green-800">¡Credenciales actualizadas!</h3>
            <p className="text-sm text-gray-500">
              Redirigiendo a la pantalla de inicio de sesión para que ingreses con tus nuevos datos...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-username">Nuevo Nombre de Usuario</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: juan.perez"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Guardar y Continuar'
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
