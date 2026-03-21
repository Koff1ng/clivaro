'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, Check, Building2, User, Lock, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'

interface WelcomeOnboardingProps {
  onComplete: () => void
  planName?: string | null
}

async function completeOnboarding(data: {
  userName: string
  companyName: string
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
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

  const steps = [
    {
      title: 'Bienvenido a Clivaro',
      subtitle: planName ? `Plan ${planName}` : 'Configuracion inicial',
      description: 'Estamos encantados de tenerte aquí. Vamos a preparar tu espacio de trabajo en unos sencillos pasos para que puedas empezar a gestionar tu empresa.',
      showInput: false,
      icon: Sparkles,
    },
    {
      title: '¿Cuál es tu nombre?',
      subtitle: 'Personalización',
      description: 'Queremos asegurarnos de dirigirnos a ti correctamente.',
      showInput: true,
      inputType: 'userName',
      placeholder: 'Ej. Juan Pérez',
      icon: User,
    },
    {
      title: '¿Cómo se llama tu empresa?',
      subtitle: 'Identidad del negocio',
      description: 'El nombre comercial que tus clientes verán en facturas y recibos.',
      showInput: true,
      inputType: 'companyName',
      placeholder: 'Ej. Ferretería El Sol',
      icon: Building2,
    },
    {
      title: 'Configura tus accesos',
      subtitle: 'Seguridad de la cuenta',
      description: 'Por seguridad, te pedimos actualizar tu usuario y contraseña temporales por unos definitivos.',
      showInput: true,
      inputType: 'credentials',
      placeholder: '',
      icon: Lock,
    },
  ]

  const currentStep = steps[step]

  const handleNext = () => {
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
      completeMutation.mutate({
        userName,
        companyName,
        newUsername,
        newPassword,
      })
      return
    }
    if (step < steps.length - 1) {
      setStep(step + 1)
    }
  }

  // Apple-like refined animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 10 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1], staggerChildren: 0.05 } 
    },
    exit: { 
      opacity: 0, 
      scale: 0.98,
      y: -10,
      transition: { duration: 0.3, ease: [0.5, 0, 0.75, 0] } 
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] } 
    },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950 overflow-y-auto px-4 py-12 sm:px-6">
      
      {/* Top Logo */}
      <div className="absolute top-8 left-8 hidden md:block">
        <Logo size="sm" />
      </div>

      <div className="w-full max-w-xl mx-auto my-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden"
          >
            {/* Header / Hero area of the card */}
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-8 py-10 border-b border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
              <motion.div variants={itemVariants} className="mb-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm border border-blue-100/50 dark:border-blue-800/50">
                  <currentStep.icon className="w-8 h-8" strokeWidth={1.5} />
                </div>
              </motion.div>
              <motion.div variants={itemVariants} className="space-y-2">
                <p className="text-sm font-semibold tracking-wide uppercase text-blue-600 dark:text-blue-400">
                  {currentStep.subtitle}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {currentStep.title}
                </h1>
                <p className="text-base text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                  {currentStep.description}
                </p>
              </motion.div>
            </div>

            {/* Inputs & Actions area */}
            <div className="p-8">
              {currentStep.showInput && currentStep.inputType !== 'credentials' && (
                <motion.div variants={itemVariants} className="mb-8">
                  <Label className="sr-only">Respuesta</Label>
                  <Input
                    type="text"
                    placeholder={currentStep.placeholder}
                    value={currentStep.inputType === 'userName' ? userName : companyName}
                    onChange={(e) => {
                      if (currentStep.inputType === 'userName') setUserName(e.target.value)
                      else setCompanyName(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNext()
                    }}
                    className="h-14 text-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30"
                    autoFocus
                  />
                </motion.div>
              )}

              {currentStep.showInput && currentStep.inputType === 'credentials' && (
                <motion.div variants={itemVariants} className="space-y-5 mb-8">
                  <div className="space-y-2">
                    <Label htmlFor="newUsername">Usuario de acceso</Label>
                    <Input
                      id="newUsername"
                      type="text"
                      placeholder="Identificador para inicio de sesión"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva Contraseña</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNext()
                      }}
                      className="h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </motion.div>
              )}

              {/* Progress and Buttons */}
              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-6">
                
                {/* Dots */}
                <div className="flex gap-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        index === step
                          ? 'w-6 bg-blue-600 dark:bg-blue-500'
                          : index < step
                          ? 'w-2 bg-slate-300 dark:bg-slate-600'
                          : 'w-2 bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  ))}
                </div>

                {/* Nav buttons */}
                <div className="flex gap-3 w-full sm:w-auto">
                  {step > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => setStep(step - 1)}
                      className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex-1 sm:flex-none"
                    >
                      Atrás
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    disabled={completeMutation.isPending}
                    className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 flex-1 sm:flex-none shadow-sm h-10 px-8 transition-colors"
                  >
                    {completeMutation.isPending ? (
                      <span className="animate-pulse">Configurando...</span>
                    ) : step === steps.length - 1 ? (
                      <>Comenzar <Check className="h-4 w-4 ml-2" /></>
                    ) : (
                      <>Continuar <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                </div>

              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
