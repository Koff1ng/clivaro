'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface AlegraConfigProps {
    tenantId: string
}

export function AlegraConfig({ tenantId }: AlegraConfigProps) {
    const { toast } = useToast()
    const [email, setEmail] = useState('')
    const [token, setToken] = useState('')
    const [status, setStatus] = useState<'disconnected' | 'connected' | 'invalid'>('disconnected')
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [companyInfo, setCompanyInfo] = useState<any>(null)

    useEffect(() => {
        async function loadConfig() {
            setLoading(true)
            try {
                const res = await fetch(`/api/settings/alegra/config`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.config) {
                        setEmail(data.config.alegraEmail)
                        setStatus(data.config.status)
                        setCompanyInfo(data.config.companyInfo)
                    }
                }
            } catch (error) {
                console.error('Error loading Alegra config', error)
            } finally {
                setLoading(false)
            }
        }
        loadConfig()
    }, [])

    const handleTestConnection = async () => {
        if (!email || !token) {
            toast('Email y Token son requeridos para probar la conexión', 'error')
            return
        }

        setTesting(true)
        try {
            const res = await fetch('/api/settings/alegra/preflight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token }),
            })

            const data = await res.json()
            if (data.success) {
                setStatus('connected')
                setCompanyInfo(data.company)
                toast('Conexión con Alegra exitosa', 'success')
            } else {
                setStatus('invalid')
                toast(data.error || 'Credenciales inválidas', 'error')
            }
        } catch (error) {
            setStatus('invalid')
            toast('Error al probar la conexión', 'error')
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async () => {
        if (!email || !token) {
            toast('Email y Token son requeridos', 'error')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/settings/alegra/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, status }),
            })

            if (res.ok) {
                toast('Configuración de Alegra guardada correctamente', 'success')
            } else {
                const data = await res.json()
                throw new Error(data.error || 'Failed to save')
            }
        } catch (error: any) {
            toast(error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (loading && !email) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Conectar cuenta de Alegra</CardTitle>
                            <CardDescription>
                                Vincula tu cuenta de Alegra para habilitar la facturación electrónica.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {status === 'connected' ? (
                                <div className="flex items-center gap-1 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Conectado
                                </div>
                            ) : status === 'invalid' ? (
                                <div className="flex items-center gap-1 text-sm text-red-600 font-medium bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                    <XCircle className="h-4 w-4" />
                                    Credenciales Inválidas
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-sm text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                                    <AlertCircle className="h-4 w-4" />
                                    Desconectado
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="alegraEmail">Email de Usuario Alegra</Label>
                            <Input
                                id="alegraEmail"
                                type="email"
                                placeholder="usuario@alegra.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="alegraToken">Token de API (Integración Manual)</Label>
                            <Input
                                id="alegraToken"
                                type="password"
                                placeholder="••••••••••••••••"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                Puedes encontrar tu token en Alegra &gt; Configuración &gt; API.
                                <a
                                    href="https://app.alegra.com/configuration/api"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                    Ir a Alegra <ExternalLink className="h-2 w-2" />
                                </a>
                            </p>
                        </div>
                    </div>

                    {companyInfo && status === 'connected' && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Información de la Empresa</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Nombre:</span> {companyInfo.name}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Identificación:</span> {companyInfo.identification}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testing || !email || !token}
                        >
                            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Probar Conexión
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading || !email || !token}
                        >
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Guardar y Activar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-amber-800">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle className="text-base">Seguridad de la Integración</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-amber-800 leading-relaxed">
                        Alegra advierte que el token de API otorga acceso total a tu cuenta.
                        Tus credenciales se guardan de forma segura y cifrada en nuestros servidores.
                        Nunca compartas tu token con terceros.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
