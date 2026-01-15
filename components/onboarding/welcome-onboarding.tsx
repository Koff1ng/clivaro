'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, ArrowRight, Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'

interface WelcomeOnboardingProps {
  onComplete: () => void
}

async function completeOnboarding(data: { userName: string; companyName: string }) {
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

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
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
      subtitle: 'Clivaro Super Pro',
      description: 'Tu sistema de gestión empresarial todo-en-uno',
      showInput: false,
    },
    {
      title: '¿Cuál es tu nombre?',
      subtitle: '',
      description: 'Queremos conocerte mejor',
      showInput: true,
      inputType: 'userName',
      placeholder: 'Ingresa tu nombre',
    },
    {
      title: '¿Cómo se llama tu empresa?',
      subtitle: '',
      description: 'El nombre de tu negocio',
      showInput: true,
      inputType: 'companyName',
      placeholder: 'Ingresa el nombre de tu empresa',
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
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      // Último paso, completar onboarding
      completeMutation.mutate({ userName, companyName })
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-md px-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 space-y-8">
            {/* Logo/Icon Animation */}
            {step === 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-50 animate-pulse" />
                  <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-6">
                    <Sparkles className="h-16 w-16 text-white" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Content */}
            <div className="text-center space-y-4">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: step === 0 ? 0.4 : 0.1 }}
                className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              >
                {currentStep.title}
              </motion.h1>
              
              {currentStep.subtitle && (
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: step === 0 ? 0.5 : 0.2 }}
                  className="text-3xl font-extrabold text-gray-900 dark:text-white"
                >
                  {currentStep.subtitle}
                </motion.h2>
              )}

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: step === 0 ? 0.6 : 0.3 }}
                className="text-gray-600 dark:text-gray-300 text-lg"
              >
                {currentStep.description}
              </motion.p>

              {/* Input Field */}
              {currentStep.showInput && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="pt-4"
                >
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
                    className="text-lg h-14 text-center"
                    autoFocus
                  />
                </motion.div>
              )}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={`h-2 rounded-full transition-all ${
                    index === step
                      ? 'w-8 bg-blue-500'
                      : index < step
                      ? 'w-2 bg-green-500'
                      : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  Atrás
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={completeMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {completeMutation.isPending ? (
                  'Guardando...'
                ) : step === steps.length - 1 ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Completar
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

