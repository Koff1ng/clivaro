'use client'

import {
    HardwareIcon,
    PaintIcon,
    ConstructionIcon,
    ElectricalIcon,
    LocksmithIcon,
    PlumbingIcon
} from '@/components/marketing/custom-icons'

const features = [
    {
        title: 'Ferretería',
        description: 'Maneja fácil tu inventario',
        icon: HardwareIcon,
        color: '#0ea5e9', // cyan-500
    },
    {
        title: 'Pinturas',
        description: 'Gestiona mezclas y colores',
        icon: PaintIcon,
        color: '#ec4899', // pink-500
    },
    {
        title: 'Construcción',
        description: 'Control de stock por volumen',
        icon: ConstructionIcon,
        color: '#ea580c', // orange-600
    },
    {
        title: 'Eléctricos',
        description: 'Organiza cables y accesorios',
        icon: ElectricalIcon,
        color: '#eab308', // yellow-500
    },
    {
        title: 'Cerrajería',
        description: 'Servicios de duplicado',
        icon: LocksmithIcon,
        color: '#8b5cf6', // violet-500
    },
    {
        title: 'Plomería',
        description: 'Control de tubos y repuestos',
        icon: PlumbingIcon,
        color: '#06b6d4', // cyan-500
    },
]

export function BusinessTypes() {
    return (
        <section className="py-24 bg-white dark:bg-slate-950">
            <div className="container px-4 md:px-6 mx-auto">

                {/* Optional Header - kept minimal or removed to match image style purely, 
            but kept for context as this is a landing page section */}
                {/* <div className="text-center max-w-3xl mx-auto mb-16">
           ... 
        </div> */}

                {/* 
          Reference Style:
          - White card (shadow/border)
          - Icon left (large)
          - Title bold, Description small gray
        */}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="group relative p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4"
                        >
                            {/* Icon Container - Fixed size */}
                            <div className="flex-shrink-0">
                                <feature.icon
                                    className="w-16 h-16 group-hover:scale-105 transition-transform duration-300"
                                    accentColor={feature.color}
                                />
                            </div>

                            {/* Text Content */}
                            <div className="flex flex-col pt-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
