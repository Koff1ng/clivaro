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
        <div id="pricing" className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              const displayPrice = billingCycle === 'annual'
                ? Math.round(plan.price * 12) // No annual discount for now to keep it premium/simple or add back if needed
                : plan.price

              return (
                <ScrollReveal key={plan.name} delay={index * 100} className="h-full w-full">
                  <SpotlightCard
                    spotlightColor={plan.popular ? 'rgba(14, 165, 233, 0.25)' : undefined}
                    className={`flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${plan.popular
                      ? 'border-2 border-blue-500 shadow-xl z-10'
                      : 'border border-gray-200 dark:border-gray-800'
                      }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                        <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-1 text-sm font-medium shadow-lg">
                          {plan.badge}
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${plan.color} mb-6 shadow-inner`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                      <CardDescription className="mt-2 text-base">{plan.description}</CardDescription>
                      <div className="mt-8">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl lg:text-5xl font-extrabold tracking-tight">
                            {formatPrice(displayPrice)}
                          </span>
                          {billingCycle === 'annual' ? (
                            <span className="text-sm font-medium text-gray-500">/año</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-500">/mes</span>
                          )}
                        </div>
                        {billingCycle === 'annual' && (
                          <p className="text-sm text-gray-500 mt-2 font-medium">
                            Facturado anualmente
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <Button
                        className={`w-full mb-8 font-semibold text-lg py-6 shadow-lg transition-all duration-300 ${plan.popular
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30 hover:shadow-blue-500/50'
                          : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                          }`}
                        onClick={() => {
                          setSelectedPlan(plan.name)
                          setShowContactForm(true)
                        }}
                      >
                        {plan.cta}
                      </Button>
                      <div className="space-y-4 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                          Incluye:
                        </p>
                        <ul className="space-y-3">
                          {plan.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {plan.limitations.length > 0 && (
                          <>
                            <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />
                            <ul className="space-y-3">
                              {plan.limitations.map((limitation, i) => (
                                <li key={i} className="flex items-start gap-3 opacity-50">
                                  <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                  <span className="text-sm text-gray-500">{limitation}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </SpotlightCard>
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </ScrollReveal>

      {/* Comparison Table */}
      <ScrollReveal delay={100}>
        <div id="comparison" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Clivaro vs Otras Soluciones</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Compara y descubre por qué Clivaro es la mejor opción para tu negocio
            </p>
          </div>
          <SpotlightCard className="border-slate-200 dark:border-slate-800" spotlightColor="rgba(59, 130, 246, 0.1)">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Característica</th>
                      <th className="text-center p-4 font-semibold">Otras Soluciones</th>
                      <th className="text-center p-4 font-semibold bg-blue-50 dark:bg-blue-900/20">
                        Clivaro Business
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="p-4 font-medium">{item.feature}</td>
                        <td className="p-4 text-center text-gray-600 dark:text-gray-400">
                          {item.competencia}
                        </td>
                        <td className="p-4 text-center bg-blue-50/50 dark:bg-blue-900/10">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {item.clivaro}
                            </span>
                            {item.winner === 'clivaro' && (
                              <Check className="h-5 w-5 text-green-500" />
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

      {/* Use Cases Section */}
      <ScrollReveal delay={100}>
        <div id="use-cases" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Adaptable a tu tipo de negocio</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Clivaro está diseñado para simplificar la gestión en múltiples industrias
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon
              return (
                <SpotlightCard key={index} className="h-full hover:border-blue-500/50 transition-colors" spotlightColor="rgba(59, 130, 246, 0.1)">
                  <CardContent className="flex flex-col items-start p-6">
                    <div className={`p-3 rounded-lg mb-4 ${useCase.bg}`}>
                      <Icon className={`h-6 w-6 ${useCase.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{useCase.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-left">
                      {useCase.description}
                    </p>
                  </CardContent>
                </SpotlightCard>
              )
            })}
          </div>
        </div>
      </ScrollReveal>

      {/* Testimonials Section */}
      <ScrollReveal delay={100}>
        <div id="testimonials" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center p-8 lg:p-16">
              <div className="space-y-8">
                <Quote className="h-12 w-12 text-teal-400 opacity-50" />
                <h3 className="text-2xl lg:text-3xl font-medium text-white leading-relaxed">
                  "Alegra con respecto al precio, calidad y servicio, es excelente. Una de las cosas que más me gusta es la rapidez para facturar. Con el POS puedo agilizar mis ventas y analizar qué producto se vende más en cada tienda. Configurar mis productos fue increíblemente rápido y amigable."
                </h3>
                <div>
                  <div className="font-bold text-white text-lg">Isabel Uribe Correa</div>
                  <div className="text-teal-400">CEO</div>
                  <div className="mt-2 text-slate-400 font-serif italic text-xl">milamores</div>
                </div>
              </div>
              <div className="relative h-full min-h-[300px] lg:min-h-[400px] rounded-2xl overflow-hidden bg-slate-800/50">
                {/* Placeholder for testimonial image - using a generic professional gradient for now until image provided */}
                <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-blue-500/20 flex items-center justify-center">
                  <Users className="h-24 w-24 text-white/20" />
                </div>
                {/* Note: In a real app we'd use <Image src="..." /> here */}
              </div>
            </div>
          </div>
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
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">¿Listo para transformar tu negocio?</h2>
              <p className="text-blue-100 mb-8 text-lg">
                Únete a los negocios que ya están creciendo con Clivaro
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 font-semibold shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300"
                  onClick={() => {
                    setSelectedPlan(undefined)
                    setShowContactForm(true)
                  }}
                >
                  Comenzar Ahora
                </Button>
              </div>
            </CardContent>
          </Card>
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
