'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight, Zap } from 'lucide-react'

interface HeroPreviewProps {
  onContactClick: () => void
  onViewPreview: () => void
}

/* ─── Typing effect with smooth cursor ─── */
function TypingText({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const [subIndex, setSubIndex] = useState(0)
  const [reverse, setReverse] = useState(false)

  useEffect(() => {
    if (index === words.length) return

    if (subIndex === words[index].length + 1 && !reverse) {
      setTimeout(() => setReverse(true), 2200)
      return
    }

    if (subIndex === 0 && reverse) {
      setReverse(false)
      setIndex((prev) => (prev + 1) % words.length)
      return
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1))
    }, Math.max(reverse ? 40 : 80, Math.random() * (reverse ? 40 : 120)))

    return () => clearTimeout(timeout)
  }, [subIndex, index, reverse, words])

  return (
    <span className="relative inline-block min-w-[140px] lg:min-w-[220px] text-left">
      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        {words[index].substring(0, subIndex)}
      </span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
        className="ml-0.5 text-blue-600"
      >
        |
      </motion.span>
      <motion.span
        className="absolute -bottom-1 left-0 h-2.5 bg-blue-200/40 dark:bg-blue-800/40 -z-10 rounded-full"
        animate={{ width: `${(subIndex / (words[index].length || 1)) * 100}%` }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />
    </span>
  )
}

/* ─── Stagger container + child variants ─── */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
}

const fadeRight = {
  hidden: { opacity: 0, x: 60, scale: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.8, ease: 'easeOut' as const },
  },
}

const featureItemVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

/* ─── Real features Clivaro offers ─── */
const heroFeatures = [
  'Facturación electrónica DIAN certificada',
  'Punto de Venta (POS) con control de caja',
  'Inventario multi-bodega en tiempo real',
  'CRM con pipeline de leads y Kanban',
  'Módulo de restaurante (mesas y pedidos)',
  'Reportes y dashboard con KPIs en vivo',
]

export function HeroPreview({ onContactClick, onViewPreview }: HeroPreviewProps) {
  return (
    <div className="relative bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-0 pb-20 lg:pb-32 overflow-hidden">
      {/* Subtle animated background blobs */}
      <motion.div
        className="absolute top-20 -left-32 w-96 h-96 bg-blue-200/30 dark:bg-blue-900/20 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-200/20 dark:bg-indigo-900/15 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [0, -30, 0], y: [0, 25, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left Side — Text + CTA */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                <Zap className="w-3.5 h-3.5" />
                ERP & CRM #1 en Colombia
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div variants={fadeUp}>
              <h1 className="text-4xl lg:text-5xl xl:text-[3.5rem] font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.1]">
                El software que tu{' '}
                <br className="hidden sm:block" />
                negocio necesita para{' '}
                <br className="hidden sm:block" />
                <TypingText words={['Facturar con la DIAN', 'Vender más rápido', 'Controlar stock', 'Gestionar clientes']} />
              </h1>
            </motion.div>

            {/* Description */}
            <motion.p
              variants={fadeUp}
              className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl"
            >
              Plataforma todo-en-uno para micro y pequeñas empresas colombianas.
              Facturación electrónica, inventario, POS, CRM y más — desde{' '}
              <span className="font-bold text-blue-600">$79.900/mes</span>.
            </motion.p>

            {/* Features Grid */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {heroFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={featureItemVariant}
                  className="flex items-center gap-2.5"
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{feature}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-10 py-7 font-bold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-300 rounded-xl group"
                onClick={onContactClick}
              >
                Prueba gratis 14 días
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 text-lg px-8 py-7 font-semibold transition-all duration-300 rounded-xl"
                onClick={onViewPreview}
              >
                Ver Planes
              </Button>
            </motion.div>

            {/* Social proof */}
            <motion.p variants={fadeUp} className="text-xs text-slate-400 font-medium">
              ✓ Sin tarjeta de crédito · ✓ Configuración en minutos · ✓ Soporte en español
            </motion.p>
          </motion.div>

          {/* Right Side — 3D Mascot */}
          <motion.div
            variants={fadeRight}
            initial="hidden"
            animate="visible"
            className="relative flex justify-center items-center mt-8 lg:mt-0"
          >
            {/* Glow behind mascot */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-radial from-blue-200/50 to-transparent dark:from-blue-900/30 blur-3xl pointer-events-none" />

            <motion.div
              className="relative w-full max-w-lg"
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <motion.img
                src="/assets/3d/hero-mascot.png"
                alt="Clivaro - Tu ERP Inteligente"
                className="w-full h-auto drop-shadow-2xl"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
