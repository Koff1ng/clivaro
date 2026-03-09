'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ShieldCheck, ArrowRight, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface LegalAcceptanceModalProps {
    open: boolean
    onAccept: (marketing: boolean) => Promise<void>
}

export function LegalAcceptanceModal({ open, onAccept }: LegalAcceptanceModalProps) {
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
    const [acceptedMarketing, setAcceptedMarketing] = useState(false)
    const [loading, setLoading] = useState(false)

    const canContinue = acceptedTerms && acceptedPrivacy

    const handleContinue = async () => {
        if (!canContinue) return
        setLoading(true)
        try {
            await onAccept(acceptedMarketing)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <DialogHeader className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
                            <ShieldCheck className="w-7 h-7 text-white" />
                        </div>
                        <DialogTitle className="text-2xl font-bold leading-tight">
                            Antes de comenzar, revisa y acepta nuestros términos
                        </DialogTitle>
                        <DialogDescription className="text-blue-100 text-base mt-2">
                            Para garantizar la seguridad de su información y cumplir con la Ley 1581 de 2012 (Colombia), necesitamos su consentimiento.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-6 bg-white dark:bg-slate-950">
                    <div className="space-y-4">
                        <div className="flex items-start space-x-3 group">
                            <Checkbox
                                id="terms"
                                checked={acceptedTerms}
                                onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                                className="mt-1 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="terms"
                                    className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer group-hover:text-blue-600 transition-colors"
                                >
                                    He leído y acepto los Términos y Condiciones
                                </Label>
                                <Link
                                    href="/terminos-y-condiciones"
                                    target="_blank"
                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                                >
                                    Ver documento <ExternalLink className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 group">
                            <Checkbox
                                id="privacy"
                                checked={acceptedPrivacy}
                                onCheckedChange={(checked) => setAcceptedPrivacy(checked as boolean)}
                                className="mt-1 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="privacy"
                                    className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer group-hover:text-blue-600 transition-colors"
                                >
                                    He leído y acepto la Política de Tratamiento de Datos Personales
                                </Label>
                                <Link
                                    href="/politica-de-privacidad"
                                    target="_blank"
                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                                >
                                    Ver documento <ExternalLink className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-start space-x-3 group">
                                <Checkbox
                                    id="marketing"
                                    checked={acceptedMarketing}
                                    onCheckedChange={(checked) => setAcceptedMarketing(checked as boolean)}
                                    className="mt-1 border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="marketing"
                                        className="text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors"
                                    >
                                        Acepto recibir comunicaciones comerciales y de marketing de Clivaro (Opcional)
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                            Al continuar, confirmas que eres mayor de 18 años y que la información proporcionada es verídica conforme a la legislación colombiana vigente.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-8 pt-0 bg-white dark:bg-slate-950">
                    <Button
                        className={`w-full py-6 text-lg font-bold rounded-xl transition-all duration-300 ${canContinue
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        disabled={!canContinue || loading}
                        onClick={handleContinue}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <span className="flex items-center gap-2">
                                Continuar a la plataforma <ArrowRight className="w-5 h-5" />
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
