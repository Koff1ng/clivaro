'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Copy, CheckCircle, AlertCircle } from 'lucide-react'

interface TenantFormProps {
  onClose: () => void
  onSuccess: () => void
}

export function TenantForm({ onClose, onSuccess }: TenantFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    databaseUrl: ''
  })
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear tenant')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data._initialCredentials) {
        setCredentials({
          username: data._initialCredentials.username,
          password: data._initialCredentials.password
        })
      } else {
        toast('Tenant creado exitosamente', 'success')
        onSuccess()
      }
    },
    onError: (error: Error) => {
      toast(error.message || 'Error al crear tenant', 'error')
    }
  })

  const handleCopyCredentials = () => {
    if (credentials) {
      const text = `Usuario: ${credentials.username}\nContraseña: ${credentials.password}`
      navigator.clipboard.writeText(text)
      setCopied(true)
      toast('Credenciales copiadas al portapapeles', 'success')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseCredentials = () => {
    setCredentials(null)
    toast('Tenant creado exitosamente', 'success')
    onSuccess()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Generar slug automáticamente si no se proporciona
    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    
    // Generar databaseUrl automáticamente si no se proporciona
    const databaseUrl = formData.databaseUrl || `file:./tenants/${slug}.db`

    createMutation.mutate({
      ...formData,
      slug,
      databaseUrl
    })
  }

  // Mostrar diálogo de credenciales si están disponibles
  if (credentials) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCloseCredentials}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continuar
          </Button>
          <h1 className="text-3xl font-bold">Tenant Creado Exitosamente</h1>
        </div>

        <Card className="border-2 border-green-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <CardTitle>Credenciales de Acceso por Defecto</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">⚠️ Importante:</p>
                  <p>Guarde estas credenciales de forma segura. El usuario debe cambiar la contraseña después del primer inicio de sesión.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Usuario</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={credentials.username}
                    readOnly
                    className="font-mono bg-white dark:bg-gray-900"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.username)
                      toast('Usuario copiado', 'success')
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Contraseña</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="password"
                    value={credentials.password}
                    readOnly
                    className="font-mono bg-white dark:bg-gray-900"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.password)
                      toast('Contraseña copiada', 'success')
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <Button
                onClick={handleCopyCredentials}
                variant="outline"
                className="flex-1"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Todo
                  </>
                )}
              </Button>
              <Button
                onClick={handleCloseCredentials}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Nuevo Tenant</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Nombre del negocio"
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                required
                placeholder="nombre-negocio"
                pattern="[a-z0-9\-]+"
              />
              <p className="text-sm text-gray-500 mt-1">
                Identificador único (se genera automáticamente si se deja vacío)
              </p>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@negocio.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+57 300 000 0000"
              />
            </div>

            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Dirección del negocio"
              />
            </div>

            <div>
              <Label htmlFor="databaseUrl">URL de Base de Datos</Label>
              <Input
                id="databaseUrl"
                value={formData.databaseUrl}
                onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
                placeholder="file:./tenants/nombre-negocio.db"
              />
              <p className="text-sm text-gray-500 mt-1">
                Se genera automáticamente si se deja vacío
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear Tenant'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

