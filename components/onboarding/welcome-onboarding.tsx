'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, ArrowLeft, Check, Building2, User, Lock, MapPin, Phone, Mail, Percent, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'

interface WelcomeOnboardingProps {
  onComplete: () => void
  planName?: string | null
}

/* ─── Typing Animation Hook ─── */
function useTypingAnimation(text: string, speed = 35, delay = 300) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setIsDone(false)
    let i = 0
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

/* ─── Step Definitions ─── */
const STEP_IDS = ['welcome', 'identity', 'business', 'credentials', 'ready'] as const

async function completeOnboarding(data: {
  userName: string
  companyName: string
  companyNit?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  defaultTaxRate?: number
  newUsername?: string
  newPassword?: string
}) {
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

export function WelcomeOnboarding({ onComplete, planName }: WelcomeOnboardingProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)

  // Form data
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNit, setCompanyNit] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [defaultTaxRate, setDefaultTaxRate] = useState('19')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const totalSteps = STEP_IDS.length
  const progress = ((step + 1) / totalSteps) * 100

  // Typing animation for each step
  const greetings = [
    'Bienvenido. Vamos a configurar tu espacio de trabajo.',
    '¿Cómo te llamas?',
    'Cuéntanos sobre tu empresa.',
    'Protege tu cuenta.',
    '¡Todo listo!',
  ]

  const { displayed: typedText, isDone: typingDone } = useTypingAnimation(
    greetings[step],
    30,
    200
  )

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

  const handleNext = useCallback(() => {
    // Validate current step
    if (step === 1 && !userName.trim()) {
      toast('Por favor ingresa tu nombre', 'warning')
      return
    }
    if (step === 2 && !companyName.trim()) {
      toast('Por favor ingresa el nombre de tu empresa', 'warning')
      return
    }
    if (step === 3) {
      if (!newUsername.trim() || newUsername.length < 3) {
        toast('El usuario debe tener al menos 3 caracteres', 'warning')
        return
      }
      if (!newPassword || newPassword.length < 8) {
        toast('La contraseña debe tener al menos 8 caracteres', 'warning')
        return
      }
      if (newPassword !== confirmPassword) {
        toast('Las contraseñas no coinciden', 'warning')
        return
      }
    }

    // Last step → submit
    if (step === totalSteps - 1) {
      completeMutation.mutate({
        userName,
        companyName,
        companyNit: companyNit || undefined,
        companyAddress: companyAddress || undefined,
        companyPhone: companyPhone || undefined,
        companyEmail: companyEmail || undefined,
        defaultTaxRate: defaultTaxRate ? parseFloat(defaultTaxRate) : undefined,
        newUsername,
        newPassword,
      })
      return
    }

    setStep(prev => prev + 1)
  }, [step, userName, companyName, companyNit, companyAddress, companyPhone, companyEmail, defaultTaxRate, newUsername, newPassword, confirmPassword, totalSteps, completeMutation, toast])

  const handleBack = () => {
    if (step > 0) setStep(prev => prev - 1)
  }

  // Apple-like page animation
  const pageVariants = {
    initial: { opacity: 0, y: 24 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
    exit: {
      opacity: 0,
      y: -16,
      transition: { duration: 0.3, ease: [0.55, 0, 1, 0.45] as [number, number, number, number] },
    },
  }

  const fieldVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
  }

  const inputClasses =
    'h-12 bg-white border-slate-200 focus-visible:ring-slate-900/10 focus-visible:border-slate-400 rounded-xl text-[15px] placeholder:text-slate-400'

  return (
    <div className="fixed inset-0 z-50 bg-[#fafafa] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
        <Logo size="sm" />
        {planName && (
          <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">
            Plan {planName}
          </span>
        )}
      </div>

      {/* ── Progress Bar ── */}
      <div className="h-[2px] bg-slate-100 relative">
        <motion.div
          className="absolute inset-y-0 left-0 bg-slate-900"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 overflow-y-auto py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* ── Typing Title ── */}
              <div className="mb-8">
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-3">
                  Paso {step + 1} de {totalSteps}
                </p>
                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 leading-tight min-h-[44px]">
                  {typedText}
                  {!typingDone && (
                    <span className="inline-block w-[2px] h-[28px] bg-slate-900 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </h1>
              </div>

              {/* ──── STEP 0: Welcome ──── */}
              {step === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <p className="text-[15px] text-slate-500 leading-relaxed mb-8 max-w-md">
                    En los próximos pasos configuraremos los datos de tu empresa,
                    preferencias del punto de venta y tus credenciales de acceso definitivas.
                    Toma menos de 2 minutos.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                      { icon: Building2, label: 'Tu empresa' },
                      { icon: Lock, label: 'Credenciales' },
                      { icon: Check, label: 'Listo' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-col items-center gap-2 py-4 px-3 bg-white rounded-2xl border border-slate-100"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                          <item.icon className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <span className="text-[12px] font-medium text-slate-600">{item.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ──── STEP 1: Personal Identity ──── */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <p className="text-[14px] text-slate-500 mb-6">
                    Tu nombre aparecerá en el panel y en los documentos que genere el sistema.
                  </p>
                  <Label htmlFor="userName" className="text-[13px] font-medium text-slate-700">
                    Nombre completo
                  </Label>
                  <Input
                    id="userName"
                    placeholder="Ej. Juan Pérez"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNext() }}
                    className={inputClasses}
                    autoFocus
                  />
                </motion.div>
              )}

              {/* ──── STEP 2: Business Info ──── */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-5"
                >
                  <p className="text-[14px] text-slate-500 mb-2">
                    Esta información aparecerá en facturas, cotizaciones y reportes.
                  </p>

                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-[13px] font-medium text-slate-700">
                      Nombre de la empresa <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Ej. Ferretería El Sol"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className={inputClasses}
                      autoFocus
                    />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label htmlFor="companyNit" className="text-[13px] font-medium text-slate-700">NIT / CC</Label>
                      <Input
                        id="companyNit"
                        placeholder="900.123.456-7"
                        value={companyNit}
                        onChange={e => setCompanyNit(e.target.value)}
                        className={inputClasses}
                      />
                    </motion.div>
                    <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label htmlFor="defaultTaxRate" className="text-[13px] font-medium text-slate-700">IVA por defecto (%)</Label>
                      <Input
                        id="defaultTaxRate"
                        type="number"
                        placeholder="19"
                        value={defaultTaxRate}
                        onChange={e => setDefaultTaxRate(e.target.value)}
                        className={inputClasses}
                      />
                    </motion.div>
                  </div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label htmlFor="companyAddress" className="text-[13px] font-medium text-slate-700">Dirección</Label>
                    <Input
                      id="companyAddress"
                      placeholder="Calle 10 #5-32, Bogotá"
                      value={companyAddress}
                      onChange={e => setCompanyAddress(e.target.value)}
                      className={inputClasses}
                    />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label htmlFor="companyPhone" className="text-[13px] font-medium text-slate-700">Teléfono</Label>
                      <Input
                        id="companyPhone"
                        placeholder="+57 311 352 4794"
                        value={companyPhone}
                        onChange={e => setCompanyPhone(e.target.value)}
                        className={inputClasses}
                      />
                    </motion.div>
                    <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <Label htmlFor="companyEmail" className="text-[13px] font-medium text-slate-700">Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        placeholder="info@empresa.com"
                        value={companyEmail}
                        onChange={e => setCompanyEmail(e.target.value)}
                        className={inputClasses}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* ──── STEP 3: Credentials ──── */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-5"
                >
                  <p className="text-[14px] text-slate-500 mb-2">
                    Reemplaza tu usuario y contraseña temporales por unos definitivos.
                  </p>

                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label htmlFor="newUsername" className="text-[13px] font-medium text-slate-700">
                      Nuevo usuario de acceso
                    </Label>
                    <Input
                      id="newUsername"
                      placeholder="mi_usuario"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      className={inputClasses}
                      autoFocus
                    />
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-[13px] font-medium text-slate-700">
                      Nueva contraseña
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={inputClasses}
                    />
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-slate-700">
                      Confirmar contraseña
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleNext() }}
                      className={inputClasses}
                    />
                  </motion.div>
                </motion.div>
              )}

              {/* ──── STEP 4: Ready ──── */}
              {step === 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-[15px] text-slate-500 leading-relaxed mb-8 max-w-md">
                    Tu espacio de trabajo está configurado. A continuación un resumen de lo que capturamos.
                  </p>

                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden mb-8">
                    {[
                      { label: 'Nombre', value: userName },
                      { label: 'Empresa', value: companyName },
                      ...(companyNit ? [{ label: 'NIT', value: companyNit }] : []),
                      ...(companyAddress ? [{ label: 'Dirección', value: companyAddress }] : []),
                      ...(companyPhone ? [{ label: 'Teléfono', value: companyPhone }] : []),
                      ...(companyEmail ? [{ label: 'Email', value: companyEmail }] : []),
                      { label: 'IVA', value: `${defaultTaxRate || 19}%` },
                      { label: 'Usuario', value: newUsername },
                    ].map((row, i) => (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex items-center justify-between px-5 py-3.5"
                      >
                        <span className="text-[13px] text-slate-500">{row.label}</span>
                        <span className="text-[13px] font-semibold text-slate-900">{row.value || '—'}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ──── Footer Buttons ──── */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
                <div>
                  {step > 0 && (
                    <button
                      onClick={handleBack}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Atrás
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleNext}
                  disabled={completeMutation.isPending}
                  className="bg-slate-900 hover:bg-slate-800 text-white h-11 px-8 rounded-xl font-medium text-[14px] shadow-sm transition-all hover:shadow-md"
                >
                  {completeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Configurando...
                    </>
                  ) : step === totalSteps - 1 ? (
                    <>
                      Comenzar
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
