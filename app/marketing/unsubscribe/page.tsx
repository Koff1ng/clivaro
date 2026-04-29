'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle } from 'lucide-react'

function UnsubscribeForm() {
    const searchParams = useSearchParams()
    const emailFromUrl = searchParams.get('email') || ''
    const tenantIdFromUrl = searchParams.get('tenantId') || ''

    const [email, setEmail] = useState(emailFromUrl)
    const [reason, setReason] = useState('')
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE')
    const [errorMessage, setErrorMessage] = useState<string>('')

    const handleUnsubscribe = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        if (!tenantIdFromUrl) {
            setStatus('ERROR')
            setErrorMessage('Enlace inválido: falta el identificador de la organización. Usa el enlace original recibido en el correo.')
            return
        }

        setStatus('LOADING')
        setErrorMessage('')

        try {
            const res = await fetch('/api/marketing/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, reason, tenantId: tenantIdFromUrl })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Error al procesar solicitud')
            }

            setStatus('SUCCESS')
        } catch (error: any) {
            console.error(error)
            setStatus('ERROR')
            setErrorMessage(error?.message || 'Ocurrió un error. Intenta nuevamente.')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Darse de baja</CardTitle>
                    <CardDescription>
                        Lamentamos que te vayas. Confirma tu correo para dejar de recibir nuestros boletines.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'SUCCESS' ? (
                        <div className="text-center py-8 space-y-4">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="font-medium text-lg">¡Suscripción cancelada!</h3>
                                <p className="text-muted-foreground text-sm">
                                    El correo <strong>{email}</strong> ha sido eliminado de nuestra lista de marketing.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleUnsubscribe} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    required
                                    disabled={status === 'LOADING'}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reason">Motivo (Opcional)</Label>
                                <Input
                                    id="reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Ya no me interesa..."
                                    disabled={status === 'LOADING'}
                                />
                            </div>

                            {status === 'ERROR' && (
                                <div className="flex items-center gap-2 p-3 rounded bg-red-50 text-red-600 text-sm">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    <span>{errorMessage || 'Ocurrió un error. Intenta nuevamente.'}</span>
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={status === 'LOADING'}>
                                {status === 'LOADING' ? 'Procesando...' : 'Confirmar Baja'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function UnsubscribePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <Card className="w-full max-w-md shadow-lg">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">Darse de baja</CardTitle>
                            <CardDescription>Cargando...</CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            }
        >
            <UnsubscribeForm />
        </Suspense>
    )
}
