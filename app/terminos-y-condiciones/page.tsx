'use client'

import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, ChevronRight, ShieldCheck, Scale, FileText, Lock, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function TermsPage() {
    const [activeSection, setActiveSection] = useState('')

    const sections = [
        { id: 'preambulo', title: 'Preámbulo y Aceptación', icon: ShieldCheck },
        { id: 'identidad', title: '1. Identidad de las Partes', icon: UserCheck },
        { id: 'objeto', title: '2. Objeto y Licencia', icon: FileText },
        { id: 'suscripcion', title: '3. Suscripción y Pagos', icon: Scale },
        { id: 'datos', title: '4. Protección de Datos (Ley 1581)', icon: Lock },
        { id: 'responsabilidad', title: '5. Responsabilidades', icon: ShieldCheck },
        { id: 'propiedad', title: '6. Propiedad Intelectual', icon: FileText },
        { id: 'ley', title: '7. Ley Aplicable y Jurisdicción', icon: Scale },
        { id: 'contacto', title: '8. Contacto y Notificaciones', icon: UserCheck },
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
            { threshold: 0.2 }
        )

        sections.forEach((section) => {
            const el = document.getElementById(section.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [])

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    const handleDownloadPdf = async () => {
        try {
            setIsGeneratingPdf(true)
            
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(style => style.outerHTML)
                .join('\n')

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="es" class="light">
                <head>
                    <meta charset="UTF-8">
                    ${styles}
                    <style>
                        body { background: white !important; padding: 60px !important; }
                        .print-hidden, button, .no-print, nav, header, aside { display: none !important; }
                        article { max-width: 100% !important; margin: 0 !important; }
                    </style>
                </head>
                <body class="bg-white">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="font-size: 32px; font-weight: 800;">Términos y Condiciones de Uso</h1>
                        <p style="color: #64748b;">Clivaro - Clientum Studio SAS</p>
                    </div>
                    ${document.querySelector('article')?.innerHTML || document.body.innerHTML}
                </body>
                </html>
            `

            const res = await fetch('/api/pdf/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: htmlContent,
                    filename: 'terminos_y_condiciones_clivaro'
                })
            })

            if (!res.ok) throw new Error('PDF generation failed')

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            
            const link = document.createElement('a')
            link.href = url
            link.download = `terminos_y_condiciones_clivaro.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.open(url, '_blank')
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('Error generando el PDF legal.')
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/40">
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
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20" 
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                    >
                        {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isGeneratingPdf ? 'Generando...' : 'Descargar PDF Legal'}</span>
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-12 flex flex-col lg:flex-row gap-12">
                {/* TOC Sidebar */}
                <aside className="lg:w-80 shrink-0 hidden lg:block">
                    <div className="sticky top-28 p-8 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm shadow-slate-100/50">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Estructura Legal</h3>
                        <nav className="space-y-2">
                            {sections.map((section) => (
                                <Link
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeSection === section.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 -translate-x-1'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <section.icon className={`w-4 h-4 ${activeSection === section.id ? 'text-white' : 'text-slate-400'}`} />
                                    {section.title}
                                </Link>
                            ))}
                        </nav>
                        
                        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Representante Legal</p>
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-tight">Juan Jose Trujillo Agamez</p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase">C.C. 1003.401.790</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Content */}
                <article className="flex-1 max-w-3xl prose prose-slate dark:prose-invert prose-headings:font-black prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-relaxed prose-strong:text-blue-600 dark:prose-strong:text-blue-400">
                    <div className="mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 mb-6">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Documento Oficial Vinculante</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight !leading-[1.1]">
                            Términos y <br />
                            <span className="text-blue-600">Condiciones de Uso</span>
                        </h1>
                        <p className="text-xl text-slate-500 font-medium max-w-xl">
                            Regulaciones aplicables a la plataforma SaaS Clivaro conforme a la legislación de la República de Colombia.
                        </p>
                    </div>

                    <div className="space-y-20">

                        <section id="preambulo" className="scroll-mt-28">
                            <p className="text-lg font-medium italic">
                                Por favor, lea atentamente este Contrato. Al acceder o utilizar Clivaro, usted acepta quedar vinculado legalmente por estos términos.
                            </p>
                            <p>
                                El presente documento constituye un contrato legalmente vinculante entre **Clientum Studio SAS** y cualquier persona natural o jurídica que acceda o utilice la plataforma Clivaro. El uso de la plataforma constituye la aceptación incondicional de estos términos en virtud de la **Ley 527 de 1999** sobre comercio electrónico.
                            </p>
                        </section>

                        <section id="identidad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">1. Identidad de las Partes</h2>
                            <p>
                                **LA EMPRESA**: **Clientum Studio SAS**, sociedad debidamente constituida en Colombia, actuando a través de su Gerente y Representante Legal, **Juan Jose Trujillo Agamez**, identificado con **C.C. 1003.401.790**.
                            </p>
                            <p>
                                **EL CLIENTE**: Persona natural o jurídica que adquiere la suscripción al software para la gestión de su actividad comercial. El Cliente garantiza que la información proporcionada al registro es veraz y actual.
                            </p>
                        </section>

                        <section id="objeto" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">2. Objeto y Licencia</h2>
                            <p>
                                **Clivaro** concede una licencia de uso de software bajo el modelo **SaaS (Software as a Service)**. Esta licencia es no exclusiva, intransferible y está limitada al periodo de suscripción vigente.
                            </p>
                            <p>
                                El software es una herramienta de gestión (ERP & CRM) que incluye funcionalidades de **Facturación Electrónica DIAN**, control de inventarios, POS y CRM con analítica predictiva. La licencia no otorga propiedad sobre el código fuente ni los algoritmos del sistema.
                            </p>
                        </section>

                        <section id="suscripcion" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">3. Suscripción y Pagos</h2>
                            <p>
                                **OBLIGACIÓN DE PAGO**: El Cliente se obliga al pago del canon de suscripción mensual o anual de forma anticipada. El incumplimiento del pago generará la **suspensión automática** del servicio transcurridos cinco (5) días calendario desde la fecha de vencimiento.
                            </p>
                            <p>
                                **VALIDEZ FISCAL**: Todas las facturas de suscripción serán emitidas electrónicamente conforme a los requerimientos de la DIAN. Los cargos por impuestos (IVA) se detallarán por separado según la normativa vigente en Colombia.
                            </p>
                        </section>

                        <section id="datos" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">4. Protección de Datos (Ley 1581)</h2>
                            <p>
                                En cumplimiento de la **Ley 1581 de 2012** y el **Decreto 1377 de 2013**, Clientum Studio SAS actúa como:
                            </p>
                            <ul className="list-none p-0 space-y-4">
                                <li className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-l-4 border-blue-600">
                                    **Responsable del Tratamiento**: Respecto a los datos personales de los Clientes (Nombres, Cédulas, Rut, Email corporativo).
                                </li>
                                <li className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-l-4 border-indigo-600">
                                    **Encargado del Tratamiento**: Respecto a los datos personales que el Cliente cargue en la plataforma (Base de datos de sus propios clientes y proveedores).
                                </li>
                            </ul>
                            <p>
                                El Cliente garantiza que cuenta con la **autorización expresa** de los titulares cuyos datos cargue en Clivaro.
                            </p>
                        </section>

                        <section id="responsabilidad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">5. Responsabilidades</h2>
                            <p>
                                **CONTINUIDAD DEL SERVICIO**: Clivaro garantiza un uptime del **99.5%**. No obstante, la Empresa no se hace responsable por interrupciones derivadas de fallos en proveedores de internet del Cliente o por infraestructuras de terceros como nubes públicas (AWS/Google/Azure).
                            </p>
                            <p>
                                **PRECISIÓN TRIBUTARIA**: Aunque Clivaro facilita la facturación DIAN, la veracidad de la información enviada a la autoridad tributaria es **responsabilidad exclusiva del Cliente**. La Empresa no asesora contablemente ni legalmente al usuario.
                            </p>
                        </section>

                        <section id="propiedad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">6. Propiedad Intelectual</h2>
                            <p>
                                Todos los derechos de propiedad intelectual sobre Clivaro, incluyendo logos, interfaz, algoritmos y marcas, son propiedad de **Clientum Studio SAS**. Cualquier intento de ingeniería inversa o copia no autorizada será perseguido según la **Ley 44 de 1993**.
                            </p>
                        </section>

                        <section id="ley" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">7. Ley Aplicable</h2>
                            <p>
                                El presente Contrato se rige íntegramente por las leyes de la **República de Colombia**. Cualquier controversia será resuelta preferiblemente por un Centro de Conciliación en la ciudad de Cali, y en su defecto, por los jueces ordinarios.
                            </p>
                        </section>

                        <section id="contacto" className="scroll-mt-28 mb-20">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">8. Contacto</h2>
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-black mb-6">Clientum Studio SAS</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <p className="text-sm font-bold opacity-70 uppercase tracking-widest">Atención a Clientes</p>
                                            <p className="flex flex-col">
                                                <span className="text-xs opacity-60">Email Directo:</span>
                                                <a href="mailto:gerencia@clientumstudio.com" className="text-lg font-bold hover:underline">gerencia@clientumstudio.com</a>
                                            </p>
                                            <p className="flex flex-col">
                                                <span className="text-xs opacity-60">WhatsApp Gerencia:</span>
                                                <a href="https://wa.me/573113524794" className="text-lg font-bold hover:underline">+57 311 3524794</a>
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-sm font-bold opacity-70 uppercase tracking-widest">Sede Principal</p>
                                            <p className="text-lg font-bold">Cali, Valle del Cauca</p>
                                            <p className="text-sm opacity-80">Colombia, S.A.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </div>

                    <footer className="mt-32 pt-12 border-t-2 border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">
                        <p>© 2026 Clientum Studio SAS. Todos los derechos reservados.</p>
                        <p className="mt-2 text-slate-300 dark:text-slate-600 italic">Clivaro - El poder de la simplicidad inteligente</p>
                    </footer>
                </article>
            </main>
        </div>
    )
}
