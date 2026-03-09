'use client'

import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, ChevronRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function PrivacyPage() {
    const [activeSection, setActiveSection] = useState('')

    const sections = [
        { id: 'identificacion', title: '1. Identificación' },
        { id: 'marco', title: '2. Marco Legal' },
        { id: 'definiciones', title: '3. Definiciones' },
        { id: 'datos', title: '4. Datos Recopilados' },
        { id: 'finalidades', title: '5. Finalidades' },
        { id: 'autorizacion', title: '6. Autorización' },
        { id: 'derechos', title: '7. Derechos ARCO' },
        { id: 'procedimiento', title: '8. Procedimiento' },
        { id: 'transferencia', title: '9. Transferencia' },
        { id: 'seguridad', title: '10. Seguridad' },
        { id: 'cookies', title: '11. Cookies' },
        { id: 'conservacion', title: '12. Conservación' },
        { id: 'menores', title: '13. Menores de Edad' },
        { id: 'contacto', title: '15. Contacto' },
    ]

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) setActiveSection(entry.target.id)
            })
        }, { threshold: 0.5 })

        sections.forEach(section => {
            const el = document.getElementById(section.id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/40">
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
                <aside className="lg:w-72 shrink-0 hidden lg:block">
                    <div className="sticky top-28 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shadow-slate-100/50 dark:shadow-none">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Navegación</h3>
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

                <article className="flex-1 max-w-3xl prose prose-slate dark:prose-invert">
                    <div className="mb-12">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm mb-4 uppercase tracking-widest">
                            <ShieldCheck className="w-5 h-5" />
                            Cumplimiento Ley 1581 de 2012
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1A3C6E] dark:text-blue-400 mb-4 tracking-tight">Política de Privacidad</h1>
                        <p className="text-lg text-slate-500 font-medium mb-2">Tratamiento de Datos Personales</p>
                        <div className="flex items-center gap-3 text-sm font-semibold text-blue-600/70 dark:text-blue-400/70 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl inline-flex border border-blue-100 dark:border-blue-900/30">
                            <span>Versión 1.0</span>
                            <span className="w-1 h-1 rounded-full bg-blue-300 dark:bg-blue-700" />
                            <span>Marzo de 2026</span>
                        </div>
                    </div>

                    <div className="text-slate-700 dark:text-slate-300 space-y-12 text-justify leading-relaxed">

                        <section id="identificacion">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">1</span>
                                Identificación del Responsable
                            </h2>
                            <p>
                                **Clientum Studio SAS** (en adelante "la Empresa"), propietaria de la plataforma Clivaro, actúa como Responsable del Tratamiento de los datos personales recopilados.
                            </p>
                            <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm">
                                <ul className="space-y-2 list-none p-0 m-0">
                                    <li>**Razón Social**: Clientum Studio SAS</li>
                                    <li>**Domicilio**: Colombia</li>
                                    <li>**Email ARCO**: datospersonales@clivaro.com</li>
                                    <li>**Web**: www.clientumstudio.com</li>
                                </ul>
                            </div>
                        </section>

                        <section id="marco">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">2</span>
                                Marco Legal
                            </h2>
                            <p>Esta política se rige por:</p>
                            <ul className="space-y-3 list-none p-0">
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Constitución Política de Colombia (Art. 15).</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Ley 1581 de 2012 (Protección de Datos).</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Decreto 1377 de 2013 (Reglamentación).</span></li>
                            </ul>
                        </section>

                        <section id="datos">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">4</span>
                                Datos Personales que se Recopilan
                            </h2>
                            <p>Recopilamos datos de clientes y usuarios con el fin de prestar el servicio ERP:</p>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
                                <li className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-blue-600 text-sm mb-1">Identificación</p>
                                    <p className="text-xs text-slate-500">Nombre, NIT, Cédula.</p>
                                </li>
                                <li className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-blue-600 text-sm mb-1">Contacto</p>
                                    <p className="text-xs text-slate-500">Email, Teléfono, Dirección.</p>
                                </li>
                                <li className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-blue-600 text-sm mb-1">Técnicos</p>
                                    <p className="text-xs text-slate-500">IP, Cookies, Logs de actividad.</p>
                                </li>
                                <li className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-blue-600 text-sm mb-1">Seguridad</p>
                                    <p className="text-xs text-slate-500">Credenciales (Hash) y Roles.</p>
                                </li>
                            </ul>
                        </section>

                        <section id="finalidades">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">5</span>
                                Finalidades del Tratamiento
                            </h2>
                            <ul className="space-y-3 list-none p-0">
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Administración de cuentas y soporte técnico.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Facturación y gestión de cobros.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Cumplimiento de obligaciones legales ante la DIAN.</span></li>
                                <li className="flex gap-3"><span className="text-blue-600 font-bold">•</span><span>Envío de comunicaciones comerciales (bajo previa autorización).</span></li>
                            </ul>
                        </section>

                        <section id="derechos">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">7</span>
                                Derechos de los Titulares (ARCO)
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Acceso</p>
                                    <p className="text-xs">Conocer qué datos tratamos.</p>
                                </div>
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Rectificación</p>
                                    <p className="text-xs">Corregir datos inexactos.</p>
                                </div>
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Supresión</p>
                                    <p className="text-xs">Eliminar datos (si no hay ley que lo prohíba).</p>
                                </div>
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Oposición</p>
                                    <p className="text-xs">Revocar autorizaciones de marketing.</p>
                                </div>
                            </div>
                        </section>

                        <section id="seguridad">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">10</span>
                                Seguridad de los Datos
                            </h2>
                            <p>
                                Implementamos cifrado TLS/SSL, hashing de contraseñas, auditoría continua y backups cifrados para proteger su información.
                            </p>
                        </section>

                        <section id="contacto">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">15</span>
                                Contacto y Atención
                            </h2>
                            <div className="bg-slate-900 text-white p-8 rounded-3xl">
                                <p className="font-bold mb-4">Canales oficiales SIC:</p>
                                <ul className="space-y-4 list-none p-0 text-sm">
                                    <li className="flex flex-col">
                                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Email Privacidad</span>
                                        <a href="mailto:datospersonales@clivaro.com" className="text-blue-400 font-medium hover:underline">datospersonales@clivaro.com</a>
                                    </li>
                                    <li className="flex flex-col">
                                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Email Legal</span>
                                        <a href="mailto:legal@clivaro.com" className="text-blue-400 font-medium hover:underline">legal@clivaro.com</a>
                                    </li>
                                </ul>
                            </div>
                        </section>

                    </div>

                    <footer className="mt-20 pt-8 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 text-center">
                        <p>© 2026 Clientum Studio SAS. Registro Nacional de Bases de Datos.</p>
                    </footer>
                </article>
            </main>
        </div>
    )
}
