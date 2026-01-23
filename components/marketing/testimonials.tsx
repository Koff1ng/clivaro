'use client'

import { Star, Quote } from 'lucide-react'

const testimonials = [
    {
        content: "Antes llevábamos el inventario en cuadernos y era un caos. Desde que implementamos el software, sabemos exactamente qué tenemos y qué falta. Las ventas son mucho más rápidas y mis clientes lo notan.",
        author: "Carlos Rodríguez",
        role: "Dueño de Ferretería El Martillo",
        initials: "CR",
        color: "bg-blue-600"
    },
    {
        content: "Lo que más me gusta es la facturación electrónica automática. Ya no pierdo tiempo en trámites manuales y puedo ver las ganancias del día desde mi celular. Ha sido un cambio total para mi negocio.",
        author: "Ana María Vargas",
        role: "Administradora de Depósito Central",
        initials: "AV",
        color: "bg-emerald-600"
    }
]

export function Testimonials() {
    return (
        <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
                        Historias de éxito
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Descubre cómo otros empresarios han transformado sus negocios con nuestra tecnología.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="relative p-8 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col"
                        >
                            <div className="absolute top-6 right-8 text-slate-100 dark:text-slate-800">
                                <Quote className="w-12 h-12" />
                            </div>

                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>

                            <blockquote className="flex-1 text-lg text-slate-700 dark:text-slate-300 mb-6 italic relative z-10 leading-relaxed">
                                "{testimonial.content}"
                            </blockquote>

                            <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${testimonial.color}`}>
                                    {testimonial.initials}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                        {testimonial.author}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        {testimonial.role}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
