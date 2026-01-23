import { SpotlightCard } from '@/components/ui/spotlight-card'

// ... (keep existing imports)

// Inside PricingClient function:
return (
  <ScrollReveal key={plan.name} delay={index * 100} className="h-full w-full">
    <SpotlightCard
      spotlightColor={plan.popular ? 'rgba(14, 165, 233, 0.25)' : undefined}
      className={`flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${plan.popular
        ? 'border-2 border-blue-500 shadow-xl z-10'
        : 'border border-gray-200 dark:border-gray-800'
        }`}
    >
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
                        // ... rest of price calculation
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
                    // ... content (Buttons, features lists)
      </CardContent>
    </SpotlightCard>
  </ScrollReveal>
)
import { Badge } from '@/components/ui/badge'
import { Check, X, Zap, Building2, Rocket, TrendingUp, Users, Package, ShoppingCart, BarChart3, Mail, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ContactForm } from './contact-form'
import { ScrollNavbar } from './scroll-navbar'
import { ScrollReveal } from './scroll-reveal'
import { SoftwarePreview } from './software-preview'
import { HeroPreview } from './hero-preview'

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
  { name: 'Gestión de Productos', icon: Package },
  { name: 'Control de Inventario', icon: BarChart3 },
  { name: 'Punto de Venta (POS)', icon: ShoppingCart },
  { name: 'CRM Completo', icon: Users },
  { name: 'Marketing Campaigns', icon: Mail },
  { name: 'Reportes Avanzados', icon: TrendingUp },
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

      {/* Offer Banner Removed as requested */}

      {/* Comparison Table */}
      <ScrollReveal delay={100}>
        <div id="comparison" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Clivaro vs Otras Soluciones</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Compara y descubre por qué Clivaro es la mejor opción para tu negocio
            </p>
          </div>
          <Card>
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
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-4 font-medium">{item.feature}</td>
                        <td className="p-4 text-center text-gray-600 dark:text-gray-400">
                          {item.competencia}
                        </td>
                        <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/20">
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
          </Card>
        </div>
      </ScrollReveal>

      {/* Software Preview */}
      <ScrollReveal delay={100}>
        <div id="preview" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <SoftwarePreview />
        </div>
      </ScrollReveal>

      {/* Features Grid */}
      <ScrollReveal delay={100}>
        <div id="features" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Todo lo que Necesitas en un Solo Lugar</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Módulos integrados diseñados para cualquier tipo de negocio
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.name}
                  className="flex flex-col items-center p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-center">{feature.name}</p>
                </div>
              )
            })}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Hay período de prueba?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Contáctanos para conocer nuestras opciones de implementación y planes personalizados
                  adaptados a las necesidades de tu negocio.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Puedo cambiar de plan después?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Sí, puedes actualizar o degradar tu plan en cualquier momento.
                  Los cambios se aplican de forma prorrateada.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Qué incluye el soporte?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Todos los planes incluyen soporte por email. Los planes Business y Enterprise
                  incluyen soporte prioritario y 24/7 respectivamente.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Hay costos ocultos?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  No. El precio que ves es el precio que pagas. Incluye hosting, actualizaciones,
                  soporte y todas las funcionalidades del plan.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal delay={100}>
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">¿Listo para Transformar tu Negocio?</h2>
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

