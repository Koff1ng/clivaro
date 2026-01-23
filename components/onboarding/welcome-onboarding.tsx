'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, ArrowRight, Check, Rocket, Building2, User, Lock } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import Image from 'next/image'

interface WelcomeOnboardingProps {
  onComplete: () => void
  planName?: string | null
}

async function fetchOnboardingData() {
  const res = await fetch('/api/onboarding')
  if (!res.ok) throw new Error('Failed to fetch onboarding data')
  return res.json()
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

// Floating particles component
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-blue-400/20 to-purple-400/20"
        initial={{
          x: Math.random() * 100 + '%',
          y: Math.random() * 100 + '%',
          scale: Math.random() * 0.5 + 0.5,
        }}
        animate={{
          y: [null, '-20%', null],
          x: [null, `${Math.random() * 10 - 5}%`, null],
          opacity: [0.3, 0.8, 0.3],
        }}
        transition={{
          duration: Math.random() * 5 + 5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: Math.random() * 2,
        }}
      />
    ))}
  </div>
)

// Animated background gradient
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    <motion.div
      className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl"
      animate={{
        rotate: 360,
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
    <motion.div
      className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl"
      animate={{
        rotate: -360,
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 25,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  </div>
)

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
      title: 'Bienvenido a',
      subtitle: planName ? `Clivaro ${planName}` : 'Clivaro',
      description: 'Tu sistema de gestión empresarial todo en uno',
      showInput: false,
      icon: Rocket,
    },
    {
      title: '¿Cuál es tu nombre?',
      subtitle: '',
      description: 'Queremos conocerte mejor',
      showInput: true,
      inputType: 'userName',
      placeholder: 'Ingresa tu nombre',
      icon: User,
    },
    {
      title: '¿Cómo se llama tu empresa?',
      subtitle: '',
      description: 'El nombre de tu negocio',
      showInput: true,
      inputType: 'companyName',
      placeholder: 'Ingresa el nombre de tu empresa',
      icon: Building2,
    },
    {
      title: 'Configura tus credenciales',
      subtitle: '',
      description: 'Por seguridad, cambia tu usuario y contraseña por defecto',
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
      // Validar credenciales
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
      // Último paso, completar onboarding
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

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const },
    },
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />
      <FloatingParticles />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-lg px-6 relative z-10"
        >
          <motion.div
            className="relative bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8 space-y-8"
            initial={{ boxShadow: '0 0 0 rgba(59, 130, 246, 0)' }}
            animate={{
              boxShadow: [
                '0 0 20px rgba(59, 130, 246, 0.1)',
                '0 0 40px rgba(147, 51, 234, 0.1)',
                '0 0 20px rgba(59, 130, 246, 0.1)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Glowing border effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 opacity-0 hover:opacity-100 transition-opacity blur-xl -z-10" />

            {/* Logo Animation */}
            {step === 0 && (
              <motion.div
                variants={itemVariants}
                className="flex justify-center"
              >
                <div className="relative">
                  {/* Outer glow ring */}
                  <motion.div
                    className="absolute inset-[-20px] rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
                    }}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* Rotating ring */}
                  <motion.div
                    className="absolute inset-[-10px] rounded-full border-2 border-dashed border-blue-500/30"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  />

                  {/* Logo container */}
                  <motion.div
                    className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-full p-1 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Image
                      src="/clivaro-logo.webp"
                      alt="Clivaro"
                      width={120}
                      height={120}
                      className="rounded-full"
                      priority
                    />
                  </motion.div>

                  {/* Sparkle accents */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full"
                      style={{
                        top: `${20 + i * 20}%`,
                        left: i % 2 === 0 ? '-10px' : 'auto',
                        right: i % 2 === 1 ? '-10px' : 'auto',
                      }}
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step Icon for other steps */}
            {step > 0 && (
              <motion.div variants={itemVariants} className="flex justify-center">
                <motion.div
                  className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30"
                  whileHover={{ scale: 1.05 }}
                >
                  <currentStep.icon className="h-10 w-10 text-blue-400" />
                </motion.div>
              </motion.div>
            )}

            {/* Content */}
            <div className="text-center space-y-4">
              <motion.h1
                variants={itemVariants}
                className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
              >
                {currentStep.title}
              </motion.h1>

              {currentStep.subtitle && (
                <motion.h2
                  variants={itemVariants}
                  className="text-3xl font-extrabold text-white"
                >
                  {currentStep.subtitle}
                </motion.h2>
              )}

              <motion.p
                variants={itemVariants}
                className="text-slate-400 text-lg"
              >
                {currentStep.description}
              </motion.p>

              {/* Input Field */}
              {currentStep.showInput && currentStep.inputType !== 'credentials' && (
                <motion.div variants={itemVariants} className="pt-4">
                  <Input
                    type="text"
                    placeholder={currentStep.placeholder}
                    value={currentStep.inputType === 'userName' ? userName : companyName}
                    onChange={(e) => {
                      if (currentStep.inputType === 'userName') {
                        setUserName(e.target.value)
                      } else {
                        setCompanyName(e.target.value)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNext()
                      }
                    }}
                    className="text-lg h-14 text-center bg-slate-800/50 border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 text-white placeholder:text-slate-500"
                    autoFocus
                  />
                </motion.div>
              )}

              {/* Credentials Input Fields */}
              {currentStep.showInput && currentStep.inputType === 'credentials' && (
                <motion.div variants={itemVariants} className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newUsername" className="text-left text-slate-300">Nuevo Usuario</Label>
                    <Input
                      id="newUsername"
                      type="text"
                      placeholder="Ingresa tu nuevo usuario"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="text-lg h-12 bg-slate-800/50 border-slate-600 focus:border-blue-500 text-white"
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 text-left">Mínimo 3 caracteres</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-left text-slate-300">Nueva Contraseña</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Ingresa tu nueva contraseña"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-lg h-12 bg-slate-800/50 border-slate-600 focus:border-blue-500 text-white"
                    />
                    <p className="text-xs text-slate-500 text-left">Mínimo 8 caracteres</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-left text-slate-300">Confirmar Contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirma tu contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleNext()
                        }
                      }}
                      className="text-lg h-12 bg-slate-800/50 border-slate-600 focus:border-blue-500 text-white"
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Progress Dots */}
            <motion.div variants={itemVariants} className="flex justify-center gap-3">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${index === step
                    ? 'w-10 bg-gradient-to-r from-blue-500 to-purple-500'
                    : index < step
                      ? 'w-2 bg-green-500'
                      : 'w-2 bg-slate-600'
                    }`}
                  whileHover={{ scale: 1.2 }}
                />
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div variants={itemVariants} className="flex gap-3">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Atrás
                </Button>
              )}
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleNext}
                  disabled={completeMutation.isPending}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300"
                >
                  {completeMutation.isPending ? (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      Guardando...
                    </motion.span>
                  ) : step === steps.length - 1 ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Completar
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* CSS for gradient animation */}
      <style jsx global>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s linear infinite;
        }
      `}</style>
    </div>
  )
}


