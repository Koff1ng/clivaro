'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WelcomeOnboarding } from '@/components/onboarding/welcome-onboarding'
import { ProductTour, resetTour } from '@/components/tutorial/product-tour'
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
  Globe,
  ChevronRight,
  LayoutDashboard,
  ArrowLeftRight,
  Play,
  MessageCircle,
  GraduationCap,
  Construction,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UsersConfig } from './users-config'
import { SubscriptionConfig } from './subscription-config'
import { GeneralConfig } from './general-config'
import { DataConfig } from './data-config'
import { ElectronicBillingConfig } from './electronic-billing-config'
import { PaymentMethodsConfig } from './payment-methods-config'
import { TaxesPage } from './taxes-page'
import { PrivacyConfig } from './privacy-config'
import { EmailConfigTab } from './email-config-tab'
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
  const [showTutorial, setShowTutorial] = useState(false)

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
        { id: 'billing', label: 'Facturación Elect.', icon: Receipt, desc: 'Integración Factus' },
        { id: 'whatsapp', label: 'WhatsApp / Meta Ads', icon: MessageCircle, desc: 'Conexión y mensajería', dev: true },
      ]
    },
    {
      title: 'Finanzas e Inventario',
      items: [
        { id: 'payments-methods', label: 'Métodos de Pago', icon: Wallet, desc: 'Cajas y formas de cobro' },
        { id: 'taxes', label: 'Impuestos', icon: Percent, desc: 'IVA y retenciones' },
        { id: 'warehouses', label: 'Almacenes', icon: Warehouse, desc: 'Puntos físicos de stock' },
        { id: 'unit-conversions', label: 'Unidades de Medida', icon: ArrowLeftRight, desc: 'Conversiones para venta fraccionada', dev: true },
      ]
    },
    {
      title: 'Suscripción y Cuenta',
      items: [
        { id: 'subscription', label: 'Plan y Pagos', icon: CreditCard, desc: 'Estado de tu cuenta' },
        { id: 'users', label: 'Accesos y Roles', icon: Users, desc: 'Equipo y permisos' },
        { id: 'privacy', label: 'Privacidad', icon: ShieldCheck, desc: 'Seguridad y datos' },
        { id: 'data', label: 'Backups', icon: Database, desc: 'Historial y exportación', dev: true },
      ]
    }
  ]

  const renderContent = () => {
    const renderDevBanner = (label: string) => (
      <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
        <Construction size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{label} — En Desarrollo</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Esta funcionalidad está en fase beta. Pueden presentarse comportamientos inesperados.</p>
        </div>
      </div>
    )

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
      
      case 'users': return <UsersConfig />
      case 'email': return <EmailConfigTab />
      case 'billing': return (
        <ElectronicBillingConfig
          settings={settings}
          onSave={(data) => updateSettingsMutation.mutate(data)}
          isLoading={updateSettingsMutation.isPending}
        />
      )
      case 'subscription': return <SubscriptionConfig settings={settings} onSave={(data) => updateSettingsMutation.mutate(data)} isLoading={updateSettingsMutation.isPending} />
      case 'payments-methods': return <PaymentMethodsConfig />
      case 'taxes': return <TaxesPage />
      case 'unit-conversions': return <>{renderDevBanner('Unidades de Medida')}<UnitConversionsConfig /></>
      case 'whatsapp': return <>{renderDevBanner('WhatsApp / Meta Ads')}<WhatsAppSettings /></>
      case 'data': return <>{renderDevBanner('Backups y Exportación')}<DataConfig settings={settings} onSave={(data) => updateSettingsMutation.mutate(data)} isLoading={updateSettingsMutation.isPending} /></>
      case 'privacy': return <PrivacyConfig />
      default: return null
    }
  }

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden bg-muted/50">
      {/* Header Premium con Glassmorphism */}
      <header className="h-14 sm:h-20 border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
            <SettingsIcon size={18} className="sm:size-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-black text-card-foreground tracking-tight">Configuración</h1>
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">Centro de Control • {session?.user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" className="rounded-xl font-bold text-[10px] sm:text-xs px-3 sm:px-5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all hidden sm:flex" onClick={() => { resetTour(); router.push('/dashboard'); setTimeout(() => setShowTutorial(true), 500) }}>
             <GraduationCap size={14} className="sm:mr-1.5" />
             <span className="hidden sm:inline">Ver Tutorial</span>
           </Button>
          <Button variant="outline" className="rounded-xl font-bold text-[10px] sm:text-xs px-3 sm:px-5 border-orange-200 text-orange-600 hover:bg-orange-50 transition-all hidden sm:flex" onClick={() => setShowDemoOnboarding(true)}>
             <Play size={14} className="sm:mr-1.5" />
             <span className="hidden sm:inline">Onboarding</span>
           </Button>
          <Button variant="outline" size="icon" className="rounded-xl border-border hover:bg-accent transition-all sm:hidden" onClick={() => router.push('/dashboard')}>
             <LayoutDashboard size={18} />
           </Button>
          <Button variant="outline" className="rounded-xl font-bold text-xs px-4 sm:px-6 border-border hover:bg-accent transition-all hidden sm:flex" onClick={() => router.push('/dashboard')}>
             <LayoutDashboard size={14} className="mr-2" />
             Ir al Dashboard
           </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)] sm:h-[calc(100vh-80px)]">
        {/* Sidebar Lateral Premium — oculto en mobile */}
        <aside className="hidden md:flex md:w-80 h-full border-r bg-card overflow-y-auto py-8 px-4 flex-col gap-8">
          {navigationGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="px-4 text-[11px] font-black uppercase text-muted-foreground tracking-[0.15em] mb-2 leading-none">
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
                        ? "bg-slate-900 text-white shadow-xl" 
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-all duration-300",
                      activeSection === item.id 
                        ? "bg-white/10 text-white scale-110" 
                        : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-primary"
                    )}>
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-bold leading-tight tracking-tight flex items-center gap-2">
                        {item.label}
                        {(item as any).dev && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 tracking-widest">DEV</span>
                        )}
                      </span>
                      <span className={cn(
                        "text-[10px] font-medium leading-none transition-colors",
                        activeSection === item.id ? "text-muted-foreground" : "text-muted-foreground"
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
        <main className="flex-1 overflow-y-auto bg-muted/50 relative p-4 sm:p-6 lg:p-12 scroll-smooth">
          <div className="max-w-4xl mx-auto pb-24">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Nav Móvil Refactorizado */}
      <nav className="md:hidden h-16 border-t bg-card flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
         {navigationGroups.flatMap(g => g.items).map(item => (
             <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all relative",
                activeSection === item.id ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              <item.icon size={14} />
              {item.label}
              {(item as any).dev && (
                <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 tracking-widest">DEV</span>
              )}
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

    {/* Product Tour (re-launched from settings) */}
    {showTutorial && (
      <ProductTour
        forceShow
        onComplete={() => setShowTutorial(false)}
      />
    )}
    </>
  )
}
