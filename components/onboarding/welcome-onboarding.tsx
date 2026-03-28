'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowRight, ArrowLeft, Check, Building2, User, Lock, MapPin,
  Loader2, FileText, Coins
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'

interface WelcomeOnboardingProps {
  onComplete: () => void
  planName?: string | null
  isDemo?: boolean
}

/* ─── Typing Animation Hook ─── */
function useTypingAnimation(text: string, speed = 35, delay = 300) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let i = 0
    setDisplayed('')
    setIsDone(false)
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1))
          i++
        } else {
          setIsDone(true)
          clearInterval(interval)
        }
      }, speed)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timeout)
  }, [text, speed, delay])

  return { displayed, isDone }
}

/* ─── Custom Gradient SVG Icons ─── */
const IconShieldGradient = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shieldG" x1="4" y1="3" x2="20" y2="21"><stop stopColor="#14b8a6"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
    <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.25 4.6-1.1 8-6 8-11.25V6l-8-4z" fill="url(#shieldG)" opacity=".15"/>
    <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.25 4.6-1.1 8-6 8-11.25V6l-8-4z" stroke="url(#shieldG)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M9 12l2 2 4-4" stroke="url(#shieldG)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IconReceiptGradient = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="receiptG" x1="5" y1="2" x2="19" y2="22"><stop stopColor="#f97316"/><stop offset="1" stopColor="#f59e0b"/></linearGradient></defs>
    <rect x="5" y="2" width="14" height="20" rx="2" fill="url(#receiptG)" opacity=".12"/>
    <rect x="5" y="2" width="14" height="20" rx="2" stroke="url(#receiptG)" strokeWidth="1.5" fill="none"/>
    <path d="M9 7h6M9 11h4M9 15h5" stroke="url(#receiptG)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const IconLockGradient = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="lockG" x1="6" y1="4" x2="18" y2="20"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#a855f7"/></linearGradient></defs>
    <rect x="5" y="10" width="14" height="11" rx="2.5" fill="url(#lockG)" opacity=".12"/>
    <rect x="5" y="10" width="14" height="11" rx="2.5" stroke="url(#lockG)" strokeWidth="1.5" fill="none"/>
    <path d="M8 10V7a4 4 0 118 0v3" stroke="url(#lockG)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="15" r="1.5" fill="url(#lockG)"/>
  </svg>
)

const IconStoreGradient = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="storeG" x1="2" y1="3" x2="22" y2="21"><stop stopColor="#3b82f6"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
    <path d="M3 9l1.5-5.5A1 1 0 015.46 3h13.08a1 1 0 01.96.7L21 9" stroke="url(#storeG)" strokeWidth="1.5" fill="none"/>
    <path d="M3 9h18v2a3 3 0 01-3 3H6a3 3 0 01-3-3V9z" fill="url(#storeG)" opacity=".12"/>
    <path d="M5 14v6a1 1 0 001 1h12a1 1 0 001-1v-6" stroke="url(#storeG)" strokeWidth="1.5" fill="none"/>
    <rect x="9" y="16" width="6" height="5" rx=".5" stroke="url(#storeG)" strokeWidth="1.2" fill="url(#storeG)" fillOpacity=".1"/>
  </svg>
)

const IconForkKnifeGradient = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="forkG" x1="4" y1="2" x2="20" y2="22"><stop stopColor="#f43f5e"/><stop offset="1" stopColor="#ec4899"/></linearGradient></defs>
    <path d="M7 2v7a3 3 0 003 3v0a3 3 0 003-3V2" stroke="url(#forkG)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="2" x2="10" y2="22" stroke="url(#forkG)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17 2c0 0-2 2.5-2 5s2 3 2 5v10" stroke="url(#forkG)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
)

const IconBriefcaseGradient = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="briefG" x1="2" y1="6" x2="22" y2="20"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#0ea5e9"/></linearGradient></defs>
    <rect x="2" y="7" width="20" height="13" rx="2.5" fill="url(#briefG)" opacity=".1"/>
    <rect x="2" y="7" width="20" height="13" rx="2.5" stroke="url(#briefG)" strokeWidth="1.5" fill="none"/>
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="url(#briefG)" strokeWidth="1.5"/>
    <path d="M2 13h20" stroke="url(#briefG)" strokeWidth="1.2" opacity=".4"/>
  </svg>
)

const IconGridGradient = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="gridG" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#c084fc"/></linearGradient></defs>
    <rect x="3" y="3" width="8" height="8" rx="2" fill="url(#gridG)" opacity=".15" stroke="url(#gridG)" strokeWidth="1.3"/>
    <rect x="13" y="3" width="8" height="8" rx="2" fill="url(#gridG)" opacity=".15" stroke="url(#gridG)" strokeWidth="1.3"/>
    <rect x="3" y="13" width="8" height="8" rx="2" fill="url(#gridG)" opacity=".15" stroke="url(#gridG)" strokeWidth="1.3"/>
    <rect x="13" y="13" width="8" height="8" rx="2" fill="url(#gridG)" opacity=".15" stroke="url(#gridG)" strokeWidth="1.3"/>
  </svg>
)

/* ─── Constants ─── */
const STEP_IDS = ['welcome', 'identity', 'fiscal', 'location', 'industry', 'credentials', 'ready'] as const

const GREETINGS = [
  'Bienvenido. Vamos a configurar tu espacio de trabajo.',
  '¿Cómo te llamas?',
  'Identificación fiscal de tu empresa.',
  '¿Dónde opera tu empresa?',
  '¿Qué tipo de negocio manejas?',
  'Protege tu cuenta.',
  '¡Todo listo!',
]

const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'Comercio / Ferretería', IconComponent: IconStoreGradient, description: 'Punto de venta, inventario' },
  { value: 'RESTAURANT', label: 'Restaurante / Bar', IconComponent: IconForkKnifeGradient, description: 'Mesas, cocina, meseros' },
  { value: 'SERVICES', label: 'Servicios', IconComponent: IconBriefcaseGradient, description: 'Profesionales, consultoría' },
  { value: 'OTHER', label: 'Otro', IconComponent: IconGridGradient, description: 'Otro tipo de negocio' },
]

const CIIU_CODES = [
  { value: '4752', label: '4752 — Comercio al por menor de ferretería y vidrios' },
  { value: '4711', label: '4711 — Comercio al por menor en supermercados' },
  { value: '4719', label: '4719 — Comercio al por menor en establecimientos no especializados' },
  { value: '4721', label: '4721 — Comercio de alimentos en establecimientos especializados' },
  { value: '4741', label: '4741 — Comercio de computadores y equipo periférico' },
  { value: '4751', label: '4751 — Comercio de telas y productos textiles' },
  { value: '4753', label: '4753 — Comercio de tapices, alfombras y revestimientos' },
  { value: '4754', label: '4754 — Comercio de electrodomésticos' },
  { value: '4755', label: '4755 — Comercio de artículos y utensilios de uso doméstico' },
  { value: '4759', label: '4759 — Comercio de muebles para el hogar' },
  { value: '4761', label: '4761 — Comercio de libros, periódicos y artículos de papelería' },
  { value: '4762', label: '4762 — Comercio de artículos deportivos' },
  { value: '4771', label: '4771 — Comercio de prendas de vestir' },
  { value: '4772', label: '4772 — Comercio de calzado, artículos de cuero' },
  { value: '4773', label: '4773 — Comercio de productos farmacéuticos (droguerías)' },
  { value: '4774', label: '4774 — Comercio de artículos de óptica' },
  { value: '5611', label: '5611 — Expendio de comidas preparadas (restaurantes)' },
  { value: '5613', label: '5613 — Expendio de comidas preparadas en cafeterías' },
  { value: '5619', label: '5619 — Otros tipos de expendio de comidas' },
  { value: '5621', label: '5621 — Catering para eventos' },
  { value: '5630', label: '5630 — Expendio de bebidas alcohólicas (bares)' },
  { value: '6201', label: '6201 — Desarrollo de sistemas informáticos' },
  { value: '6202', label: '6202 — Consultoría informática' },
  { value: '6910', label: '6910 — Actividades jurídicas' },
  { value: '6920', label: '6920 — Contabilidad, teneduría de libros y auditoría' },
  { value: '7010', label: '7010 — Actividades de administración empresarial' },
  { value: '7110', label: '7110 — Actividades de arquitectura e ingeniería' },
  { value: '7490', label: '7490 — Otras actividades profesionales y técnicas' },
  { value: '8621', label: '8621 — Actividades de la práctica médica' },
  { value: '8622', label: '8622 — Actividades de la práctica odontológica' },
  { value: '9602', label: '9602 — Peluquería y otros tratamientos de belleza' },
]

const TAX_REGIMES = [
  { value: 'RESPONSABLE_IVA', label: 'Responsable de IVA' },
  { value: 'NO_RESPONSABLE_IVA', label: 'No Responsable de IVA' },
  { value: 'REGIMEN_SIMPLE', label: 'Régimen Simple de Tributación (RST)' },
]

const PERSON_TYPES = [
  { value: 'NATURAL', label: 'Persona Natural' },
  { value: 'JURIDICA', label: 'Persona Jurídica' },
]

const FISCAL_OPTIONS = [
  { value: 'GRAN_CONTRIBUYENTE', label: 'Gran Contribuyente' },
  { value: 'AUTORRETENEDOR', label: 'Autorretenedor' },
  { value: 'AGENTE_RETENCION_IVA', label: 'Agente de Retención de IVA' },
  { value: 'RETENEDOR_RENTA', label: 'Agente de Retención de Renta' },
]

const COLOMBIAN_DEPARTMENTS = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare',
  'Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo',
  'Quindío','Risaralda','San Andrés','Santander','Sucre','Tolima','Valle del Cauca',
  'Vaupés','Vichada','Bogotá D.C.'
]

async function completeOnboarding(data: Record<string, any>) {
  const res = await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to complete onboarding')
  }
  return res.json()
}

export function WelcomeOnboarding({ onComplete, planName, isDemo }: WelcomeOnboardingProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)

  // Form state
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [commercialName, setCommercialName] = useState('')
  const [personType, setPersonType] = useState('JURIDICA')
  const [companyNit, setCompanyNit] = useState('')
  const [verificationDigit, setVerificationDigit] = useState('')
  const [taxRegime, setTaxRegime] = useState('RESPONSABLE_IVA')
  const [fiscalResponsibilities, setFiscalResponsibilities] = useState<string[]>([])
  const [companyDepartment, setCompanyDepartment] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [economicActivity, setEconomicActivity] = useState('')
  const [invoicePrefix, setInvoicePrefix] = useState('FV')
  const [currency, setCurrency] = useState('COP')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const totalSteps = STEP_IDS.length
  const progress = ((step + 1) / totalSteps) * 100

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      toast('¡Bienvenido a Clivaro!', 'success')
      onComplete()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al completar la configuración', 'error')
    },
  })

  const toggleFiscal = (val: string) => {
    setFiscalResponsibilities(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  const handleNext = useCallback(() => {
    if (step === 1 && !userName.trim()) {
      toast('Por favor ingresa tu nombre', 'warning'); return
    }
    if (step === 2 && !companyName.trim()) {
      toast('Por favor ingresa la razón social', 'warning'); return
    }
    if (step === 4 && !businessType) {
      toast('Selecciona el tipo de negocio', 'warning'); return
    }
    if (step === 5) {
      if (!isDemo) {
        if (!newUsername.trim() || newUsername.length < 3) {
          toast('El usuario debe tener al menos 3 caracteres', 'warning'); return
        }
        if (!newPassword || newPassword.length < 8) {
          toast('La contraseña debe tener al menos 8 caracteres', 'warning'); return
        }
        if (newPassword !== confirmPassword) {
          toast('Las contraseñas no coinciden', 'warning'); return
        }
      }
    }

    if (step === totalSteps - 1) {
      if (isDemo) {
        toast('Demo completado. Datos no guardados.', 'success')
        onComplete()
        return
      }
      completeMutation.mutate({
        userName, companyName, commercialName: commercialName || undefined,
        personType, companyNit: companyNit || undefined,
        verificationDigit: verificationDigit || undefined,
        taxRegime, fiscalResponsibilities: JSON.stringify(fiscalResponsibilities),
        companyDepartment: companyDepartment || undefined,
        companyCity: companyCity || undefined,
        companyAddress: companyAddress || undefined,
        companyPhone: companyPhone || undefined,
        companyEmail: companyEmail || undefined,
        businessType, economicActivity: economicActivity || undefined,
        invoicePrefix, currency,
        newUsername: newUsername || undefined,
        newPassword: newPassword || undefined,
      })
      return
    }
    setStep(prev => prev + 1)
  }, [step, userName, companyName, commercialName, personType, companyNit, verificationDigit, taxRegime, fiscalResponsibilities, companyDepartment, companyCity, companyAddress, companyPhone, companyEmail, businessType, economicActivity, invoicePrefix, currency, newUsername, newPassword, confirmPassword, totalSteps, isDemo, completeMutation, toast, onComplete])

  const handleBack = () => { if (step > 0) setStep(prev => prev - 1) }

  const pageVariants = {
    initial: { opacity: 0, y: 30, scale: 0.97, filter: 'blur(4px)' },
    animate: {
      opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
    exit: {
      opacity: 0, y: -20, scale: 0.98, filter: 'blur(3px)',
      transition: { duration: 0.35, ease: [0.55, 0, 1, 0.45] as [number, number, number, number] },
    },
  }

  const fieldVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.96 },
    visible: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: {
        delay: 0.15 + i * 0.08,
        type: 'spring' as const,
        stiffness: 260,
        damping: 24,
      },
    }),
  }

  const cardHover = {
    scale: 1.03,
    transition: { type: 'spring' as const, stiffness: 400, damping: 17 },
  }

  const inputClasses = 'h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-slate-900/10 focus-visible:border-slate-400 rounded-xl text-[15px] placeholder:text-slate-400'

  // Summary data for final step
  const summaryRows = [
    { label: 'Nombre', value: userName },
    { label: 'Razón Social', value: companyName },
    ...(commercialName ? [{ label: 'Nombre Comercial', value: commercialName }] : []),
    { label: 'Tipo Persona', value: PERSON_TYPES.find(p => p.value === personType)?.label || '' },
    ...(companyNit ? [{ label: 'NIT', value: `${companyNit}${verificationDigit ? `-${verificationDigit}` : ''}` }] : []),
    { label: 'Régimen', value: TAX_REGIMES.find(r => r.value === taxRegime)?.label || '' },
    ...(companyCity ? [{ label: 'Ciudad', value: `${companyCity}${companyDepartment ? `, ${companyDepartment}` : ''}` }] : []),
    ...(companyAddress ? [{ label: 'Dirección', value: companyAddress }] : []),
    { label: 'Tipo Negocio', value: BUSINESS_TYPES.find(b => b.value === businessType)?.label || '' },
    { label: 'Prefijo Factura', value: invoicePrefix },
    { label: 'Moneda', value: currency },
    ...(!isDemo && newUsername ? [{ label: 'Usuario', value: newUsername }] : []),
  ].filter(r => r.value)

  return (
    <div className="fixed inset-0 z-50 bg-[#fafafa] dark:bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-800">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="text-[11px] font-semibold tracking-widest uppercase text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded-full">Demo</span>
          )}
          {planName && (
            <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Plan {planName}</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-[3px] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700 dark:from-white/70 dark:via-white dark:to-white/70"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ boxShadow: '0 0 12px rgba(15, 23, 42, 0.4)' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 overflow-y-auto py-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={pageVariants} initial="initial" animate="animate" exit="exit">
              {/* Title */}
              <div className="mb-8">
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-3">
                  Paso {step + 1} de {totalSteps}
                </p>
                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {GREETINGS[step]}
                </h1>
              </div>

              {/* ──── STEP 0: Welcome ──── */}
              {step === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  {/* Centered Logo with Animated Glow Ring */}
                  <motion.div
                    className="flex justify-center mb-8"
                    initial={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="relative">
                      {/* Glow ring */}
                      <motion.div
                        className="absolute -inset-4 rounded-3xl opacity-20 dark:opacity-30"
                        style={{ background: 'radial-gradient(circle, rgba(15,23,42,0.15) 0%, transparent 70%)' }}
                        animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.25, 0.15] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <Logo size="lg" className="h-32" />
                    </div>
                  </motion.div>

                  <motion.p
                    className="text-[15px] text-slate-500 leading-relaxed mb-8 max-w-md"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  >
                    En los próximos pasos configuraremos la identidad fiscal de tu empresa,
                    tu ubicación, el tipo de negocio y tus credenciales de acceso.
                    Toma menos de 3 minutos.
                  </motion.p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { IconC: IconShieldGradient, label: 'Datos fiscales' },
                      { IconC: IconReceiptGradient, label: 'Facturación' },
                      { IconC: IconLockGradient, label: 'Credenciales' },
                    ].map((item, i) => (
                      <motion.div key={i} custom={i} variants={fieldVariants} initial="hidden" animate="visible"
                        whileHover={cardHover}
                        className="flex flex-col items-center gap-2.5 py-5 px-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 cursor-default"
                      >
                        <motion.div
                          className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center"
                          initial={{ rotate: -8 }}
                          animate={{ rotate: 0 }}
                          transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 300, damping: 15 }}
                        >
                          <item.IconC className="w-6 h-6" />
                        </motion.div>
                        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ──── STEP 1: Personal Identity ──── */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <p className="text-[14px] text-slate-500 mb-6">Tu nombre aparecerá en el panel y en los documentos.</p>
                  <Label htmlFor="userName" className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Nombre completo</Label>
                  <Input id="userName" placeholder="Ej. Juan Pérez" value={userName} onChange={e => setUserName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNext() }} className={inputClasses} autoFocus />
                </motion.div>
              )}

              {/* ──── STEP 2: Fiscal Identity ──── */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-5">
                  <p className="text-[14px] text-slate-500 mb-1">Datos como aparecen en tu <strong>RUT</strong>. Aparecerán en facturas y documentos electrónicos.</p>

                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Razón Social <span className="text-red-500">*</span></Label>
                    <Input placeholder="Ej. Ferretería El Sol S.A.S" value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputClasses} autoFocus />
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Nombre Comercial</Label>
                    <Input placeholder="Ej. FerriSol (si difiere de la razón social)" value={commercialName} onChange={e => setCommercialName(e.target.value)} className={inputClasses} />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Tipo de Persona</Label>
                      <Select value={personType} onValueChange={setPersonType}>
                        <SelectTrigger className={inputClasses}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERSON_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </motion.div>
                    <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Régimen Tributario</Label>
                      <Select value={taxRegime} onValueChange={setTaxRegime}>
                        <SelectTrigger className={inputClasses}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TAX_REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="col-span-2 space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">NIT / CC</Label>
                      <Input placeholder="900.123.456" value={companyNit} onChange={e => setCompanyNit(e.target.value)} className={inputClasses} />
                    </motion.div>
                    <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">DV</Label>
                      <Input placeholder="7" maxLength={1} value={verificationDigit} onChange={e => setVerificationDigit(e.target.value)} className={inputClasses} />
                    </motion.div>
                  </div>

                  <motion.div custom={6} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-2">
                    <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Responsabilidades Fiscales</Label>
                    <div className="flex flex-wrap gap-2">
                      {FISCAL_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => toggleFiscal(opt.value)}
                          className={`text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 ${
                            fiscalResponsibilities.includes(opt.value)
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* ──── STEP 3: Location & Contact ──── */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-5">
                  <p className="text-[14px] text-slate-500 mb-1">Información de contacto y ubicación de la sede principal.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Departamento</Label>
                      <Select value={companyDepartment} onValueChange={setCompanyDepartment}>
                        <SelectTrigger className={inputClasses}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {COLOMBIAN_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </motion.div>
                    <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Ciudad / Municipio</Label>
                      <Input placeholder="Ej. Bogotá" value={companyCity} onChange={e => setCompanyCity(e.target.value)} className={inputClasses} />
                    </motion.div>
                  </div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Dirección</Label>
                    <Input placeholder="Calle 10 #5-32" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className={inputClasses} />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Teléfono</Label>
                      <Input placeholder="+57 311 352 4794" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className={inputClasses} />
                    </motion.div>
                    <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Email Empresa</Label>
                      <Input type="email" placeholder="info@empresa.com" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} className={inputClasses} />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* ──── STEP 4: Industry & Preferences ──── */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-6">
                  <p className="text-[14px] text-slate-500 mb-1">Esto configura tu punto de venta, módulos y documentación.</p>

                  <div className="grid grid-cols-2 gap-3">
                    {BUSINESS_TYPES.map((bt, i) => {
                      const isSelected = businessType === bt.value
                      return (
                        <motion.button key={bt.value} custom={i} variants={fieldVariants} initial="hidden" animate="visible" type="button"
                          whileHover={cardHover}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setBusinessType(bt.value)
                            if (bt.value === 'RESTAURANT') setInvoicePrefix('FVR')
                            else if (bt.value === 'RETAIL') setInvoicePrefix('FV')
                            else if (bt.value === 'SERVICES') setInvoicePrefix('FVS')
                          }}
                          className={`flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 transition-all duration-200 text-center ${
                            isSelected
                              ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 shadow-md'
                              : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <motion.div
                            className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center"
                            animate={isSelected ? { scale: [1, 1.12, 1] } : {}}
                            transition={{ duration: 0.4 }}
                          >
                            <bt.IconComponent />
                          </motion.div>
                          <span className={`text-[13px] font-semibold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {bt.label}
                          </span>
                          <span className="text-[11px] text-slate-400">{bt.description}</span>
                        </motion.button>
                      )
                    })}
                  </div>

                  <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Actividad Económica (CIIU)</Label>
                    <Select value={economicActivity} onValueChange={setEconomicActivity}>
                      <SelectTrigger className={inputClasses}><SelectValue placeholder="Seleccionar actividad económica" /></SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {CIIU_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Prefijo Facturación</Label>
                      <Input placeholder="FV" value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value.toUpperCase())} className={inputClasses} />
                    </motion.div>
                    <motion.div custom={6} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Moneda</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className={inputClasses}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COP">COP — Peso Colombiano</SelectItem>
                          <SelectItem value="USD">USD — Dólar</SelectItem>
                          <SelectItem value="EUR">EUR — Euro</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* ──── STEP 5: Credentials ──── */}
              {step === 5 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-5">
                  {isDemo ? (
                    <p className="text-[14px] text-slate-500 mb-2">
                      En modo demo, este paso se omite. En el onboarding real aquí se cambian las credenciales.
                    </p>
                  ) : (
                    <>
                      <p className="text-[14px] text-slate-500 mb-2">Reemplaza tu usuario y contraseña temporales por unos definitivos.</p>
                      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                        <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Nuevo usuario de acceso</Label>
                        <Input placeholder="mi_usuario" value={newUsername} onChange={e => setNewUsername(e.target.value)} className={inputClasses} autoFocus />
                      </motion.div>
                      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                        <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Nueva contraseña</Label>
                        <Input type="password" placeholder="Mínimo 8 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClasses} />
                      </motion.div>
                      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                        <Label className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Confirmar contraseña</Label>
                        <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNext() }} className={inputClasses} />
                      </motion.div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ──── STEP 6: Summary ──── */}
              {step === 6 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <p className="text-[15px] text-slate-500 leading-relaxed mb-6 max-w-md">
                    Tu espacio de trabajo está configurado. Verifica que la información sea correcta.
                  </p>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
                    {summaryRows.map((row, i) => (
                      <motion.div key={i} custom={i} variants={fieldVariants} initial="hidden" animate="visible" className="flex items-center justify-between px-5 py-3.5">
                        <span className="text-[13px] text-slate-500">{row.label}</span>
                        <span className="text-[13px] font-semibold text-slate-900 dark:text-white text-right max-w-[200px] truncate">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  {fiscalResponsibilities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {fiscalResponsibilities.map(f => (
                        <span key={f} className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {FISCAL_OPTIONS.find(o => o.value === f)?.label}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ──── Footer ──── */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div>
                  {step > 0 && (
                    <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                    </button>
                  )}
                </div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={handleNext} disabled={completeMutation.isPending}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 h-11 px-8 rounded-xl font-medium text-[14px] shadow-sm transition-all hover:shadow-lg"
                  >
                    {completeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Configurando...</>
                    ) : step === totalSteps - 1 ? (
                      <><Check className="w-4 h-4 mr-2" /> {isDemo ? 'Finalizar Demo' : 'Comenzar'}</>
                    ) : (
                      <>Continuar <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
