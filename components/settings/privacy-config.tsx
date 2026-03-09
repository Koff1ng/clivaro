'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Mail, Trash2, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast' // Changed import

export function PrivacyConfig() {
    const { data: session, update } = useSession()
    const { toast } = useToast() // Added useToast hook
    const [loadingMarketing, setLoadingMarketing] = useState(false)

    const user = session?.user as any

    const handleRevokeMarketing = async () => {
        setLoadingMarketing(true)
        try {
            const response = await fetch('/api/legal/revoke-marketing', { method: 'POST' })
            if (response.ok) {
                await update()
                toast('Ya no recibirás comunicaciones de marketing.', 'success') // Updated toast usage
            } else {
                toast('No se pudo actualizar la preferencia.', 'error') // Updated toast usage
            }
        } catch (error) {
            toast('No se pudo contactar con el servidor.', 'error') // Updated toast usage
        } finally {
            setLoadingMarketing(false)
        }
    }

    const handleRequestDeletion = () => {
        const subject = encodeURIComponent('Solicitud de eliminación de datos - Clivaro')
        const body = encodeURIComponent(`Hola,\n\nSolicito la eliminación de mis datos personales asociados a mi cuenta en Clivaro.\n\nUsuario: ${user?.name}\nEmail: ${user?.email}\nID: ${user?.id}\n\nGracias.`)
        window.location.href = `mailto:gerencia@clientumstudio.com?subject=${subject}&body=${body}`
    }

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/5 to-transparent p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold">Privacidad y Legal</CardTitle>
                            <CardDescription>
                                Administre sus consentimientos y cumplimiento de la Ley 1581 de 2012
                            </CardDescription>
                        </div>
                    </div>
                </div>
                <CardContent className="p-8 space-y-8">
                    {/* Status Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Estado de Aceptación</p>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Términos Aceptados</p>
                                    <p className="text-xs text-slate-500">Versión: {user?.legalVersion || 'v1.0'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Fecha de Consentimiento</p>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Aceptado el</p>
                                    <p className="text-xs text-slate-500">
                                        {user?.legalAcceptedAt ? new Date(user.legalAcceptedAt).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-900 dark:text-slate-100">Comunicaciones de Marketing</p>
                                    {user?.marketingAccepted ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">Activo</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800">Inactivo</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">Recibir noticias, actualizaciones y ofertas especiales de Clivaro.</p>
                            </div>
                            {user?.marketingAccepted && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/20"
                                    onClick={handleRevokeMarketing}
                                    disabled={loadingMarketing}
                                >
                                    {loadingMarketing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revocar autorización'}
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/10 dark:bg-red-900/5 gap-4">
                            <div className="space-y-1">
                                <p className="font-bold text-red-900 dark:text-red-400">Eliminación de Datos</p>
                                <p className="text-sm text-slate-500">Solicite el borrado definitivo de su información personal conforme a la Ley.</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white dark:bg-slate-950 border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                                onClick={handleRequestDeletion}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Solicitar eliminación
                            </Button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-6 justify-center md:justify-start">
                        <Link href="/terminos-y-condiciones" target="_blank" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 font-medium group">
                            Términos y Condiciones
                            <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <Link href="/politica-de-privacidad" target="_blank" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 font-medium group">
                            Política de Privacidad
                            <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <a href="mailto:legal@clivaro.com" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                            Contacto Legal: legal@clivaro.com
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function Calendar({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
