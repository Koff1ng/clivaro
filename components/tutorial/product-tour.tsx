'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, ArrowLeft, Sparkles, SkipForward } from 'lucide-react'

export interface TourStep {
  /** CSS selector for the target element */
  target: string
  /** Title of the step */
  title: string
  /** Description */
  description: string
  /** Position of the tooltip relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Optional action label */
  actionLabel?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: '📍 Navegación Principal',
    description: 'Desde aquí accedes a todos los módulos: Punto de Venta, Inventario, Facturación, CRM, Contabilidad, Nómina y más. Cada módulo tiene su propio espacio de trabajo.',
    placement: 'right',
  },
  {
    target: '[data-tour="dashboard-stats"]',
    title: '📊 Panel de Control',
    description: 'Tu resumen en tiempo real: ventas del día, inventario bajo, facturas pendientes y métricas clave de tu negocio. Se actualiza automáticamente.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-pos"]',
    title: '🛒 Punto de Venta (POS)',
    description: 'Registra ventas rápidamente con nuestro POS optimizado. Soporta lector de barras, múltiples métodos de pago, propinas, descuentos y cierres de caja.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-products"]',
    title: '📦 Productos e Inventario',
    description: 'Administra tu catálogo completo: precios, stock, variantes, recetas, unidades de medida y alertas de inventario bajo. Compatible con lectores de barras.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-invoices"]',
    title: '🧾 Facturación Electrónica',
    description: 'Emite facturas electrónicas válidas ante la DIAN. Soporta notas crédito, cotizaciones y toda la documentación fiscal requerida en Colombia.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-customers"]',
    title: '👥 Clientes y CRM',
    description: 'Gestiona tu base de clientes, historial de compras, crédito, leads y oportunidades de venta. Integra WhatsApp e Instagram.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-accounting"]',
    title: '📒 Contabilidad',
    description: 'Plan Único de Cuentas (PUC), asientos contables automáticos, balance general, estado de resultados y conciliación bancaria.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-reports"]',
    title: '📈 Reportes',
    description: 'Visualiza el rendimiento de tu negocio con gráficos interactivos: ventas por periodo, productos más vendidos, márgenes de ganancia y más.',
    placement: 'right',
  },
  {
    target: '[data-tour="help-button"]',
    title: '❓ Ayuda y Soporte',
    description: 'Accede a ayuda, documentación y soporte técnico. También puedes relanzar este tutorial desde Configuración → "Ver Tutorial".',
    placement: 'right',
  },
  {
    target: '[data-tour="user-profile"]',
    title: '👤 Tu Cuenta',
    description: 'Desde aquí accedes a configuración, mejora de plan, ajustes de privacidad y cierre de sesión. También verás tu plan actual y estado de cuenta.',
    placement: 'right',
  },
]

const STORAGE_KEY = 'clivaro_tour_completed'

interface ProductTourProps {
  /** Force show the tour regardless of completion status */
  forceShow?: boolean
  /** Callback when tour is completed or dismissed */
  onComplete?: () => void
  /** Only show after onboarding (auto-trigger) */
  autoStart?: boolean
}

export function ProductTour({ forceShow, onComplete, autoStart }: ProductTourProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)

  // Check if tour should show
  useEffect(() => {
    if (forceShow) {
      setIsActive(true)
      setCurrentStep(0)
      return
    }
    if (autoStart) {
      const completed = localStorage.getItem(STORAGE_KEY)
      if (!completed) {
        // Delay to let the main UI render first
        const timer = setTimeout(() => setIsActive(true), 800)
        return () => clearTimeout(timer)
      }
    }
  }, [forceShow, autoStart])

  // Position calculation
  const updatePosition = useCallback(() => {
    const step = TOUR_STEPS[currentStep]
    if (!step) return

    const el = document.querySelector(step.target)
    if (!el) {
      // Element not found — try scrolling into view or skip
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1)
      }
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    // Calculate tooltip position
    const padding = 16
    const tooltipWidth = 360
    const tooltipHeight = 200
    const placement = step.placement || 'bottom'

    let top = 0
    let left = 0

    switch (placement) {
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.right + padding
        break
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.left - tooltipWidth - padding
        break
      case 'top':
        top = rect.top - tooltipHeight - padding
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
      case 'bottom':
      default:
        top = rect.bottom + padding
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
    }

    // Clamp to viewport
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16))
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16))

    setTooltipPos({ top, left })
  }, [currentStep])

  useEffect(() => {
    if (!isActive) return
    updatePosition()

    // Observe resize
    const step = TOUR_STEPS[currentStep]
    if (step) {
      const el = document.querySelector(step.target)
      if (el) {
        observerRef.current = new ResizeObserver(updatePosition)
        observerRef.current.observe(el)
      }
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      observerRef.current?.disconnect()
    }
  }, [isActive, currentStep, updatePosition])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    setIsActive(false)
    setCurrentStep(0)
    localStorage.setItem(STORAGE_KEY, 'true')
    onComplete?.()
  }

  const handleSkip = () => {
    setIsActive(false)
    setCurrentStep(0)
    localStorage.setItem(STORAGE_KEY, 'true')
    onComplete?.()
  }

  if (!isActive) return null

  const step = TOUR_STEPS[currentStep]
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
          {/* Overlay with spotlight cutout */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <motion.rect
                      initial={{ opacity: 0 }}
                      animate={{
                        x: targetRect.left - 8,
                        y: targetRect.top - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        opacity: 1,
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      rx="12"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.6)"
                mask="url(#spotlight-mask)"
              />
            </svg>
          </motion.div>

          {/* Glowing border around target */}
          {targetRect && (
            <motion.div
              className="absolute rounded-xl pointer-events-none"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: targetRect.left - 8,
                y: targetRect.top - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                boxShadow: '0 0 0 3px rgba(99,102,241,0.5), 0 0 24px rgba(99,102,241,0.3)',
              }}
            />
          )}

          {/* Tooltip */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute w-[360px]"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
                style={{ backdropFilter: 'blur(20px)' }}
              >
                {/* Progress bar */}
                <div className="h-1 bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                <div className="p-5">
                  {/* Step counter */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="text-[11px] font-semibold tracking-widest uppercase text-indigo-500">
                        {currentStep + 1} / {TOUR_STEPS.length}
                      </span>
                    </div>
                    <button
                      onClick={handleSkip}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <SkipForward className="w-3 h-3" />
                      Omitir
                    </button>
                  </div>

                  {/* Content */}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                    {step.description}
                  </p>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <div>
                      {currentStep > 0 && (
                        <button
                          onClick={handlePrev}
                          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Anterior
                        </button>
                      )}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm hover:shadow-md"
                    >
                      {currentStep === TOUR_STEPS.length - 1 ? (
                        <>¡Comenzar! <Sparkles className="w-3.5 h-3.5" /></>
                      ) : (
                        <>Siguiente <ArrowRight className="w-3.5 h-3.5" /></>
                      )}
                    </motion.button>
                  </div>

                  {/* Progress dots */}
                  <div className="flex items-center justify-center gap-1.5 mt-4">
                    {TOUR_STEPS.map((_, i) => (
                      <motion.div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${
                          i === currentStep
                            ? 'w-5 h-1.5 bg-indigo-500'
                            : i < currentStep
                            ? 'w-1.5 h-1.5 bg-indigo-300'
                            : 'w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700'
                        }`}
                        layout
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Close button (top right) */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={handleSkip}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Reset tour state so it shows again */
export function resetTour() {
  localStorage.removeItem(STORAGE_KEY)
}

/** Check if tour has been completed */
export function isTourCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}
