'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, AlertCircle, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'
import { SpotlightCard } from '@/components/ui/spotlight-card'

import { BusinessTypes } from '@/components/marketing/business-types'
import { Testimonials } from '@/components/marketing/testimonials'

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
    <div className="w-full min-h-screen flex flex-col bg-white dark:bg-slate-950">

      {/* Hero / Login Section */}
      <section className="w-full min-h-screen grid lg:grid-cols-2 relative">
        {/* Left Panel - Brand & Visuals */}
        <div className="hidden lg:flex relative flex-col justify-between p-12 bg-slate-950 text-white overflow-hidden">
          {/* Abstract Background Effects */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl" />
          </div>

          {/* Header content */}
          <div className="relative z-10">
            <Logo size="lg" className="w-fit" />
          </div>

          {/* Feature/Testimonial Content */}
          <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
              La plataforma definitiva para escalar tu negocio.
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                <span>Gestión integral de inventario y ventas</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                <span>Facturación electrónica automatizada</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                <span>CRM y análisis de datos en tiempo real</span>
              </div>
            </div>
          </div>

          {/* Footer content */}
          <div className="relative z-10 text-sm text-slate-500">
            © 2026 Clivaro by Clientum Studio.
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 w-full relative z-10">
          <div className="w-full max-w-md space-y-8">

            {/* Header Mobile Only Logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <Logo size="lg" />
            </div>

            <div className="text-center lg:text-left space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Acceso a su Empresa
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Ingrese el identificador único de su organización
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
                <Label htmlFor="tenantSlug" className="text-gray-700 dark:text-gray-300 font-medium">
                  Identificador de Empresa
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <Input
                    id="tenantSlug"
                    type="text"
                    placeholder="ej: mi-empresa"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    required
                    disabled={loading}
                    className="pl-10 h-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all text-base"
                    autoComplete="organization"
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
                    Verificando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <div className="mb-4">
                <Link
                  href="/pricing"
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline inline-flex items-center gap-1"
                >
                  Ver Planes y Precios <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-sm text-gray-500">
                ¿No tiene una cuenta? <Link href="/pricing" className="text-gray-900 dark:text-gray-200 font-medium hover:underline">Contáctenos</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* New Marketing Sections */}
      <BusinessTypes />
      <Testimonials />

      {/* Scroll to bottom footer if needed, or rely on page flow. 
          Given the current design, the "simple footer" is part of the hero left panel.
          We might want a global footer later, but for now this meets the requirement. */}
      <footer className="py-8 bg-slate-950 text-center text-slate-500 text-sm lg:hidden">
        © 2026 Clivaro by Clientum Studio.
      </footer>
    </div>
  )
}
