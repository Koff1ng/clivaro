'use client'

import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, ChevronRight, ShieldCheck, Scale, FileText, Lock, UserCheck, AlertTriangle, CreditCard, Ban, RefreshCw, Gavel, HandshakeIcon, Cloud, Receipt } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function TermsPage() {
    const [activeSection, setActiveSection] = useState('')

    const sections = [
        { id: 'preambulo', title: 'Preámbulo y Aceptación', icon: ShieldCheck },
        { id: 'identidad', title: '1. Identidad de las Partes', icon: UserCheck },
        { id: 'objeto', title: '2. Objeto y Licencia SaaS', icon: FileText },
        { id: 'suscripcion', title: '3. Suscripción y Pagos', icon: CreditCard },
        { id: 'facturacion', title: '4. Facturación Electrónica', icon: Receipt },
        { id: 'datos', title: '5. Protección de Datos', icon: Lock },
        { id: 'sla', title: '6. Niveles de Servicio (SLA)', icon: Cloud },
        { id: 'uso-aceptable', title: '7. Uso Aceptable', icon: Ban },
        { id: 'responsabilidad', title: '8. Limitación de Responsabilidad', icon: AlertTriangle },
        { id: 'propiedad', title: '9. Propiedad Intelectual', icon: FileText },
        { id: 'cancelacion', title: '10. Cancelación y Reembolso', icon: RefreshCw },
        { id: 'garantias', title: '11. Garantías', icon: ShieldCheck },
        { id: 'fuerza-mayor', title: '12. Fuerza Mayor', icon: AlertTriangle },
        { id: 'modificaciones', title: '13. Modificaciones al Contrato', icon: Scale },
        { id: 'cesion', title: '14. Cesión y Subcontratación', icon: HandshakeIcon },
        { id: 'ley', title: '15. Ley Aplicable y Jurisdicción', icon: Gavel },
        { id: 'contacto', title: '16. Contacto y Notificaciones', icon: UserCheck },
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
                        <p style="color: #94a3b8; font-size: 12px;">Última actualización: 27 de marzo de 2026</p>
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
                    <div className="sticky top-28 p-8 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm shadow-slate-100/50 max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Estructura Legal</h3>
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <Link
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeSection === section.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 -translate-x-1'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <section.icon className={`w-3.5 h-3.5 shrink-0 ${activeSection === section.id ? 'text-white' : 'text-slate-400'}`} />
                                    <span className="leading-tight">{section.title}</span>
                                </Link>
                            ))}
                        </nav>
                        
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Representante Legal</p>
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-tight">Juan Jose Trujillo Agamez</p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase">C.C. 1003.401.790</p>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-4 text-center">Última actualización: 27/03/2026</p>
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
                        <p className="text-sm text-slate-400 mt-4">Última actualización: 27 de marzo de 2026 · Versión 2.0</p>
                    </div>

                    <div className="space-y-20">

                        <section id="preambulo" className="scroll-mt-28">
                            <p className="text-lg font-medium italic">
                                Por favor, lea atentamente este Contrato antes de acceder o utilizar la plataforma Clivaro. Al registrarse, acceder o utilizar el servicio, usted declara haber leído, comprendido y aceptado quedar vinculado legalmente por estos términos y condiciones.
                            </p>
                            <p>
                                El presente documento constituye un contrato legalmente vinculante entre **Clientum Studio SAS** (en adelante &quot;LA EMPRESA&quot; o &quot;Clivaro&quot;) y cualquier persona natural o jurídica que acceda o utilice la plataforma (en adelante &quot;EL CLIENTE&quot; o &quot;el usuario&quot;). El uso de la plataforma constituye la aceptación incondicional de estos términos en virtud de la **Ley 527 de 1999** sobre comercio electrónico y el **Decreto 2364 de 2012** sobre firma electrónica.
                            </p>
                            <p>
                                Si usted no está de acuerdo con alguno de los términos aquí expuestos, deberá abstenerse de utilizar la plataforma y solicitar la cancelación de su cuenta.
                            </p>
                        </section>

                        <section id="identidad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">1. Identidad de las Partes</h2>
                            <p>
                                **LA EMPRESA**: **Clientum Studio SAS**, sociedad por acciones simplificada debidamente constituida bajo las leyes de la República de Colombia, con domicilio en la ciudad de Cali, Valle del Cauca, actuando a través de su Gerente y Representante Legal, **Juan Jose Trujillo Agamez**, identificado con **C.C. 1003.401.790**.
                            </p>
                            <p>
                                **EL CLIENTE**: Persona natural mayor de edad o persona jurídica debidamente constituida que adquiere la suscripción al software para la gestión de su actividad comercial. El Cliente garantiza que la información proporcionada durante el proceso de registro es veraz, completa y actualizada, y se compromete a mantenerla así durante la vigencia de la relación contractual.
                            </p>
                            <p>
                                En caso de que el Cliente actúe a nombre de una persona jurídica, declara contar con la capacidad y autorización necesaria para vincular a dicha entidad a los presentes términos.
                            </p>
                        </section>

                        <section id="objeto" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">2. Objeto y Licencia SaaS</h2>
                            <p>
                                **Clivaro** concede al Cliente una licencia de uso de software bajo el modelo **SaaS (Software as a Service)**, de conformidad con las prácticas reconocidas por la industria tecnológica colombiana. Esta licencia es:
                            </p>
                            <ul className="list-none p-0 space-y-3">
                                <li className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border-l-4 border-blue-600">**No exclusiva**: El mismo software puede ser licenciado a otros clientes.</li>
                                <li className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border-l-4 border-indigo-600">**Intransferible**: No puede ser cedida, sublicenciada o compartida con terceros sin autorización expresa.</li>
                                <li className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border-l-4 border-purple-600">**Limitada temporalmente**: Está vigente únicamente durante el periodo de suscripción activa y pagada.</li>
                                <li className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border-l-4 border-cyan-600">**De uso**: No otorga propiedad sobre el código fuente, algoritmos, bases de datos, diseños o cualquier componente del sistema.</li>
                            </ul>
                            <p>
                                El software es una plataforma de gestión empresarial (ERP &amp; CRM) que incluye, según el plan contratado, funcionalidades de: punto de venta, control de inventarios, facturación electrónica DIAN, gestión de clientes y proveedores, CRM con gestión de leads, marketing por email, módulo de compras, contabilidad, nómina y recursos humanos, y módulo de restaurante.
                            </p>
                            <p>
                                Las funcionalidades disponibles dependerán del plan contratado. La EMPRESA se reserva el derecho de actualizar, mejorar o modificar las funcionalidades del software, siempre y cuando no se reduzcan materialmente las características del plan contratado por el Cliente durante su periodo de vigencia.
                            </p>
                        </section>

                        <section id="suscripcion" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">3. Suscripción y Pagos</h2>
                            <p>
                                **3.1. OBLIGACIÓN DE PAGO**: El Cliente se obliga al pago del canon de suscripción mensual o anual de forma anticipada, según el plan seleccionado al momento de la contratación. Los precios vigentes serán los publicados en la página de precios de Clivaro al momento de cada renovación.
                            </p>
                            <p>
                                **3.2. SUSPENSIÓN POR MORA**: El incumplimiento del pago generará la **suspensión automática** del servicio transcurridos **cinco (5) días calendario** desde la fecha de vencimiento. Durante la suspensión, los datos del Cliente serán preservados por un período de **treinta (30) días**, tras los cuales la EMPRESA podrá eliminar la cuenta y todos los datos asociados, sin que esta acción genere responsabilidad alguna.
                            </p>
                            <p>
                                **3.3. MEDIOS DE PAGO**: Los pagos podrán realizarse a través de los medios electrónicos habilitados por la plataforma, incluyendo tarjetas de crédito, débito, transferencias bancarias y otros mecanismos de pago electrónico disponibles en Colombia.
                            </p>
                            <p>
                                **3.4. VALIDEZ FISCAL**: Todas las facturas de suscripción serán emitidas electrónicamente conforme a los requerimientos de la DIAN (Dirección de Impuestos y Aduanas Nacionales). Los cargos por IVA (19%) se detallarán por separado según la normativa tributaria vigente en Colombia, conforme al **Estatuto Tributario** y la **Resolución 000165 de 2023** de la DIAN.
                            </p>
                            <p>
                                **3.5. PERIODO DE PRUEBA**: La EMPRESA podrá ofrecer un período de prueba gratuito de hasta catorce (14) días. Al finalizar dicho período, el Cliente deberá contratar un plan de pago para continuar utilizando el servicio. La falta de contratación resultará en la suspensión automática del acceso.
                            </p>
                        </section>

                        <section id="facturacion" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">4. Facturación Electrónica DIAN</h2>
                            <p>
                                **4.1. SERVICIO DE FACTURACIÓN**: Clivaro facilita al Cliente la emisión de facturas electrónicas de venta conforme a la normativa de la DIAN, a través de proveedores tecnológicos autorizados (actualmente **Factus** de Halltec SAS). El servicio incluye la generación, validación, envío a la DIAN y entrega al adquiriente del documento electrónico.
                            </p>
                            <p>
                                **4.2. LÍMITES**: Según el plan contratado, el Cliente tendrá un límite mensual de facturas electrónicas. Superado dicho límite, el Cliente no podrá emitir más documentos electrónicos hasta el siguiente periodo de facturación o hasta que actualice su plan a uno superior.
                            </p>
                            <p>
                                **4.3. RESPONSABILIDAD TRIBUTARIA**: La EMPRESA actúa exclusivamente como intermediario tecnológico para la facturación electrónica. La veracidad, exactitud y cumplimiento de la información tributaria contenida en las facturas es **responsabilidad exclusiva del Cliente**. La EMPRESA no asesora contable, tributaria ni legalmente al usuario.
                            </p>
                            <p>
                                **4.4. RESOLUCIÓN DE NUMERACIÓN**: El Cliente es responsable de obtener y mantener vigente ante la DIAN su resolución de facturación. La EMPRESA no será responsable por facturas emitidas fuera de los rangos autorizados por causa atribuible al Cliente.
                            </p>
                        </section>

                        <section id="datos" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">5. Protección de Datos Personales</h2>
                            <p>
                                En cumplimiento de la **Ley Estatutaria 1581 de 2012**, el **Decreto Reglamentario 1377 de 2013**, y demás normas concordantes sobre protección de datos personales en Colombia, las partes acuerdan:
                            </p>
                            <ul className="list-none p-0 space-y-4">
                                <li className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-l-4 border-blue-600">
                                    **5.1. Responsable del Tratamiento**: Clientum Studio SAS actúa como Responsable del Tratamiento respecto a los datos personales de los Clientes recopilados durante el registro y uso de la plataforma (nombres, identificación, correo electrónico, teléfono, datos de facturación).
                                </li>
                                <li className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-l-4 border-indigo-600">
                                    **5.2. Encargado del Tratamiento**: Clientum Studio SAS actúa como Encargado del Tratamiento respecto a los datos personales que el Cliente cargue en la plataforma (bases de datos de clientes, proveedores, empleados y terceros del Cliente).
                                </li>
                            </ul>
                            <p>
                                **5.3. AUTORIZACIÓN**: El Cliente garantiza que cuenta con la **autorización previa, expresa e informada** de todos los titulares cuyos datos personales cargue, almacene o procese a través de Clivaro, conforme al artículo 9 de la Ley 1581 de 2012.
                            </p>
                            <p>
                                **5.4. FINALIDAD**: Los datos personales del Cliente serán tratados para: (a) la prestación del servicio contratado, (b) facturación y cobros, (c) comunicaciones relativas al servicio, (d) mejora de la plataforma, y (e) cumplimiento de obligaciones legales.
                            </p>
                            <p>
                                **5.5. DERECHOS DEL TITULAR**: Los titulares podrán ejercer en cualquier momento sus derechos de acceso, rectificación, actualización, supresión y revocatoria de autorización mediante comunicación escrita a **gerencia@clientumstudio.com**. La EMPRESA atenderá las solicitudes dentro de los términos establecidos por la ley.
                            </p>
                            <p>
                                **5.6. MEDIDAS DE SEGURIDAD**: La EMPRESA implementa medidas técnicas y organizativas apropiadas para proteger los datos personales contra acceso no autorizado, pérdida, alteración o divulgación, incluyendo: encriptación SSL/TLS de 256 bits, aislamiento de datos por tenant, backups automáticos, y control de acceso basado en roles.
                            </p>
                            <p>
                                **5.7. TRANSFERENCIA INTERNACIONAL**: Los datos podrán ser alojados en servidores ubicados fuera de Colombia (centros de datos de proveedores de nube como AWS, Google Cloud o similares). En tal caso, la EMPRESA garantiza que dichos proveedores cuentan con niveles adecuados de protección de datos conforme al artículo 26 de la Ley 1581 de 2012.
                            </p>
                        </section>

                        <section id="sla" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">6. Niveles de Servicio (SLA)</h2>
                            <p>
                                **6.1. DISPONIBILIDAD**: La EMPRESA se compromete a mantener la plataforma disponible con un uptime mínimo del **99.5%** mensual, medido sobre la totalidad del mes calendario, excluyendo las ventanas de mantenimiento programado.
                            </p>
                            <p>
                                **6.2. MANTENIMIENTO PROGRAMADO**: La EMPRESA podrá realizar mantenimientos programados, los cuales serán notificados al Cliente con al menos **24 horas** de anticipación a través de la plataforma o correo electrónico. Dichos períodos no se considerarán como tiempo de inactividad para efectos del cálculo del SLA.
                            </p>
                            <p>
                                **6.3. EXCLUSIONES**: La garantía de disponibilidad no aplica en caso de: (a) fallos en la conectividad a internet del Cliente, (b) eventos de fuerza mayor o caso fortuito, (c) ataques cibernéticos de terceros, (d) indisponibilidad de proveedores de infraestructura en la nube, (e) uso indebido de la plataforma por parte del Cliente.
                            </p>
                            <p>
                                **6.4. SOPORTE TÉCNICO**: El soporte técnico estará disponible según el plan contratado: soporte por email (plan Starter), soporte prioritario (plan Business) o soporte dedicado 24/7 (plan Enterprise). Los tiempos de respuesta variarán según la severidad del incidente y el plan contratado.
                            </p>
                        </section>

                        <section id="uso-aceptable" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">7. Política de Uso Aceptable</h2>
                            <p>
                                El Cliente se compromete a utilizar Clivaro exclusivamente para fines lícitos y de conformidad con la legislación colombiana vigente. Queda expresamente prohibido:
                            </p>
                            <ul className="list-none p-0 space-y-3">
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Utilizar la plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Intentar acceder a datos de otros clientes, realizar ingeniería inversa, descompilar o modificar el software.</li>
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Sobrecargar deliberadamente los servidores, realizar ataques de denegación de servicio o intentar vulnerar la seguridad del sistema.</li>
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Compartir credenciales de acceso con personas no autorizadas o permitir el uso por usuarios que excedan el límite del plan contratado.</li>
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Emitir facturas electrónicas con información falsa, inexacta o que no correspondan a operaciones comerciales reales.</li>
                                <li className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-l-4 border-red-500 text-sm">Utilizar la plataforma para el lavado de activos, financiación del terrorismo u otras actividades contrarias a la **Ley 1762 de 2015**.</li>
                            </ul>
                            <p>
                                El incumplimiento de estas prohibiciones facultará a la EMPRESA para suspender o cancelar inmediatamente la cuenta del Cliente, sin que ello genere derecho a reembolso alguno, sin perjuicio de las acciones legales que correspondan.
                            </p>
                        </section>

                        <section id="responsabilidad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">8. Limitación de Responsabilidad</h2>
                            <p>
                                **8.1. LÍMITE MÁXIMO**: En ningún caso la responsabilidad total acumulada de la EMPRESA frente al Cliente por cualquier concepto derivado de estos términos superará el valor de **tres (3) mensualidades** del plan contratado por el Cliente al momento de la ocurrencia del hecho generador.
                            </p>
                            <p>
                                **8.2. EXCLUSIONES**: La EMPRESA no será responsable por: (a) daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo lucro cesante, pérdida de datos, pérdida de negocio o cualquier otra pérdida económica; (b) decisiones comerciales, financieras o tributarias tomadas por el Cliente con base en la información generada por la plataforma; (c) interrupciones causadas por fallos en la infraestructura de terceros proveedores de internet, hosting o servicios en la nube.
                            </p>
                            <p>
                                **8.3. PRECISIÓN TRIBUTARIA**: Aunque Clivaro facilita la emisión de documentos tributarios electrónicos avalados por la DIAN, la veracidad de la información contenida en dichos documentos y su correspondencia con las operaciones comerciales reales del Cliente es **responsabilidad exclusiva del Cliente**. La EMPRESA no actúa como asesor contable, tributario ni legal.
                            </p>
                            <p>
                                **8.4. DEBER DE MITIGACIÓN**: El Cliente tiene el deber de mantener respaldos razonables de su información crítica y de notificar a la EMPRESA con prontitud cualquier incidente o anomalía que detecte en el servicio, a fin de mitigar posibles daños.
                            </p>
                        </section>

                        <section id="propiedad" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">9. Propiedad Intelectual</h2>
                            <p>
                                **9.1. TITULARIDAD**: Todos los derechos de propiedad intelectual e industrial sobre Clivaro, incluyendo pero no limitándose a: código fuente, algoritmos, interfaces de usuario, diseños, logotipos, marcas, bases de datos, documentación técnica y material de marketing, son propiedad exclusiva de **Clientum Studio SAS**. Estos derechos están protegidos por la **Ley 23 de 1982**, la **Ley 44 de 1993**, la **Decisión Andina 486 de 2000** y demás normas concordantes sobre derechos de autor y propiedad industrial.
                            </p>
                            <p>
                                **9.2. DATOS DEL CLIENTE**: Los datos ingresados por el Cliente en la plataforma (productos, clientes, facturas, registros contables, etc.) son propiedad del Cliente. La EMPRESA se compromete a facilitar la exportación de dichos datos en formatos estándar al finalizar la relación contractual, dentro de un plazo razonable no superior a treinta (30) días.
                            </p>
                            <p>
                                **9.3. PROHIBICIONES**: Queda expresamente prohibido cualquier intento de copia, reproducción, ingeniería inversa, descompilación, adaptación, distribución o creación de obras derivadas del software sin autorización expresa y por escrito de la EMPRESA. La violación de esta cláusula será perseguida civil y penalmente conforme a la legislación colombiana vigente.
                            </p>
                        </section>

                        <section id="cancelacion" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">10. Cancelación y Reembolso</h2>
                            <p>
                                **10.1. CANCELACIÓN POR EL CLIENTE**: El Cliente podrá cancelar su suscripción en cualquier momento a través de la plataforma o mediante comunicación escrita a **gerencia@clientumstudio.com**. La cancelación se hará efectiva al finalizar el período de facturación vigente, manteniéndose el acceso hasta dicho momento.
                            </p>
                            <p>
                                **10.2. DERECHO DE RETRACTO**: De conformidad con la **Ley 1480 de 2011** (Estatuto del Consumidor), el Cliente que sea persona natural podrá ejercer su derecho de retracto dentro de los **cinco (5) días hábiles** siguientes a la primera contratación del servicio, siempre que no haya utilizado significativamente la plataforma. En tal caso, se procederá al reembolso completo del valor pagado.
                            </p>
                            <p>
                                **10.3. REEMBOLSOS**: Fuera del período de retracto, los pagos realizados son **no reembolsables**. En planes anuales, no se realizarán reembolsos proporcionales por el tiempo no utilizado, salvo resolución por incumplimiento atribuible a la EMPRESA.
                            </p>
                            <p>
                                **10.4. EFECTOS DE LA CANCELACIÓN**: Tras la cancelación efectiva, el acceso del Cliente será desactivado. Los datos del Cliente serán preservados por treinta (30) días adicionales para permitir la exportación. Transcurrido dicho plazo, todos los datos serán eliminados de forma permanente e irrecuperable.
                            </p>
                            <p>
                                **10.5. CANCELACIÓN POR LA EMPRESA**: La EMPRESA podrá cancelar la suscripción del Cliente unilateralmente y sin derecho a reembolso en caso de: (a) incumplimiento de estos términos, (b) uso fraudulento de la plataforma, (c) mora en el pago superior a treinta (30) días, (d) actividades que pongan en riesgo la plataforma o a otros usuarios.
                            </p>
                        </section>

                        <section id="garantias" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">11. Garantías</h2>
                            <p>
                                **11.1. GARANTÍA DE FUNCIONAMIENTO**: La EMPRESA garantiza que la plataforma funcionará sustancialmente de acuerdo con la documentación y especificaciones publicadas para cada plan. En caso de fallos materiales, la EMPRESA se compromete a corregirlos dentro de un plazo razonable.
                            </p>
                            <p>
                                **11.2. EXCLUSIÓN DE GARANTÍAS**: La plataforma se proporciona &quot;tal cual&quot; (*as is*). Salvo lo expresamente indicado en estos términos, la EMPRESA no otorga garantías adicionales, expresas o implícitas, incluyendo pero no limitándose a garantías de comercialización, idoneidad para un propósito particular, ausencia de errores o funcionamiento ininterrumpido.
                            </p>
                            <p>
                                **11.3. CUMPLIMIENTO NORMATIVO**: La EMPRESA garantiza que los documentos electrónicos generados por Clivaro cumplen con los requisitos técnicos de la DIAN para facturación electrónica en Colombia a la fecha de emisión. Sin embargo, cambios normativos posteriores podrán requerir actualizaciones de la plataforma, las cuales serán implementadas en un plazo razonable.
                            </p>
                        </section>

                        <section id="fuerza-mayor" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">12. Fuerza Mayor y Caso Fortuito</h2>
                            <p>
                                Ninguna de las partes será responsable del incumplimiento total o parcial de sus obligaciones cuando dicho incumplimiento sea consecuencia de eventos de fuerza mayor o caso fortuito, conforme a lo establecido en los **artículos 64 y 1604 del Código Civil colombiano**.
                            </p>
                            <p>
                                Se considerarán eventos de fuerza mayor, entre otros: desastres naturales, pandemias, guerras, disturbios civiles, actos de terrorismo, fallos masivos en infraestructura de telecomunicaciones, actos gubernamentales que impidan la operación del servicio, y ciberataques masivos o de día cero que afecten la infraestructura tecnológica de la EMPRESA o de sus proveedores de servicios en la nube.
                            </p>
                            <p>
                                La parte afectada deberá notificar a la otra dentro de los **cinco (5) días hábiles** siguientes a la ocurrencia del evento, indicando su naturaleza y duración estimada. Si el evento persiste por más de **sesenta (60) días**, cualquiera de las partes podrá resolver el contrato sin responsabilidad alguna.
                            </p>
                        </section>

                        <section id="modificaciones" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">13. Modificaciones al Contrato</h2>
                            <p>
                                **13.1. DERECHO DE MODIFICACIÓN**: La EMPRESA se reserva el derecho de modificar los presentes términos y condiciones en cualquier momento. Las modificaciones serán publicadas en la plataforma y notificadas al Cliente a través del correo electrónico registrado con al menos **quince (15) días calendario** de anticipación a su entrada en vigor.
                            </p>
                            <p>
                                **13.2. ACEPTACIÓN**: El uso continuado de la plataforma después de la entrada en vigor de las modificaciones constituirá la aceptación de los nuevos términos por parte del Cliente. Si el Cliente no está de acuerdo con las modificaciones, podrá cancelar su suscripción antes de su entrada en vigor sin penalidad alguna.
                            </p>
                            <p>
                                **13.3. CAMBIOS DE PRECIO**: Los cambios en los precios de los planes de suscripción serán notificados con al menos **treinta (30) días calendario** de anticipación y se aplicarán a partir del siguiente período de renovación. El precio pactado se mantendrá vigente durante el período de facturación en curso, conforme a la protección al consumidor establecida en la **Ley 1480 de 2011**.
                            </p>
                        </section>

                        <section id="cesion" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">14. Cesión y Subcontratación</h2>
                            <p>
                                **14.1.** El Cliente no podrá ceder, transferir o sublicenciar total o parcialmente sus derechos u obligaciones derivados del presente contrato sin la autorización previa y por escrito de la EMPRESA.
                            </p>
                            <p>
                                **14.2.** La EMPRESA podrá subcontratar parcialmente la prestación de servicios técnicos (hosting, procesamiento, facturación electrónica) con terceros proveedores, manteniendo la responsabilidad frente al Cliente por el cumplimiento del SLA y la protección de datos. Los proveedores actuales incluyen: Supabase (base de datos), Vercel (hosting), y Factus/Halltec (facturación electrónica DIAN).
                            </p>
                            <p>
                                **14.3.** En caso de fusión, adquisición o venta de activos de la EMPRESA, esta podrá ceder el presente contrato al tercero adquiriente, previa notificación al Cliente con treinta (30) días de anticipación.
                            </p>
                        </section>

                        <section id="ley" className="scroll-mt-28">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">15. Ley Aplicable y Resolución de Controversias</h2>
                            <p>
                                **15.1. LEY APLICABLE**: El presente contrato se rige íntegramente por las leyes de la **República de Colombia**, incluyendo pero no limitándose a: la Ley 527 de 1999 (comercio electrónico), la Ley 1480 de 2011 (Estatuto del Consumidor), la Ley 1581 de 2012 (protección de datos), la Ley 23 de 1982 (derechos de autor) y el Código Civil y de Comercio colombianos.
                            </p>
                            <p>
                                **15.2. MECANISMOS ALTERNATIVOS**: Las partes acuerdan que cualquier controversia derivada del presente contrato será resuelta preferiblemente mediante mecanismos alternativos de solución de conflictos (MASC), particularmente a través de un **Centro de Conciliación y Arbitraje** autorizado en la ciudad de **Cali, Valle del Cauca**, conforme a la **Ley 1563 de 2012**.
                            </p>
                            <p>
                                **15.3. JURISDICCIÓN**: En caso de no lograrse una solución mediante los mecanismos alternativos, las controversias serán sometidas a los **Jueces de la República de Colombia** con jurisdicción en la ciudad de Cali, Valle del Cauca.
                            </p>
                        </section>

                        <section id="contacto" className="scroll-mt-28 mb-20">
                            <h2 className="text-3xl font-black mb-8 border-b-4 border-blue-100 dark:border-blue-900 pb-4 inline-block">16. Contacto y Notificaciones</h2>
                            <p>
                                Todas las notificaciones relativas al presente contrato deberán dirigirse a los datos de contacto aquí indicados. Las notificaciones electrónicas enviadas a la dirección de correo registrada se considerarán válidamente efectuadas conforme a la **Ley 527 de 1999**.
                            </p>
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
                                            <p className="flex flex-col mt-2">
                                                <span className="text-xs opacity-60">Datos Personales (Ley 1581):</span>
                                                <a href="mailto:gerencia@clientumstudio.com" className="text-sm font-bold hover:underline">gerencia@clientumstudio.com</a>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </div>

                    <footer className="mt-32 pt-12 border-t-2 border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">
                        <p>© 2026 Clientum Studio SAS. Todos los derechos reservados.</p>
                        <p className="mt-2 text-slate-300 dark:text-slate-600 italic">Clivaro - El poder de la simplicidad inteligente</p>
                        <p className="mt-2 text-slate-300 dark:text-slate-600 normal-case" style={{ textTransform: 'none' }}>Versión 2.0 — Última actualización: 27 de marzo de 2026</p>
                    </footer>
                </article>
            </main>
        </div>
    )
}
