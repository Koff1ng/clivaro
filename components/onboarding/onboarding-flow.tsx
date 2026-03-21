'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Logo } from '@/components/ui/logo'
import { Check, ArrowRight, Loader2, Building2, Package, Users, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ───────── Step definitions ───────── */
const STEPS = [
  {
    id: 'welcome',
    icon: Building2,
    title: 'Bienvenido a Clivaro',
    subtitle: 'Gestión inteligente',
    description: 'Hemos configurado tu espacio de trabajo. Todo está listo para que empieces a administrar tu negocio de forma simplificada.',
  },
  {
    id: 'products',
    icon: Package,
    title: 'Control total de inventario',
    subtitle: 'Bodegas y Stock',
    description: 'Registra tus productos, establece alertas de stock mínimo y recibe notificaciones cuando necesites reponer mercancía.',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Trabajo en equipo',
    subtitle: 'Roles y Autorización',
    description: 'Invita a tus cajeros, administradores o gerentes y define exactamente qué puede ver y hacer cada uno.',
  },
  {
    id: 'ready',
    icon: Settings,
    title: 'Ecosistema completo',
    subtitle: 'POS, Facturación y CRM',
    description: 'Disfruta de integraciones contables, facturación electrónica y analíticas en tiempo real en un solo lugar.',
  },
]

export function OnboardingFlow() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(0)
  const [finishing, setFinishing] = useState(false)

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1

  const handleNext = useCallback(async () => {
    if (isLast) {
      setFinishing(true)
      await new Promise(r => setTimeout(r, 600))
      router.push('/dashboard')
      return
    }
    setCurrentStep(prev => prev + 1)
  }, [isLast, router])

  // Apple-like variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 10 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 1, 0.5, 1], staggerChildren: 0.1 } 
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
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-y-auto px-4 py-12 sm:px-6">
      
      {/* Top logo */}
      <div className="absolute top-8 left-8 hidden md:block">
        <Logo size="sm" />
      </div>

      <div className="w-full max-w-xl mx-auto my-auto py-8">
        <AnimatePresence mode="wait">
          {!finishing && (
            <motion.div
              key={currentStep}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden"
            >
              <div className="bg-slate-50/50 dark:bg-slate-800/50 px-8 py-12 border-b border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
                <motion.div variants={itemVariants} className="mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 flex items-center justify-center mx-auto shadow-md">
                    <step.icon className="w-8 h-8" strokeWidth={1.5} />
                  </div>
                </motion.div>
                
                <motion.div variants={itemVariants} className="space-y-3">
                  <p className="text-sm font-semibold tracking-wide uppercase text-slate-500">
                    {step.subtitle}
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {step.title}
                  </h1>
                  <p className="text-base text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              </div>

              <div className="p-8">
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  
                  {/* Progress Indicators */}
                  <div className="flex gap-2">
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all duration-500 ${
                          i === currentStep
                            ? 'w-6 bg-slate-900 dark:bg-white'
                            : i < currentStep
                            ? 'w-2 bg-slate-300 dark:bg-slate-600'
                            : 'w-2 bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 w-full sm:w-auto items-center">
                    {!isLast && (
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-1 sm:flex-none py-2"
                      >
                        Omitir
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 flex-1 sm:flex-none shadow-sm h-11 px-8 rounded-xl font-medium transition-colors flex items-center justify-center whitespace-nowrap"
                    >
                      {isLast ? (
                        <>Empezar viaje <Check className="h-4 w-4 ml-2" /></>
                      ) : (
                        <>Continuar <ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </button>
                  </div>

                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Finishing State */}
          {finishing && (
            <motion.div 
              key="finishing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center py-20"
            >
              <Loader2 className="h-10 w-10 text-slate-900 dark:text-white animate-spin mb-4" />
              <h2 className="text-xl font-medium text-slate-900 dark:text-white">Preparando tu dashboard...</h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
