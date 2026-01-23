'use client'

import { SpotlightCard } from '@/components/ui/spotlight-card'
import { Hammer, PaintBucket, Wrench, Lightbulb, Key, Droplets } from 'lucide-react'

const features = [
    {
        title: 'Ferretería General',
        description: 'Maneja fácil tu inventario de herramientas y materiales.',
        icon: Hammer,
        color: '#3b82f6', // blue-500
    },
    {
        title: 'Pinturas y Acabados',
        description: 'Gestiona mezclas, colores y presentaciones por litro o galón.',
        icon: PaintBucket,
        color: '#ec4899', // pink-500
    },
    {
        title: 'Materiales de Construcción',
        description: 'Control de stock para ventas por volumen y unidad.',
        icon: Wrench,
        color: '#ea580c', // orange-600
    },
    {
        title: 'Eléctricos e Iluminación',
        description: 'Organiza cables, bombillos y accesorios por referencia.',
        icon: Lightbulb,
        color: '#eab308', // yellow-500
    },
    {
        title: 'Cerrajería',
        description: 'Servicios de duplicado y venta de cerraduras.',
        icon: Key,
        color: '#8b5cf6', // violet-500
    },
    {
        title: 'Plomería y Grifería',
        description: 'Control detallado de tubos, accesorios y repuestos.',
        icon: Droplets,
        color: '#06b6d4', // cyan-500
    },
]

export function BusinessTypes() {
    return (
        <section className="py-24 bg-white dark:bg-slate-950">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
                        Ideal para tu negocio
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Nuestra plataforma se adapta a las necesidades específicas de tu sector,
                        ayudándote a optimizar cada venta.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <SpotlightCard
                            key={feature.title}
                            className="p-8 h-full flex flex-col gap-4 group hover:border-blue-500/50 transition-colors"
                            spotlightColor={feature.color}
                        >
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-110 duration-300"
                                style={{ backgroundColor: `${feature.color}15` }}
                            >
                                <feature.icon
                                    className="w-6 h-6"
                                    style={{ color: feature.color }}
                                />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </SpotlightCard>
                    ))}
                </div>
            </div>
        </section>
    )
}
