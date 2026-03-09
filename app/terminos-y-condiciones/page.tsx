'use client'

import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function TermsPage() {
    const [activeSection, setActiveSection] = useState('')

    const sections = [
        { id: 'general', title: '1. Información General' },
        { id: 'definiciones', title: '2. Definiciones' },
        { id: 'objeto', title: '3. Objeto del Contrato' },
        { id: 'planes', title: '4. Planes y Facturación' },
        { id: 'obligaciones-cliente', title: '5. Obligaciones del Cliente' },
        { id: 'obligaciones-empresa', title: '6. Obligaciones de la Empresa' },
        { id: 'propiedad', title: '7. Propiedad Intelectual' },
        { id: 'datos', title: '8. Tratamiento de Datos' },
        { id: 'confidencialidad', title: '9. Confidencialidad' },
        { id: 'responsabilidad', title: '10. Limitación de Responsabilidad' },
        { id: 'terminacion', title: '11. Suspensión y Terminación' },
        { id: 'modificaciones', title: '12. Modificaciones' },
        { id: 'legislacion', title: '13. Legislación y Resolución' },
        { id: 'contacto', title: '14. Contacto' },
    ]

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id)
                    }
                })
            },
            { threshold: 0.5 }
        )

        sections.forEach((section) => {
            const el = document.getElementById(section.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/40">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-blue-600 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Volver</span>
                            </Button>
                        </Link>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                        <Logo size="sm" />
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20" onClick={() => window.print()}>
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Descargar PDF</span>
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-12 flex flex-col lg:flex-row gap-12">
                {/* TOC Sidebar */}
                <aside className="lg:w-72 shrink-0 hidden lg:block">
                    <div className="sticky top-28 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shadow-slate-100/50 dark:shadow-none">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Tabla de Contenidos</h3>
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <Link
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeSection === section.id
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <ChevronRight className={`w-3 h-3 transition-transform ${activeSection === section.id ? 'rotate-90' : ''}`} />
                                    {section.title}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Content */}
                <article className="flex-1 max-w-3xl prose prose-slate dark:prose-invert">
                    <div className="mb-12">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1A3C6E] dark:text-blue-400 mb-4 tracking-tight">Términos y Condiciones</h1>
                        <p className="text-lg text-slate-500 font-medium mb-2">Plataforma ERP & CRM en la Nube</p>
                        <div className="flex items-center gap-3 text-sm font-semibold text-blue-600/70 dark:text-blue-400/70 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl inline-flex border border-blue-100 dark:border-blue-900/30">
                            <span>Versión 1.0</span>
                            <span className="w-1 h-1 rounded-full bg-blue-300 dark:bg-blue-700" />
                            <span>Marzo de 2026</span>
                        </div>
                    </div>

                    <div className="text-slate-700 dark:text-slate-300 space-y-12 text-justify leading-relaxed">

                        <section id="general">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">1</span>
                                Información General y Aceptación
                            </h2>
                            <p>
                                El presente documento establece los Términos y Condiciones de Uso (en adelante "Términos") que regulan el acceso y uso de la plataforma Clivaro, desarrollada y operada por **Clientum Studio SAS** (en adelante "la Empresa"), sociedad comercial constituida de conformidad con la legislación colombiana.
                            </p>
                            <p>
                                Al registrarse, acceder, o utilizar cualquier funcionalidad de la plataforma Clivaro, el usuario o la entidad que este representa (en adelante "el Cliente") manifiesta su acuerdo pleno e incondicional con los presentes Términos, los cuales tienen carácter vinculante conforme a lo dispuesto en la **Ley 527 de 1999** sobre comercio electrónico y la **Ley 1480 de 2011** (Estatuto del Consumidor).
                            </p>
                            <p>
                                Si el Cliente no acepta estos Términos en su totalidad, deberá abstenerse de usar la plataforma. El uso continuado de la misma constituye aceptación tácita de cualquier modificación que se realice con aviso previo.
                            </p>
                        </section>

                        <section id="definiciones">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">2</span>
                                Definiciones
                            </h2>
                            <ul className="space-y-4 list-none p-0">
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Plataforma**: El software Clivaro en modalidad SaaS (Software as a Service), accesible en la dirección www.clientumstudio.com.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Cliente**: Persona natural o jurídica que contrata el acceso mediante suscripción.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Usuario**: Persona natural autorizada por el Cliente para acceder al sistema.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Datos del Cliente**: Toda la información introducida o generada en la Plataforma por el Cliente.</span>
                                </li>
                            </ul>
                        </section>

                        <section id="objeto">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">3</span>
                                Objeto del Contrato
                            </h2>
                            <p>
                                Clientum Studio SAS concede al Cliente una licencia de uso no exclusiva e intransferible para acceder a la Plataforma Clivaro exclusivamente para sus actividades comerciales internas.
                            </p>
                            <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="font-bold mb-4 text-slate-900 dark:text-white">Módulos incluidos según plan:</p>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm list-none p-0">
                                    <li className="flex gap-2"><span>• Dashboard KPIs</span></li>
                                    <li className="flex gap-2"><span>• Gestión de Inventario</span></li>
                                    <li className="flex gap-2"><span>• CRM & Leads</span></li>
                                    <li className="flex gap-2"><span>• Facturación DIAN</span></li>
                                    <li className="flex gap-2"><span>• Punto de Venta (POS)</span></li>
                                    <li className="flex gap-2"><span>• Compras y Proveedores</span></li>
                                </ul>
                            </div>
                        </section>

                        <section id="planes">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">4</span>
                                Planes, Precios y Facturación
                            </h2>
                            <p>
                                La suscripción se cobra de forma mensual anticipada. Los precios indicados no incluyen el IVA del 19% aplicable en Colombia.
                            </p>
                            <ul className="space-y-2 list-none p-0">
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Starter**: $49.900 COP/mes (hasta 2 usuarios).</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Business**: $79.900 COP/mes (hasta 5 usuarios).</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>**Enterprise**: $149.900 COP/mes (hasta 15 usuarios).</span>
                                </li>
                            </ul>
                        </section>

                        <section id="obligaciones-cliente">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">5</span>
                                Obligaciones del Cliente
                            </h2>
                            <p>El Cliente se compromete a:</p>
                            <ul className="space-y-3 list-none p-0">
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Proporcionar información veraz durante el registro.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Mantener la confidencialidad de sus credenciales.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Utilizar la plataforma solo para actividades lícitas.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Cumplir con la Ley 1581 de 2012 de protección de datos.</span></li>
                            </ul>
                        </section>

                        <section id="obligaciones-empresa">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">6</span>
                                Obligaciones de la Empresa
                            </h2>
                            <p>Clientum Studio SAS se compromete a:</p>
                            <ul className="space-y-3 list-none p-0">
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Disponibilidad mínima del 99% mensual.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Medidas de seguridad técnicas adecuadas.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Backups automáticos semanales.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Soporte técnico según plan contratado.</span></li>
                            </ul>
                        </section>

                        <section id="propiedad">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">7</span>
                                Propiedad Intelectual
                            </h2>
                            <p>
                                La Plataforma Clivaro es propiedad exclusiva de Clientum Studio SAS. El Cliente solo adquiere una licencia de uso temporal. Los Datos del Cliente pertenecen exclusivamente al Cliente.
                            </p>
                        </section>

                        <section id="datos">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">8</span>
                                Tratamiento de Datos Personales
                            </h2>
                            <p>
                                Actuamos conforme a la **Ley 1581 de 2012**. Empresa actúa como Responsable del tratamiento de usuarios y como Encargado del tratamiento de los datos procesados por el Cliente.
                            </p>
                        </section>

                        <section id="contacto">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">14</span>
                                Contacto
                            </h2>
                            <p>Para consultas legales:</p>
                            <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-500/20">
                                <p className="font-bold text-xl mb-2">Clientum Studio SAS</p>
                                <p className="opacity-90 mb-4">Gerencia Legal</p>
                                <div className="space-y-2">
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold">Email:</span>
                                        <a href="mailto:legal@clivaro.com" className="underline decoration-white/30 hover:decoration-white transition-all">legal@clivaro.com</a>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold">Web:</span>
                                        <a href="https://www.clientumstudio.com" className="underline decoration-white/30 hover:decoration-white transition-all">www.clientumstudio.com</a>
                                    </p>
                                </div>
                            </div>
                        </section>

                    </div>

                    <footer className="mt-20 pt-8 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 text-center">
                        <p>© 2026 Clientum Studio SAS. Todos los derechos reservados.</p>
                        <p className="mt-1 italic">Clivaro y el logotipo de Clivaro son marcas registradas.</p>
                    </footer>
                </article>
            </main>
        </div>
    )
}
