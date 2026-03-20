'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Logo } from '@/components/ui/logo'
import { Check, ArrowRight, Loader2, Building2, Package, Users, Settings } from 'lucide-react'

/* ───────── Typing animation ───────── */
function TypingText({ text, speed = 40, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse ml-0.5 text-blue-500">|</span>}
    </span>
  )
}

/* ───────── Step definitions ───────── */
const STEPS = [
  {
    id: 'welcome',
    icon: Building2,
    title: 'Bienvenido a Clivaro.',
    subtitle: 'Tu nuevo sistema de gestión empresarial está listo.',
    description: 'Vamos a personalizar tu espacio de trabajo en unos segundos.',
  },
  {
    id: 'products',
    icon: Package,
    title: 'Productos e Inventario.',
    subtitle: 'El control de tu stock en tiempo real.',
    description: 'Registra productos, establece alertas de stock mínimo y gestiona múltiples bodegas.',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Tu equipo.',
    subtitle: 'Permisos granulares por rol.',
    description: 'Invita a tu equipo y define exactamente qué puede ver y hacer cada persona.',
  },
  {
    id: 'ready',
    icon: Settings,
    title: 'Todo listo.',
    subtitle: 'Tu negocio ya está en la nube.',
    description: 'Factura electrónicamente, vende desde el POS y analiza tus datos con inteligencia artificial.',
  },
]

/* ───────── Main component ───────── */
export function OnboardingFlow() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(0)
  const [showContent, setShowContent] = useState(false)
  const [titleDone, setTitleDone] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Animate in content after mount
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300)
    return () => clearTimeout(t)
  }, [])

  // Reset animations on step change
  useEffect(() => {
    setTitleDone(false)
  }, [currentStep])

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1
  const StepIcon = step.icon

  const handleNext = useCallback(async () => {
    if (isLast) {
      setFinishing(true)
      // Small delay for a smooth exit animation
      await new Promise(r => setTimeout(r, 600))
      router.push('/dashboard')
      return
    }
    setShowContent(false)
    setTimeout(() => {
      setCurrentStep(prev => prev + 1)
      setShowContent(true)
    }, 400)
  }, [isLast, router])

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 pointer-events-none" />

      {/* Top logo bar — minimal */}
      <div className="absolute top-6 left-8 z-10">
        <Logo size="sm" className="opacity-60" />
      </div>

      {/* Progress dots */}
      <div className="absolute top-8 right-8 flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === currentStep ? 'w-8 bg-blue-600' : i < currentStep ? 'w-2 bg-blue-400' : 'w-2 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Main content — centered */}
      <div
        className={`relative z-10 flex flex-col items-center text-center max-w-2xl px-8 transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        } ${finishing ? 'scale-95 opacity-0' : ''}`}
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-10 shadow-lg shadow-blue-500/20">
          <StepIcon className="w-10 h-10 text-white" />
        </div>

        {/* Title with typing animation */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4 min-h-[3.5rem]">
          <TypingText key={step.id + '-title'} text={step.title} speed={35} onDone={() => setTitleDone(true)} />
        </h1>

        {/* Subtitle — fades in after title */}
        <p
          className={`text-xl md:text-2xl font-medium text-gray-500 mb-6 transition-all duration-700 ${
            titleDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {step.subtitle}
        </p>

        {/* Description — fades in after subtitle */}
        <p
          className={`text-base text-gray-400 leading-relaxed max-w-lg mb-12 transition-all duration-700 delay-200 ${
            titleDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {step.description}
        </p>

        {/* Action button */}
        <button
          onClick={handleNext}
          disabled={finishing}
          className={`group inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 ${
            titleDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          } ${
            isLast
              ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:bg-blue-700'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
          style={{ transitionDelay: titleDone ? '400ms' : '0ms' }}
        >
          {finishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparando...
            </>
          ) : isLast ? (
            <>
              Ir al Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          ) : (
            <>
              Continuar
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Skip link */}
        {!isLast && (
          <button
            onClick={() => router.push('/dashboard')}
            className={`mt-6 text-sm text-gray-400 hover:text-gray-600 transition-all duration-500 ${
              titleDone ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: titleDone ? '600ms' : '0ms' }}
          >
            Omitir introducción
          </button>
        )}
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-20" />
    </div>
  )
}
