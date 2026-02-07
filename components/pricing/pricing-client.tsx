'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, X, Zap, Building2, Rocket, TrendingUp, Users, Package, ShoppingCart, BarChart3, Mail, Sparkles, Database, Smartphone, Cloud, Lock, Globe, Headphones, Settings, Printer, Wallet, Truck, FileText, LayoutDashboard, MessageSquare, Calendar, Bell, Search, Shirt, Store, Wine, Hammer, Croissant, Car, BookOpen, Pill, Quote } from 'lucide-react'
import { ContactForm } from './contact-form'
import { ScrollNavbar } from './scroll-navbar'
import { ScrollReveal } from './scroll-reveal'
import { SoftwarePreview } from './software-preview'
import { HeroPreview } from './hero-preview'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards'
import { BusinessTypes } from '@/components/marketing/business-types'
import { Testimonials } from '@/components/marketing/testimonials'

const plans = [
  {
    name: 'Starter',
    price: 49900,
    originalPrice: 99900,
    description: 'Perfecto para pequeños negocios que están comenzando',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Más Popular',
    features: [
      'Hasta 2 usuarios incluidos',
      'Gestión de productos ilimitados',
      'Punto de Venta (POS)',
      'Control de inventario básico',
      'Facturación electrónica',
      'Clientes y proveedores',
      'Reportes básicos',
      'Dashboard con KPIs',
      'Soporte por email',
      'Actualizaciones incluidas',
    ],
    limitations: [
      'Sin marketing campaigns',
      'Sin multi-almacén',
      'Soporte estándar',
    ],
    cta: 'Seleccionar Plan',
    popular: true,
  },
  {
    name: 'Business',
    price: 79900,
    originalPrice: 159900,
    description: 'Ideal para negocios en crecimiento',
    icon: Building2,
    color: 'from-indigo-500 to-purple-500',
    badge: 'Mejor Valor',
    features: [
      'Hasta 5 usuarios incluidos',
      'Todas las funcionalidades de Starter',
      'CRM completo (Clientes, Leads, Actividades)',
      'Marketing campaigns con editor visual',
      'Multi-almacén',
      'Cotizaciones y facturas avanzadas',
      'Gestión de compras completa',
      'Reportes avanzados y analytics',
      'Integración de email',
      'Soporte prioritario',
      'Backup automático',
      'Actualizaciones prioritarias',
    ],
    limitations: [],
    cta: 'Seleccionar Plan',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 149900,
    originalPrice: 299900,
    description: 'Para negocios grandes que necesitan todo',
    icon: Rocket,
    color: 'from-orange-500 to-red-500',
    badge: 'Más Completo',
    features: [
      'Hasta 15 usuarios incluidos',
      'Todas las funcionalidades de Business',
      'Usuarios ilimitados (consultar)',
      'API personalizada',
      'Integraciones avanzadas',
      'Personalización de reportes',
      'Soporte 24/7',
      'Capacitación incluida',
      'Gestor de cuenta dedicado',
      'Migración de datos asistida',
      'Hosting dedicado (opcional)',
      'SLA garantizado',
    ],
    limitations: [],
    cta: 'Contactar Ventas',
    popular: false,
  },
]

const features = [
  { name: 'Dashboard Corporativo', icon: LayoutDashboard },
  { name: 'Gestión de Productos', icon: Package },
  { name: 'Control de Inventario', icon: BarChart3 },
  { name: 'CRM & Clientes', icon: Users },
  { name: 'Oportunidades (Leads)', icon: TrendingUp },
  { name: 'Campañas de Marketing', icon: Mail },
  { name: 'Cotizaciones', icon: FileText },
  { name: 'Facturación Electrónica', icon: Printer },
  { name: 'Gestión de Proveedores', icon: Truck },
  { name: 'Órdenes de Compra', icon: ShoppingCart },
  { name: 'Recepción de Mercancía', icon: Check },
  { name: 'Punto de Venta (POS)', icon: ShoppingCart },
  { name: 'Control de Caja', icon: Wallet },
  { name: 'Gestión de Usuarios', icon: Users },
  { name: 'Configuración del Sistema', icon: Settings },
]

const useCases = [
  { name: 'Tienda de ropa', description: 'Clasifica prendas por talla y color', icon: Shirt, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/20' },
  { name: 'Microempresas', description: 'Gestiona fácil tu efectivo y stock', icon: Store, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20' },
  { name: 'Licorería', description: 'Vende y distribuye tus bebidas', icon: Wine, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20' },
  { name: 'Ferretería', description: 'Maneja fácil tu inventario', icon: Hammer, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/20' },
  { name: 'Panaderías', description: 'Clasifica platos y factura fácil', icon: Croissant, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
  { name: 'Autopartes', description: 'Administra y ordena tus repuestos', icon: Car, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
  { name: 'Librería', description: 'Ordena por editorial, género y autor', icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
  { name: 'Farmacias', description: 'Ideal para Farmacias de todos los tamaños', icon: Pill, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/20' },
]

const comparison = [
  {
    feature: 'Precio por usuario',
    competencia: '$100,000+ COP',
    clivaro: 'Desde $15,980 COP',
    winner: 'clivaro',
  },
  {
    feature: 'Editor visual de campañas',
    competencia: 'No disponible',
    clivaro: 'Sí (tipo Canva)',
    winner: 'clivaro',
  },
  {
    feature: 'Adaptable a tu industria',
    competencia: 'Genérico',
    clivaro: 'Personalizable',
    winner: 'clivaro',
  },
  {
    feature: 'Soporte en español',
    competencia: 'Limitado',
    clivaro: 'Completo',
    winner: 'clivaro',
  },
  {
    feature: 'Interfaz moderna',
    competencia: 'Básica',
    clivaro: 'Avanzada',
    winner: 'clivaro',
  },
  {
    feature: 'Multi-almacén',
    competencia: 'Sí',
    clivaro: 'Sí',
    winner: 'tie',
  },
]

export function PricingClient() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [showContactForm, setShowContactForm] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(undefined)

  // Force system theme preference for Pricing Page
  useEffect(() => {
    // Save current state
    const wasDark = document.documentElement.classList.contains('dark')

    const applySystemTheme = () => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isSystemDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    // Apply initially
    applySystemTheme()

    // Listen for system changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applySystemTheme()
    mediaQuery.addEventListener('change', handler)

    // Cleanup: Restore previous state (approximate)
    return () => {
      mediaQuery.removeEventListener('change', handler)
      if (wasDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const handleContactClick = (): void => {
    setSelectedPlan(undefined)
    setShowContactForm(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-blue-50/30 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Scroll Navbar */}
      <ScrollNavbar onContactClick={handleContactClick} />

      {/* Hero Section */}
      <div className="pt-16">
        <HeroPreview
          onContactClick={() => {
            setSelectedPlan(undefined)
            setShowContactForm(true)
          }}
          onViewPreview={() => {
            const previewSection = document.getElementById('preview')
            if (previewSection) {
              previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
        />
      </div>

      {/* Billing Toggle */}
      <ScrollReveal>
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              Mensual
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                Anual
              </span>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Pricing Cards */}
      <ScrollReveal delay={100}>
        <div id="pricing" className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:gap-6 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              const displayPrice = billingCycle === 'annual'
                ? Math.round(plan.price * 12)
                : plan.price

              return (
                <ScrollReveal key={plan.name} delay={index * 100} className="h-full w-full">
                  <div className="relative h-full group">
                    {/* Glow effect for popular plan */}
                    {plan.popular && (
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500 group-hover:duration-200 animate-pulse"></div>
                    )}

                    <SpotlightCard
                      spotlightColor={plan.popular ? 'rgba(14, 165, 233, 0.3)' : 'rgba(99, 102, 241, 0.15)'}
                      className={`relative flex flex-col h-full backdrop-blur-sm transition-all duration-500 ${plan.popular
                        ? 'bg-gradient-to-br from-white/95 via-blue-50/90 to-white/95 dark:from-slate-900/95 dark:via-blue-950/40 dark:to-slate-900/95 border-2 border-blue-400/50 dark:border-blue-500/50 shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/40 scale-105 lg:scale-110 hover:scale-110 lg:hover:scale-115 z-20'
                        : 'bg-white/80 dark:bg-slate-900/80 border border-gray-200/80 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-2xl hover:shadow-indigo-500/10 hover:scale-105 z-10'
                        }`}
                    >
                      {/* Badge */}
                      {plan.badge && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
                          <Badge className={`px-6 py-1.5 text-sm font-bold shadow-2xl backdrop-blur-sm ${plan.popular
                            ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 text-white animate-pulse border-2 border-white/50'
                            : plan.name === 'Business'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-2 border-white/30'
                              : 'bg-gradient-to-r from-orange-600 to-red-600 text-white border-2 border-white/30'
                            }`}>
                            ✨ {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="pb-8 pt-8 flex flex-col items-center text-center">
                        {/* Icon with enhanced gradient */}
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.color} mb-6 shadow-lg relative overflow-hidden group-hover:scale-110 transition-transform duration-300`}>
                          <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors"></div>
                          <Icon className="h-8 w-8 text-white relative z-10" />
                        </div>

                        {/* Plan name with enhanced typography */}
                        <CardTitle className="text-3xl font-bold bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                          {plan.name}
                        </CardTitle>

                        <CardDescription className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
                          {plan.description}
                        </CardDescription>

                        {/* Price section with enhanced styling */}
                        <div className="mt-10 relative w-full flex flex-col items-center">
                          <div className="flex items-baseline justify-center gap-2">
                            <span className={`text-5xl lg:text-6xl font-black tracking-tight bg-gradient-to-br ${plan.color} bg-clip-text text-transparent`}>
                              {formatPrice(displayPrice)}
                            </span>
                            <span className="text-base font-semibold text-gray-500 dark:text-gray-400">
                              {billingCycle === 'annual' ? '/año' : '/mes'}
                            </span>
                          </div>
                          {billingCycle === 'annual' && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 font-medium">
                              💳 Facturado anualmente
                            </p>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pt-0">
                        {/* CTA Button with enhanced design */}
                        <Button
                          className={`w-full mb-10 font-bold text-lg py-7 rounded-xl shadow-xl transition-all duration-300 relative overflow-hidden group/btn ${plan.popular
                            ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-700 hover:via-cyan-600 hover:to-blue-700 text-white shadow-blue-500/40 hover:shadow-blue-500/60 hover:shadow-2xl hover:-translate-y-1 border-2 border-white/20'
                            : 'bg-gradient-to-br from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white dark:from-slate-800 dark:to-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-600 shadow-slate-500/20 hover:shadow-slate-500/40 hover:-translate-y-1'
                            }`}
                          onClick={() => {
                            setSelectedPlan(plan.name)
                            setShowContactForm(true)
                          }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {plan.cta}
                            <Sparkles className="h-5 w-5" />
                          </span>
                          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                        </Button>

                        {/* Features list with enhanced spacing */}
                        <div className="space-y-5 flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`h-1 flex-1 rounded-full bg-gradient-to-r ${plan.color}`}></div>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                              Incluye
                            </p>
                            <div className={`h-1 flex-1 rounded-full bg-gradient-to-l ${plan.color}`}></div>
                          </div>

                          <ul className="space-y-4">
                            {plan.features.map((feature, featureIndex) => (
                              <li key={featureIndex} className="flex items-start gap-3 group/item">
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center mt-0.5 shadow-md group-hover/item:scale-110 transition-transform`}>
                                  <Check className="h-4 w-4 text-white font-bold" />
                                </div>
                                <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 group-hover/item:text-gray-900 dark:group-hover/item:text-white transition-colors">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {plan.limitations.length > 0 && (
                            <>
                              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-6" />
                              <ul className="space-y-3">
                                {plan.limitations.map((limitation, i) => (
                                  <li key={i} className="flex items-start gap-3 opacity-40">
                                    <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-gray-500 line-through">{limitation}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </SpotlightCard>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </ScrollReveal>

      {/* Comparison Table */}
      <ScrollReveal delay={100}>
        <div id="comparison" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 text-sm font-bold shadow-xl">
              ⚡ Comparación
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Clivaro vs Otras Soluciones
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Descubre por qué miles de negocios eligen Clivaro para gestionar sus operaciones
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl opacity-20 blur-xl"></div>
            <SpotlightCard className="relative border-2 border-gray-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm" spotlightColor="rgba(59, 130, 246, 0.15)">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                        <th className="text-left p-6 font-bold text-lg">Característica</th>
                        <th className="text-center p-6 font-bold text-lg text-gray-600 dark:text-gray-400">Otras Soluciones</th>
                        <th className="text-center p-6 font-bold text-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-t-xl">
                          ✨ Clivaro Business
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-300 group">
                          <td className="p-6 font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.feature}
                          </td>
                          <td className="p-6 text-center text-gray-600 dark:text-gray-400">
                            {item.competencia}
                          </td>
                          <td className="p-6 text-center bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-blue-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-950/30">
                            <div className="flex items-center justify-center gap-3">
                              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                {item.clivaro}
                              </span>
                              {item.winner === 'clivaro' && (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                                  <Check className="h-4 w-4 text-white font-bold" />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </SpotlightCard>
          </div>
        </div>
      </ScrollReveal>

      {/* Software Preview */}
      <ScrollReveal delay={100}>
        <div id="preview" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <SoftwarePreview />
        </div>
      </ScrollReveal>

      {/* Features Carousel */}
      <ScrollReveal delay={100}>
        <div id="features" className="mx-auto max-w-full px-6 py-20 lg:px-8 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-center mb-16 mx-auto max-w-3xl">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Hemos integrado las herramientas más potentes del mercado en una sola plataforma intuitiva,
              diseñada para escalar con tu negocio.
            </p>
          </div>

          <div className="relative">
            {/* Gradient Overlays for smooth fade */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50/50 dark:from-gray-900/50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50/50 dark:from-gray-900/50 to-transparent z-10 pointer-events-none"></div>

            <InfiniteMovingCards items={features} direction="left" speed="normal" className="mx-auto" />
          </div>
        </div>
      </ScrollReveal>

      {/* Use Cases Section / Business Types */}
      <ScrollReveal delay={100}>
        <div id="use-cases">
          <BusinessTypes />
        </div>
      </ScrollReveal>

      {/* Testimonials Section */}
      <ScrollReveal delay={100}>
        <div id="testimonials">
          <Testimonials />
        </div>
      </ScrollReveal>

      {/* FAQ Section */}
      <ScrollReveal delay={100}>
        <div id="faq" className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Preguntas Frecuentes</h2>
          </div>
          <div className="space-y-6">
            <SpotlightCard className="text-left" spotlightColor="rgba(59, 130, 246, 0.05)">
              <CardHeader>
                <CardTitle className="text-lg">¿Hay período de prueba?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Contáctanos para conocer nuestras opciones de implementación y planes personalizados
                  adaptados a las necesidades de tu negocio.
                </p>
              </CardContent>
            </SpotlightCard>
            <SpotlightCard className="text-left" spotlightColor="rgba(59, 130, 246, 0.05)">
              <CardHeader>
                <CardTitle className="text-lg">¿Puedo cambiar de plan después?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Sí, puedes actualizar o degradar tu plan en cualquier momento.
                  Los cambios se aplican de forma prorrateada.
                </p>
              </CardContent>
            </SpotlightCard>
            <SpotlightCard className="text-left" spotlightColor="rgba(59, 130, 246, 0.05)">
              <CardHeader>
                <CardTitle className="text-lg">¿Qué incluye el soporte?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Todos los planes incluyen soporte por email. Los planes Business y Enterprise
                  incluyen soporte prioritario y 24/7 respectivamente.
                </p>
              </CardContent>
            </SpotlightCard>
            <SpotlightCard className="text-left" spotlightColor="rgba(59, 130, 246, 0.05)">
              <CardHeader>
                <CardTitle className="text-lg">¿Hay costos ocultos?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  No. El precio que ves es el precio que pagas. Incluye hosting, actualizaciones,
                  soporte y todas las funcionalidades del plan.
                </p>
              </CardContent>
            </SpotlightCard>
          </div>
        </div>
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal delay={100}>
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="relative">
            {/* Animated gradient background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl opacity-75 blur-2xl animate-pulse"></div>

            <Card className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white border-0 overflow-hidden">
              {/* Glassmorphism overlay */}
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>

              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-32 -mb-32"></div>

              <CardContent className="relative p-12 lg:p-16 text-center">
                <div className="max-w-3xl mx-auto">
                  <Rocket className="w-16 h-16 mx-auto mb-6 text-white/90" />
                  <h2 className="text-4xl lg:text-5xl font-black mb-6 text-white drop-shadow-lg">
                    ¿Listo para transformar tu negocio?
                  </h2>
                  <p className="text-blue-100 mb-10 text-xl leading-relaxed font-medium">
                    Únete a miles de negocios que ya están creciendo con Clivaro y descubre todo lo que podemos hacer por ti
                  </p>
                  <div className="flex items-center justify-center gap-6 flex-wrap">
                    <Button
                      size="lg"
                      className="bg-white text-blue-600 hover:bg-blue-50 text-xl px-12 py-8 font-bold shadow-2xl shadow-blue-900/50 hover:shadow-blue-900/70 transition-all duration-300 hover:scale-110 rounded-2xl group/cta relative overflow-hidden"
                      onClick={() => {
                        setSelectedPlan(undefined)
                        setShowContactForm(true)
                      }}
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        Comenzar Ahora
                        <Sparkles className="h-6 w-6 group-hover/cta:rotate-12 transition-transform" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 translate-y-full group-hover/cta:translate-y-0 transition-transform duration-300"></div>
                    </Button>
                  </div>
                  <p className="mt-8 text-sm text-blue-200 font-medium">
                    ✓ Sin compromiso · ✓ Configuración rápida · ✓ Soporte en español
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollReveal>

      {/* Contact Form Modal */}
      <ContactForm
        open={showContactForm}
        onOpenChange={setShowContactForm}
        planName={selectedPlan}
      />
    </div>
  )
}
