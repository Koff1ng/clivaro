'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Mail,
  Settings,
  BookOpen,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X
} from 'lucide-react'

const screens = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, src: '/assets/images_ERP/Dashboard.png', color: 'from-blue-500 to-cyan-500' },
  { id: 'facturas', label: 'Facturación', icon: FileText, src: '/assets/images_ERP/Facturas.png', color: 'from-indigo-500 to-purple-500' },
  { id: 'inventario', label: 'Inventario', icon: Package, src: '/assets/images_ERP/inventario.png', color: 'from-emerald-500 to-teal-500' },
  { id: 'items', label: 'Productos', icon: Layers, src: '/assets/images_ERP/items.png', color: 'from-orange-500 to-amber-500' },
  { id: 'contabilidad', label: 'Contabilidad', icon: BookOpen, src: '/assets/images_ERP/contabilidad.png', color: 'from-violet-500 to-fuchsia-500' },
  { id: 'reportes', label: 'Reportes', icon: BarChart3, src: '/assets/images_ERP/Reportes.png', color: 'from-rose-500 to-pink-500' },
  { id: 'campanas', label: 'Marketing', icon: Mail, src: '/assets/images_ERP/campanas_email.png', color: 'from-sky-500 to-blue-500' },
  { id: 'configuracion', label: 'Configuración', icon: Settings, src: '/assets/images_ERP/configuracion.png', color: 'from-slate-500 to-gray-600' },
]

export function SoftwarePreview() {
  const [active, setActive] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Auto-rotate every 4 seconds
  useEffect(() => {
    if (isPaused || isFullscreen) return
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % screens.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isPaused, isFullscreen])

  const goTo = useCallback((idx: number) => {
    setActive(idx)
    setIsPaused(true)
    // Resume auto-rotation after 8s of inactivity
    setTimeout(() => setIsPaused(false), 8000)
  }, [])

  const prev = () => goTo((active - 1 + screens.length) % screens.length)
  const next = () => goTo((active + 1) % screens.length)

  const currentScreen = screens[active]

  return (
    <>
      <div className="relative py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-blue-100 text-blue-700">Vista Real</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Conoce Clivaro por dentro
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Capturas reales de nuestra plataforma. Sin maquetas, sin renders — así es como se ve tu nuevo ERP.
            </p>
          </div>

          {/* Tab Nav */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex flex-wrap justify-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
              {screens.map((s, idx) => {
                const Icon = s.icon
                const isActive = idx === active
                return (
                  <button
                    key={s.id}
                    onClick={() => goTo(idx)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-white shadow-lg shadow-blue-500/10 text-blue-700 scale-105'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Gallery Frame */}
          <div
            className="relative group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Glow effect */}
            <div className={cn(
              'absolute -inset-1 rounded-2xl opacity-30 blur-xl transition-all duration-700 bg-gradient-to-r',
              currentScreen.color
            )} />

            {/* Browser chrome */}
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white border border-slate-200 rounded-lg px-4 py-1 text-xs text-slate-400 text-center max-w-md mx-auto">
                    <span className="text-green-500 mr-1">🔒</span>
                    clivaro.app/{currentScreen.id}
                  </div>
                </div>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                  title="Pantalla completa"
                >
                  <Maximize2 className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Screenshot container */}
              <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                {screens.map((s, idx) => (
                  <img
                    key={s.id}
                    src={s.src}
                    alt={`Clivaro ${s.label}`}
                    className={cn(
                      'absolute inset-0 w-full h-full object-cover object-top transition-all duration-700',
                      idx === active
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-105'
                    )}
                    loading={idx < 2 ? 'eager' : 'lazy'}
                  />
                ))}

                {/* Navigation arrows */}
                <button
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/50 hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/50 hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Current label */}
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 text-white">
                    <div className="flex items-center gap-2">
                      <currentScreen.icon className="w-5 h-5" />
                      <span className="font-bold">{currentScreen.label}</span>
                    </div>
                  </div>

                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {screens.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          idx === active
                            ? 'w-6 bg-white'
                            : 'w-1.5 bg-white/40 hover:bg-white/70'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={currentScreen.src}
              alt={`Clivaro ${currentScreen.label}`}
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            />

            {/* Fullscreen nav */}
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Bottom label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-3 text-white flex items-center gap-3">
              <currentScreen.icon className="w-5 h-5" />
              <span className="font-bold">{currentScreen.label}</span>
              <span className="text-white/50">|</span>
              <span className="text-sm text-white/60">{active + 1} / {screens.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
