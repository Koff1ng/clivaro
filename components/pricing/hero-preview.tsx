'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, ArrowRight } from 'lucide-react'
import { SoftwarePreview } from './software-preview'
import { Logo } from '@/components/ui/logo'

interface HeroPreviewProps {
  onContactClick: () => void
  onViewPreview: () => void
}

function TypingText({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const [subIndex, setSubIndex] = useState(0)
  const [reverse, setReverse] = useState(false)
  const [blink, setBlink] = useState(true)

  // Blinking cursor
  useEffect(() => {
    const timeout2 = setTimeout(() => {
      setBlink((prev) => !prev)
    }, 500)
    return () => clearTimeout(timeout2)
  }, [blink])

  // Typing logic
  useEffect(() => {
    if (index === words.length) return

    if (subIndex === words[index].length + 1 && !reverse) {
      setTimeout(() => setReverse(true), 2000) // Wait before deleting
      return
    }

    if (subIndex === 0 && reverse) {
      setReverse(false)
      setIndex((prev) => (prev + 1) % words.length)
      return
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1))
    }, Math.max(reverse ? 50 : 100, Math.random() * (reverse ? 50 : 150)))

    return () => clearTimeout(timeout)
  }, [subIndex, index, reverse, words])

  return (
    <span className="relative inline-block min-w-[120px] lg:min-w-[200px] text-left">
      <span className="text-blue-600 dark:text-blue-400 relative z-10">
        {words[index].substring(0, subIndex)}
      </span>
      <span className={`${blink ? 'opacity-100' : 'opacity-0'} ml-1 text-blue-600 dark:text-blue-400 font-light`}>|</span>
      <span className="absolute -bottom-2 left-0 w-full h-3 bg-blue-200/50 dark:bg-blue-900/50 -z-10 -rotate-2 transition-all duration-300" style={{ width: `${(subIndex / words[index].length) * 100}%` }}></span>
    </span>
  )
}

export function HeroPreview({ onContactClick, onViewPreview }: HeroPreviewProps) {
  const features = [
    'Sistemas administrativos y CRMs',
    'Webs empresariales y ecommerce',
    'Automatización de procesos',
    'Integraciones y dashboards',
  ]

  return (
    <div className="relative bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-0 pb-20 lg:pb-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text and CTA */}
          <div className="space-y-8 relative z-10">
            <div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                Gestione su Negocio con <br />
                <span className="text-blue-600 dark:text-blue-400">
                  <TypingText words={["Facturación DIAN", "CRM Inteligente", "Control de Stock", "IA de Ventas"]} />
                </span>
                <br />
                <span className="text-slate-600 dark:text-slate-400">hecho a su medida</span>
              </h1>
            </div>

            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl font-medium">
              El ERP & CRM diseñado para transformar micro y pequeñas empresas colombianas con automatización inteligente.
            </p>

            {/* Features List */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 text-lg font-medium">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-10 py-7 font-bold shadow-xl hover:shadow-blue-500/25 hover:-translate-y-1 transition-all duration-300 rounded-xl group"
                onClick={onContactClick}
              >
                Prueba gratis 14 días
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 text-lg px-8 py-7 font-semibold transition-all duration-300 rounded-xl"
                onClick={onViewPreview}
              >
                Agendar Demo
              </Button>
            </div>
          </div>

          {/* Right Side - Generated AI Hero Image */}
          <div className="relative flex justify-center items-center mt-12 lg:mt-0">
            {/* Abstract Backgrounds */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-radial from-blue-100/40 to-transparent dark:from-blue-900/20 blur-3xl pointer-events-none"></div>

            <div className="relative w-full max-w-2xl transform transition-transform hover:scale-[1.02] duration-700">
               <img 
                 src="/images/hero-dashboard.png" 
                 alt="Clivaro Hero Dashboard" 
                 className="w-full h-auto rounded-2xl shadow-2xl ring-1 ring-black/5"
               />
               
               {/* Floating elements for "premium" feel */}
               <div className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl hidden xl:block animate-bounce-slow">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                     <Check className="w-5 h-5 text-green-600" />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-gray-500 uppercase">Facturación</p>
                     <p className="text-sm font-bold text-gray-900">Validada por DIAN</p>
                   </div>
                 </div>
               </div>

               <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl hidden xl:block animate-float">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                     <Sparkles className="w-5 h-5 text-blue-600" />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-gray-500 uppercase">IA Integrada</p>
                     <p className="text-sm font-bold text-gray-900">Análisis Predictivo</p>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

