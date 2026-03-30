'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WelcomeOnboarding } from '@/components/onboarding/welcome-onboarding'
import { 
  Users, 
  Receipt, 
  CreditCard, 
  Settings as SettingsIcon, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Mail,
  Building2,
  MapPin,
  Hash,
  Printer,
  Wallet,
  Percent,
  ShieldCheck,
  Warehouse,
  Database,
  UtensilsCrossed,
  Globe,
  ChevronRight,
  LayoutDashboard,
  ArrowLeftRight,
  Play,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UsersConfig } from './users-config'
import { SubscriptionCheckout } from './subscription-checkout'
import { GeneralConfig } from './general-config'
import { DataConfig } from './data-config'
import { ElectronicBillingConfig } from './electronic-billing-config'
import { PaymentMethodsConfig } from './payment-methods-config'
import { TaxesPage } from './taxes-page'
import { PrivacyConfig } from './privacy-config'
import { EmailConfigTab } from './email-config-tab'
import { RestaurantSettingsView } from './restaurant-settings-view'
import { UnitConversionsConfig } from './unit-conversions-config'
import { WhatsAppSettings } from '../crm/whatsapp-settings'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export function SettingsScreen() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [activeSection, setActiveSection] = useState('identity')
  const [showDemoOnboarding, setShowDemoOnboarding] = useState(false)

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

  const processedPaymentRef = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wompiRef = params.get('wompiRef')

    if (wompiRef) {
      setActiveSection('subscription')
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
    } else if (searchParams.get('tab')) {
      setActiveSection(searchParams.get('tab') || 'identity')
    }
  }, [searchParams, queryClient])

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  })

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update settings')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast('Configuración actualizada exitosamente', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'No se pudo actualizar la configuración', 'error')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2 font-bold">
              <AlertCircle size={20} /> Error de Carga
            </CardTitle>
            <CardDescription className="text-red-600">
              No se pudieron cargar las configuraciones. Por favor, intenta de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const settings = data?.settings || null

  const navigationGroups = [
    {
      title: 'Empresa',
      items: [
        { id: 'identity', label: 'Identidad', icon: Building2, desc: 'Logo y datos fiscales' },
        { id: 'localization', label: 'Regional', icon: Globe, desc: 'Moneda y zona horaria' },
        { id: 'email', label: 'Email Corporativo', icon: Mail, desc: 'Notificaciones y envíos' },
      ]
    },
    {
      title: 'Operaciones',
      items: [
        { id: 'numbering', label: 'Folios y Prefijos', icon: Hash, desc: 'Control de documentos' },
        { id: 'printing', label: 'Impresión POS', icon: Printer, desc: 'Tickets y estaciones' },
        { id: 'restaurant', label: 'Restaurante', icon: UtensilsCrossed, desc: 'Zonas, mesas y cocina' },
        { id: 'billing', label: 'Facturación Elect.', icon: Receipt, desc: 'Integración Factus' },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Conexión y mensajería' },
      ]
    },
    {
      title: 'Finanzas e Inventario',
      items: [
        { id: 'payments-methods', label: 'Métodos de Pago', icon: Wallet, desc: 'Cajas y formas de cobro' },
        { id: 'taxes', label: 'Impuestos', icon: Percent, desc: 'IVA y retenciones' },
        { id: 'warehouses', label: 'Almacenes', icon: Warehouse, desc: 'Puntos físicos de stock' },
        { id: 'unit-conversions', label: 'Unidades de Medida', icon: ArrowLeftRight, desc: 'Conversiones para venta fraccionada' },
      ]
    },
    {
      title: 'Suscripción y Cuenta',
      items: [
        { id: 'subscription', label: 'Plan y Pagos', icon: CreditCard, desc: 'Estado de tu cuenta' },
        { id: 'users', label: 'Accesos y Roles', icon: Users, desc: 'Equipo y permisos' },
        { id: 'privacy', label: 'Privacidad', icon: ShieldCheck, desc: 'Seguridad y datos' },
        { id: 'data', label: 'Backups', icon: Database, desc: 'Historial y exportación' },
      ]
    }
  ]

  if (isSuperAdmin) {
    navigationGroups.push({
      title: 'Administración Global',
      items: [
        { id: 'payments', label: 'Pasarela de Pagos', icon: CreditCard, desc: 'Configuración Wompi' }
      ]
    })
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'identity':
      case 'localization':
      case 'numbering':
      case 'printing':
      case 'warehouses':
        return (
          <GeneralConfig 
            settings={settings} 
            onSave={(data) => updateSettingsMutation.mutate(data)} 
            isLoading={updateSettingsMutation.isPending}
            initialTab={activeSection}
          />
        )
      
      case 'restaurant':
        return <RestaurantSettingsView />

      case 'users': return <UsersConfig />
      case 'email': return <EmailConfigTab />
      case 'billing': return (
        <ElectronicBillingConfig
          settings={settings}
          onSave={(data) => updateSettingsMutation.mutate(data)}
          isLoading={updateSettingsMutation.isPending}
        />
      )
      case 'payments': return (
        <Card className="border-blue-200 bg-blue-50/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-blue-700">Mercado Pago - Administración</CardTitle>
            <CardDescription>Credenciales globales del sistema Clivaro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 bg-white/50 border rounded-xl flex items-center justify-between">
                <span className="font-medium">Estado de Conexión</span>
                <span className="text-green-600 font-bold flex items-center gap-1">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   Activa
                </span>
             </div>
          </CardContent>
        </Card>
      )
      case 'subscription': return <SubscriptionCheckout />
      case 'payments-methods': return <PaymentMethodsConfig />
      case 'taxes': return <TaxesPage />
      case 'unit-conversions': return <UnitConversionsConfig />
      case 'whatsapp': return <WhatsAppSettings />
      case 'data': return <DataConfig settings={settings} onSave={(data) => updateSettingsMutation.mutate(data)} isLoading={updateSettingsMutation.isPending} />
      case 'privacy': return <PrivacyConfig />
      default: return null
    }
  }

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
      {/* Header Premium con Glassmorphism */}
      <header className="h-20 border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Centro de Control • {session?.user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl font-bold text-xs px-5 border-orange-200 text-orange-600 hover:bg-orange-50 transition-all" onClick={() => setShowDemoOnboarding(true)}>
             <Play size={14} className="mr-1.5" />
             Onboarding Demo
          </Button>
          <Button variant="outline" className="rounded-xl font-bold text-xs px-6 border-slate-200 hover:bg-slate-50 transition-all" onClick={() => router.push('/dashboard')}>
             <LayoutDashboard size={14} className="mr-2" />
             Ir al Dashboard
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-80px)]">
        {/* Sidebar Lateral Premium */}
        <aside className="w-80 h-full border-r bg-white overflow-y-auto py-8 px-4 flex flex-col gap-8 scrollbar-hide">
          {navigationGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="px-4 text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] mb-2 leading-none">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 relative",
                      activeSection === item.id 
                        ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-all duration-300",
                      activeSection === item.id 
                        ? "bg-white/10 text-white scale-110" 
                        : "bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-primary"
                    )}>
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-bold leading-tight tracking-tight">{item.label}</span>
                      <span className={cn(
                        "text-[10px] font-medium leading-none transition-colors",
                        activeSection === item.id ? "text-slate-400" : "text-slate-400"
                      )}>{item.desc}</span>
                    </div>
                    {activeSection === item.id && (
                      <motion.div 
                        layoutId="active-indicator" 
                        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Content Area con Scroll Suave */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative p-8 lg:p-12 scroll-smooth">
          <div className="max-w-4xl mx-auto pb-20">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Nav Móvil Refactorizado */}
      <nav className="md:hidden h-16 border-t bg-white flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
         {navigationGroups.flatMap(g => g.items).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all",
                activeSection === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              <item.icon size={14} />
              {item.label}
            </button>
         ))}
      </nav>
    </div>

    {/* Demo Onboarding Overlay */}
    {showDemoOnboarding && (
      <WelcomeOnboarding
        isDemo
        onComplete={() => setShowDemoOnboarding(false)}
      />
    )}
    </>
  )
}
