'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { SoftwarePreview } from './software-preview'

interface HeroPreviewProps {
  onContactClick: () => void
  onViewPreview: () => void
}

export function HeroPreview({ onContactClick, onViewPreview }: HeroPreviewProps) {
  const features = [
    'Sistemas administrativos y CRMs',
    'Webs empresariales y ecommerce',
    'Automatización de procesos',
    'Integraciones y dashboards',
  ]

  return (
    <div className="relative bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text and CTA */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
                Impulsa tu negocio con{' '}
                <span className="text-blue-600 dark:text-blue-400">software</span>{' '}
                <span className="text-blue-500 dark:text-blue-300">hecho a tu medida</span>
              </h1>
            </div>
            
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              Creamos sistemas web, CRMs y plataformas empresariales que simplifican tu operación y aumentan tus resultados.
            </p>

            {/* Features List */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 text-lg">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg px-8 py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={onContactClick}
              >
                Solicitar demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-lg px-8 py-6 font-semibold transition-all duration-300"
                onClick={onViewPreview}
              >
                Ver proyectos
              </Button>
            </div>
          </div>

          {/* Right Side - Software Preview on Monitor */}
          <div className="relative">
            {/* Monitor Frame */}
            <div className="relative bg-gray-800 rounded-lg p-2 shadow-2xl">
              {/* Monitor Bezel */}
              <div className="bg-gray-900 rounded-t-lg p-1">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
              </div>
              
              {/* Screen Content */}
              <div className="bg-white dark:bg-gray-800 rounded-b-lg overflow-hidden">
                <div className="h-[500px] overflow-hidden">
                  <div className="flex h-full">
                    {/* Sidebar */}
                    <div className="w-48 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Clivaro</div>
                      </div>
                      <nav className="flex-1 p-2 space-y-1 text-xs">
                        {['Dashboard', 'Productos', 'Inventario', 'Clientes', 'Oportunidades', 'Cotizaciones', 'Facturas', 'Punto de Venta', 'Caja'].map((item, i) => (
                          <div
                            key={i}
                            className={`px-2 py-1.5 rounded ${
                              i === 0
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </nav>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-4 bg-white dark:bg-gray-800 overflow-y-auto">
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dashboard</h2>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Resumen general</p>
                        </div>
                        
                        {/* KPIs */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingresos</div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">$ 125,430</div>
                          </div>
                          <div className="bg-cyan-50 dark:bg-cyan-900/20 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancias</div>
                            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">$ 96,850</div>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cobranza</div>
                            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">$ 8,420</div>
                          </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Últimos 30 días</div>
                          <div className="h-32 flex items-end justify-between gap-1">
                            {[20, 35, 25, 40, 30, 45, 50, 60, 55, 48, 52, 58, 62, 55, 50, 45, 40, 35, 30, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75].map((value, i) => (
                              <div
                                key={i}
                                className="flex-1 bg-blue-600 rounded-t"
                                style={{ height: `${value}%` }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Lists */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top clientes</div>
                            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <div>Cliente A - $422,000</div>
                              <div>Cliente B - $120,000</div>
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Productos</div>
                            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <div>Producto 1 - $529,000</div>
                              <div>Producto 2 - $107,000</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -z-10 top-10 -right-10 w-72 h-72 bg-blue-200/30 dark:bg-blue-900/20 rounded-full blur-3xl"></div>
            <div className="absolute -z-10 bottom-10 -left-10 w-72 h-72 bg-indigo-200/30 dark:indigo-900/20 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

