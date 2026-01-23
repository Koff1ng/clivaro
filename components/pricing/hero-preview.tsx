'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { SoftwarePreview } from './software-preview'

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
    <div className="relative bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-20 lg:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text and CTA */}
          <div className="space-y-8 relative z-10">
            <div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                Impulsa tu negocio con{' '}
                <br className="lg:hidden" />
                <TypingText words={["POS", "Sistemas CRM", "Plataforma ERP", "Facturacion Electronica"]} />
                <br />
                <span className="text-slate-700 dark:text-slate-300">hecho a tu medida</span>
              </h1>
            </div>

            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
              Creamos sistemas web, CRMs y plataformas empresariales que simplifican tu operación y aumentan tus resultados.
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
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-xl"
                onClick={onContactClick}
              >
                Solicitar demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 text-lg px-8 py-6 font-semibold transition-all duration-300 rounded-xl"
                onClick={onViewPreview}
              >
                Ver proyectos
              </Button>
            </div>
          </div>

          {/* Right Side - Software Preview on Monitor */}
          <div className="relative">
            {/* Abstract Backgrounds */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-radial from-blue-100/40 to-transparent dark:from-blue-900/20 blur-3xl pointer-events-none"></div>

            {/* Monitor Frame */}
            <div className="relative bg-slate-950 rounded-xl p-2 shadow-2xl ring-1 ring-white/10 transform transition-transform hover:scale-[1.01] duration-500">
              {/* Monitor Bezel */}
              <div className="bg-slate-950 rounded-t-lg p-1 border-b border-white/5">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
                  </div>
                  <div className="mx-auto bg-slate-800/50 rounded-md px-3 py-0.5 text-[10px] text-slate-500 font-medium font-mono hidden sm:block">
                    clivaro.com/dashboard
                  </div>
                </div>
              </div>

              {/* Screen Content */}
              <div className="bg-white dark:bg-gray-800 rounded-b-lg overflow-hidden relative">
                {/* Glass Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none z-20"></div>

                <div className="h-[500px] overflow-hidden">
                  <div className="flex h-full">
                    {/* Sidebar */}
                    <div className="w-48 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">C</div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">Clivaro</div>
                        </div>
                      </div>
                      <nav className="flex-1 p-3 space-y-1">
                        {['Dashboard', 'Productos', 'Inventario', 'Clientes', 'Oportunidades', 'Cotizaciones', 'Facturas', 'Punto de Venta'].map((item, i) => (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${i === 0
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                          >
                            {item}
                          </div>
                        ))}
                      </nav>
                      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                          <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 text-xs">J</div>
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Juan Pérez</div>
                        </div>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 bg-white dark:bg-slate-950 p-6 overflow-y-auto">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Resumen de actividad hoy</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-900 rounded-md"></div>
                            <div className="h-8 w-8 bg-blue-600 rounded-md"></div>
                          </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-md bg-green-100 text-green-600"><div className="h-3 w-3" /></div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ingresos</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">$125.4k</div>
                            <div className="text-xs text-green-600 font-medium mt-1">+12.5% vs mes anterior</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-md bg-blue-100 text-blue-600"><div className="h-3 w-3" /></div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ventas</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">1,429</div>
                            <div className="text-xs text-blue-600 font-medium mt-1">+8.2% vs mes anterior</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-md bg-orange-100 text-orange-600"><div className="h-3 w-3" /></div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Clientes</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">842</div>
                            <div className="text-xs text-orange-600 font-medium mt-1">+2.1% nuevos</div>
                          </div>
                        </div>

                        {/* Chart Area */}
                        <div className="grid grid-cols-3 gap-4 h-64">
                          <div className="col-span-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-4 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rendimiento de Ventas</div>
                            </div>
                            <div className="absolute inset-x-4 bottom-4 top-12 flex items-end justify-between gap-1">
                              {[30, 45, 35, 55, 45, 60, 50, 65, 55, 70, 60, 75, 80, 70, 85, 90, 80, 95].map((h, i) => (
                                <div key={i} className="flex-1 bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-sm opacity-90 hover:opacity-100 transition-opacity" style={{ height: `${h}%` }}></div>
                              ))}
                            </div>
                          </div>
                          <div className="col-span-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Actividad</div>
                            <div className="space-y-3">
                              {[1, 2, 3, 4].map((_, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                                  <div>
                                    <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded-full mb-1"></div>
                                    <div className="h-1.5 w-8 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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

