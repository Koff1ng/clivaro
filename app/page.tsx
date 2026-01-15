'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const [tenantSlug, setTenantSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!tenantSlug.trim()) {
      setError('Por favor ingrese el identificador de su empresa')
      return
    }

    setLoading(true)

    try {
      // Verificar que el tenant existe
      const response = await fetch(`/api/tenants/verify?slug=${encodeURIComponent(tenantSlug.trim())}`)
      
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Empresa no encontrada. Verifique el identificador.')
        setLoading(false)
        return
      }

      const { tenant } = await response.json()
      
      if (!tenant.active) {
        setError('Su cuenta está inactiva. Contacte al administrador.')
        setLoading(false)
        return
      }

      // Redirigir al login del tenant
      router.push(`/login/${tenant.slug}`)
    } catch (err) {
      setError('Error al verificar la empresa. Por favor, intente nuevamente.')
      setLoading(false)
    }
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
          <p className="text-gray-600 text-sm">Sistema de Gestión Integral</p>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center text-gray-900 flex items-center justify-center gap-2">
              <Building2 className="w-6 h-6" />
              Acceso a su Empresa
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Ingrese el identificador de su empresa para continuar
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
                <Label htmlFor="tenantSlug" className="text-gray-700 font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Identificador de Empresa
                </Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  placeholder="ej: mi-empresa"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  disabled={loading}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  autoComplete="organization"
                />
                <p className="text-xs text-gray-500">
                  El identificador es único para cada empresa (ej: mi-empresa, ferreteria-central)
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="text-center mt-6 space-y-2">
          <Link 
            href="/pricing" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors block"
          >
            Ver Planes y Precios →
          </Link>
          <p className="text-xs text-gray-500">
            ¿No tiene una cuenta? <Link href="/pricing" className="text-blue-600 hover:underline">Contáctenos</Link>
          </p>
          {/* Acceso discreto a super admin */}
          <Link 
            href="/admin/login" 
            className="text-xs text-gray-400 hover:text-gray-500 transition-colors opacity-50 hover:opacity-70"
            title="Acceso Administrativo"
          >
            Admin
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
