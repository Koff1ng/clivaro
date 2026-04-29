'use client'

import { Star, Quote } from 'lucide-react'

const testimonials = [
    {
        content: "Antes llevábamos el inventario en cuadernos y era un caos. Desde que implementamos Clivaro, sabemos exactamente qué tenemos. La integración con la DIAN nos ahorra horas de trabajo cada semana.",
        author: "Carlos Rodríguez",
        role: "Gerente de Operaciones, Ferretería El Martillo",
        img: "/professional_latino_business_avatar_1_1773058708279.png",
        color: "bg-blue-600"
    },
    {
        content: "Lo que más me gusta es el CRM con IA. El sistema nos avisa cuándo recontactar clientes y la facturación es instantánea. Ha sido el mejor aliado para expandir mi depósito este año.",
        author: "Ana María Vargas",
        role: "Directora General, Logística Central S.A.S",
        img: "/professional_latina_business_avatar_2_1773058720074.png",
        color: "bg-emerald-600"
    }
]

export function Testimonials() {
    return (
        <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
                        Confianza de líderes del sector
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Empresas que ya están escalando su operación con la inteligencia de Clivaro.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="relative p-8 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col"
                        >
                            <div className="absolute top-6 right-8 text-slate-100 dark:text-slate-200/10">
                                <Quote className="w-12 h-12" />
                            </div>

                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                ))}
                            </div>

                            <blockquote className="flex-1 text-lg text-slate-700 dark:text-slate-300 mb-8 font-medium italic relative z-10 leading-relaxed">
                                "{testimonial.content}"
                            </blockquote>

                            <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
                                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-100 shrink-0">
                                    <img
                                        src={testimonial.img}
                                        alt={testimonial.author}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
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
