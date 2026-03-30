'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, X, Zap, Building2, Rocket, TrendingUp as TrendingUpIcon, Users, Package, ShoppingCart, BarChart3, Mail, Sparkles, Database, Smartphone, Cloud, Lock, Globe, Headphones, Settings, Printer, Wallet, Truck, FileText, LayoutDashboard, MessageSquare, Calendar, Bell, Search, Shirt, Store, Wine, Hammer, Croissant, Car, BookOpen, Pill, Quote, ShieldCheck, UserSquare, TrendingUp, HelpCircle, MessageCircle, ArrowRight, UserSquare as UserSquareIcon } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ContactForm } from './contact-form'
import { ScrollNavbar } from './scroll-navbar'
import { ScrollReveal } from './scroll-reveal'
import { SoftwarePreview } from './software-preview'
import { HeroPreview } from './hero-preview'
import { SpotlightCard } from '@/components/ui/spotlight-card'




const plans = [
  {
    name: 'Starter',
    price: 79900,
    originalPrice: 159900,
    description: 'Esencial para pequeños negocios y emprendedores',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Más Popular',
    features: [
      'Hasta 3 usuarios incluidos',
      'Gestión de productos ilimitados',
      'Punto de Venta (POS)',
      'Facturación electrónica DIAN (50/mes)',
      'Control de inventario (1 bodega)',
      'Gestión de clientes y proveedores',
      'Cotizaciones',
      'Control de caja y turnos',
      'Dashboard con KPIs',
      'Reportes básicos de ventas',
      'Soporte por Email',
    ],
    cta: 'Comenzar Ahora',
    popular: true,
  },
  {
    name: 'Business',
    price: 149900,
    originalPrice: 299900,
    description: 'La solución completa para empresas en crecimiento',
    icon: Building2,
    color: 'from-indigo-500 to-purple-500',
    badge: 'Mejor Valor',
    features: [
      'Hasta 8 usuarios incluidos',
      'Todo lo del plan Starter',
      'Facturación electrónica DIAN ilimitada',
      'Multi-bodega (hasta 3 bodegas)',
      'CRM completo (Leads y Actividades)',
      'Campañas de Marketing (editor visual)',
      'Gestión de Compras y Recepciones',
      'Cotizaciones avanzadas',
      'Reportes avanzados y analytics',
      'Soporte Prioritario',
    ],
    cta: 'Seleccionar Business',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 249900,
    originalPrice: 499900,
    description: 'Escalabilidad total para grandes operaciones',
    icon: Rocket,
    color: 'from-orange-500 to-red-500',
    badge: 'Máxima Potencia',
    features: [
      'Usuarios ilimitados',
      'Todo lo del plan Business',
      'Bodegas ilimitadas',
      'Contabilidad completa (PUC, Asientos, Balance)',
      'Nómina y Recursos Humanos',
      'Módulo de Restaurante (Mesas, Pedidos)',
      'Reportes personalizados',
      'Migración de datos asistida',
      'Soporte Dedicado 24/7',
    ],
    cta: 'Hablar con Ventas',
    popular: false,
  },
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
    clivaro: 'Desde $26,633 COP',
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

  // Force light mode for the landing page
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')

    return () => {
      if (wasDark) {
        document.documentElement.classList.add('dark')
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-blue-50/30 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Scroll Navbar */}
      <ScrollNavbar onContactClick={handleContactClick} />

      {/* Hero Section */}
      <div className="pt-20">
        <HeroPreview
          onContactClick={() => {
            setSelectedPlan(undefined)
            setShowContactForm(true)
          }}
          onViewPreview={() => {
            const previewSection = document.getElementById('pricing')
            if (previewSection) {
              previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
        />

        {/* Trust Badges */}
        <div className="bg-white/50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800 py-6">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-10 md:gap-20">
              <div className="flex items-center gap-2 grayscale brightness-110 opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Certificado</p>
                  <p className="text-sm font-black text-slate-400">DIAN COLOMBIA</p>
                </div>
              </div>
              <div className="flex items-center gap-2 grayscale brightness-110 opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
                  <Lock className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Seguridad</p>
                  <p className="text-sm font-black text-slate-400">SSL 256-BIT</p>
                </div>
              </div>
              <div className="flex items-center gap-2 grayscale brightness-110 opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Acceso</p>
                  <p className="text-sm font-black text-slate-400">DISP. MÓVILES</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section with 3D Assets */}
      <ScrollReveal delay={100}>
        <div id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="text-center mb-16 mx-auto max-w-3xl">
            <Badge className="mb-4 bg-blue-100 text-blue-700 dark:bg-blue-900/30">Módulos</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Hemos integrado las herramientas más potentes del mercado en una sola plataforma intuitiva,
              diseñada para escalar con tu negocio.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: 'Punto de Venta', desc: 'POS ágil con control de caja, turnos y tickets personalizados.', img: '/assets/3d/landing-pos.png', icon: ShoppingCart },
              { name: 'Inventario', desc: 'Multi-bodega, scanner de barcode, alertas de stock mínimo.', img: '/assets/3d/landing-inventory.png', icon: Package },
              { name: 'Facturación DIAN', desc: 'Facturación electrónica certificada, notas crédito y documentos soporte.', img: '/assets/3d/landing-billing.png', icon: FileText },
              { name: 'CRM & Marketing', desc: 'Pipeline de leads, campañas visuales y seguimiento de oportunidades.', img: '/assets/3d/landing-crm.png', icon: TrendingUpIcon },
              { name: 'Restaurante', desc: 'Gestión de mesas, pedidos a cocina y meseros en tiempo real.', img: '/assets/3d/landing-restaurant.png', icon: Store },
              { name: 'Reportes & Analytics', desc: 'Dashboards en vivo, KPIs, análisis de ventas y rentabilidad.', img: '/assets/3d/landing-analytics.png', icon: BarChart3 },
            ].map((feat, idx) => (
              <ScrollReveal key={idx} delay={idx * 80}>
                <div className="group relative bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={feat.img}
                      alt={feat.name}
                      className="w-16 h-16 object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{feat.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* How it Works Section */}
      <ScrollReveal delay={100}>
        <div id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
              Empieza en 3 simples pasos
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Implementar Clivaro es rápido y guiado. No necesitas ser un experto en tecnología.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Registro Rápido', desc: 'Crea tu cuenta en segundos y accede a tu panel personalizado.', icon: UserSquare },
              { step: '02', title: 'Carga de Datos', desc: 'Importa tus productos y clientes. Nosotros te ayudamos en el proceso.', icon: Database },
              { step: '03', title: 'Vende y Crece', desc: 'Empieza a facturar legalmente y a gestionar tu CRM con IA.', icon: TrendingUp },
            ].map((s, idx) => (
              <div key={idx} className="relative group text-center">
                <div className="mb-6 mx-auto w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 border border-blue-100 dark:border-blue-800 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6">
                  <s.icon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                <div className="absolute top-0 right-0 text-6xl font-black text-slate-900/5 dark:text-white/5 select-none -z-10">{s.step}</div>
              </div>
            ))}
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
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
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
                          <td className="p-6 text-center bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-blue-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-950/30 font-bold">
                            <div className="flex items-center justify-center gap-3">
                              <span className="text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                  {comparison.map((item, index) => (
                    <div key={index} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm">
                      <h4 className="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                        {item.feature}
                        {item.winner === 'clivaro' && (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </h4>
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Otros</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 text-right font-medium">{item.competencia}</p>
                        </div>
                        <div className="flex justify-between items-start pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-[10px] uppercase font-bold text-blue-500">Clivaro</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 text-right">{item.clivaro}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </SpotlightCard>
          </div>
        </div>
      </ScrollReveal>

      {/* Software Preview */}
      <ScrollReveal delay={100}>
        <div id="preview" className="mx-auto max-w-7xl px-6 py-16 lg:px-8 hidden md:block">
          <SoftwarePreview />
        </div>
      </ScrollReveal>

      {/* Billing Toggle */}
      <ScrollReveal>
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="text-center mb-4">
            <Badge className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 text-sm font-bold shadow-xl">
              💰 Planes
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Elige el plan perfecto para tu negocio</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Precios transparentes sin costos ocultos. Todos los planes incluyen soporte en español.
            </p>
          </div>
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
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              const displayPrice = billingCycle === 'annual'
                ? Math.round(plan.price * 12)
                : plan.price

              return (
                <ScrollReveal key={plan.name} delay={index * 100} className="h-full w-full">
                  <div className="relative h-full group">
                    {plan.popular && (
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500 group-hover:duration-200 animate-pulse"></div>
                    )}

                    <SpotlightCard
                      spotlightColor={plan.popular ? 'rgba(37, 99, 235, 0.1)' : 'rgba(148, 163, 184, 0.05)'}
                      className={`relative flex flex-col h-full bg-white dark:bg-slate-950 border transition-all duration-300 ${plan.popular
                        ? 'border-blue-500 dark:border-blue-400 shadow-2xl shadow-blue-500/10 z-20 ring-1 ring-blue-500/50'
                        : 'border-slate-200 dark:border-slate-800 shadow-sm z-10'
                        }`}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30">
                          <Badge className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border shadow-sm ${plan.popular
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800'
                            }`}>
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="pb-8 pt-10 flex flex-col items-center text-center">
                        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${plan.color} mb-6 shadow-sm`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                          {plan.name}
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm text-slate-500 dark:text-slate-400 h-10 flex items-center justify-center">
                          {plan.description}
                        </CardDescription>
                        <div className="mt-8 relative w-full flex flex-col items-center h-24 justify-center">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                              {formatPrice(displayPrice)}
                            </span>
                            <span className="text-sm font-medium text-slate-400">
                              {billingCycle === 'annual' ? '/año' : '/mes'}
                            </span>
                          </div>
                          {billingCycle === 'annual' && (
                            <div className="mt-2 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-tighter">
                                Facturado anual
                              </p>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pt-0">
                        <Button
                          className={`w-full mb-8 font-bold text-base py-6 rounded-xl transition-all duration-300 ${plan.popular
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                            }`}
                          onClick={() => {
                            setSelectedPlan(plan.name)
                            setShowContactForm(true)
                          }}
                        >
                          <span className="flex items-center justify-center gap-2">
                            {plan.cta}
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </Button>

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
                                <Check className={`h-5 w-5 ${plan.popular ? 'text-blue-500' : 'text-slate-400'} shrink-0 mt-0.5`} />
                                <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 group-hover/item:text-gray-900 dark:group-hover/item:text-white transition-colors">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
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

      {/* FAQ Section */}
      <ScrollReveal delay={100}>
        <div id="faq" className="mx-auto max-w-4xl px-6 py-24 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700 dark:bg-blue-900/30">FAQ</Badge>
            <h2 className="text-3xl font-bold mb-4">Preguntas Frecuentes</h2>
            <p className="text-slate-500">Todo lo que necesitas saber sobre Clivaro</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { q: "¿Cumplen con la DIAN para facturación electrónica?", a: "Sí, Clivaro está 100% certificado por la DIAN. Emitimos facturas electrónicas legales, notas crédito y documentos soporte de forma automática y segura." },
              { q: "¿Hay período de prueba gratuito?", a: "¡Claro! Ofrecemos 14 días de prueba con todas las funciones activas para que descubras el poder de la IA en tu negocio sin compromiso." },
              { q: "¿Es difícil de implementar?", a: "Para nada. Clivaro es intuitivo y nuestro soporte te acompaña en la carga inicial de datos para que estés vendiendo en menos de 24 horas." },
              { q: "¿Cómo protegen mis datos?", a: "Usamos encriptación SSL de 256 bits y backups automáticos diarios. Tus datos están alojados en centros de datos de clase mundial." },
              { q: "¿Puedo cambiar de plan después?", a: "Sí, puedes subir o bajar de nivel según tu negocio crezca. Ajustamos el precio de forma justa y prorrateada." },
              { q: "¿Brindan soporte en WhatsApp?", a: "Sí, tenemos un equipo dedicado en español listo para ayudarte por chat, email y WhatsApp directamente." }
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-snug">{f.q}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal delay={100}>
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl opacity-75 blur-2xl animate-pulse"></div>

            <Card className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white border-0 overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
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

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-12 px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-sm">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo size="sm" className="opacity-80 sepia brightness-200" />
            <p>© 2026 Clivaro by <a href="https://www.clientumstudio.com" target="_blank" className="hover:text-blue-500 transition-colors">Clientum Studio</a>. Cali, Colombia.</p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <Link href="/terminos-y-condiciones" className="text-slate-400 hover:text-blue-500 transition-colors font-medium">
              Términos y Condiciones
            </Link>
            <Link href="/politica-de-privacidad" className="text-slate-400 hover:text-blue-500 transition-colors font-medium">
              Política de Privacidad
            </Link>
            <a href="mailto:gerencia@clientumstudio.com" className="text-slate-400 hover:text-blue-500 transition-colors font-medium">
              Soporte
            </a>
          </nav>
        </div>
      </footer>

      <a
        href="https://wa.me/573113524794?text=Hola,%20quisiera%20recibir%20más%20información%20sobre%20Clivaro%20ERP/CRM"
        target="_blank"
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 group hover:animate-none flex items-center justify-center ring-4 ring-white/10"
        aria-label="Contactar por WhatsApp"
      >
        <div className="animate-[bounce_4s_infinite]">
          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-1.557-.594-2.618-1.542-.883-.79-1.474-1.745-1.645-2.036-.17-.291-.018-.448.127-.591.132-.132.29-.338.436-.508.145-.17.145-.258.219-.39.074-.132.037-.249-.018-.363-.056-.114-.505-1.221-.692-1.67-.183-.437-.367-.377-.502-.384-.131-.007-.282-.008-.432-.008-.15 0-.395.056-.601.282-.207.226-.79.771-.79 1.88s.805 2.181.917 2.331c.113.15 1.583 2.422 3.834 3.394.535.231.954.369 1.279.473.538.17 1.026.147 1.412.089.43-.064 1.326-.542 1.513-1.066.187-.524.187-.974.131-1.067-.056-.094-.207-.151-.452-.273zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.017 22.019c-1.807 0-3.56-.484-5.089-1.4l-.365-.217-3.779.991 1.008-3.682-.238-.379a9.787 9.787 0 01-1.524-5.308c.002-5.405 4.395-9.801 9.804-9.801 2.617 0 5.077 1.019 6.924 2.87s2.864 4.309 2.864 6.931c-.004 5.406-4.401 9.803-9.805 9.803z" />
          </svg>
        </div>
        <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          ¿Necesitas ayuda? Chatea con nosotros
        </span>
      </a>

      {/* Contact Form Modal */}
      <ContactForm
        open={showContactForm}
        onOpenChange={setShowContactForm}
        planName={selectedPlan}
      />
    </div>
  )
}
