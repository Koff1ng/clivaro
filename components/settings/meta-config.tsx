'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export function MetaConfig() {
    const { toast } = useToast()

    // States
    const [metaBusinessId, setMetaBusinessId] = useState('')
    const [metaAccessToken, setMetaAccessToken] = useState('')
    const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('')
    const [instagramAccountId, setInstagramAccountId] = useState('')

    // UI States
    const [showToken, setShowToken] = useState(false)
    const [isConnected, setIsConnected] = useState(false)

    // Mock Save
    const saveMutation = useMutation({
        mutationFn: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000))
            return true
        },
        onSuccess: () => {
            toast('Configuración guardada correctamente', 'success')
        }
    })

    // Mock Test Connection
    const testConnectionMutation = useMutation({
        mutationFn: async () => {
            if (!metaAccessToken) throw new Error("Token no configurado")
            await new Promise(resolve => setTimeout(resolve, 1500))
            // For demo purposes, we accept any non-empty token
            return true
        },
        onSuccess: () => {
            setIsConnected(true)
            toast('Conexión exitosa con Meta Graph API', 'success')
        },
        onError: () => {
            setIsConnected(false)
            toast('Error al conectar. Verifica el token.', 'error')
        }
    })

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Estado del Servicio</CardDescription>
                        <CardTitle className="text-xl flex items-center gap-2">
                            {isConnected ? (
                                <>
                                    <CheckCircle2 className="text-green-500 h-5 w-5" />
                                    <span className="text-green-700">Conectado</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="text-yellow-500 h-5 w-5" />
                                    <span className="text-yellow-700">Sin verificar</span>
                                </>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            {isConnected
                                ? "Los webhooks están activos y recibiendo mensajes."
                                : "Configura tus credenciales para habilitar la mensajería."}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Acciones Rápidas</CardDescription>
                        <CardTitle className="text-lg">Herramientas</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => testConnectionMutation.mutate()}
                            disabled={testConnectionMutation.isPending}
                        >
                            {testConnectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Probar Conexión
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full gap-2" asChild>
                            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                Meta Console
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Credentials Form */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Credenciales de API</CardTitle>
                            <CardDescription>
                                Estos valores se obtienen desde el panel de <a href="#" className="underline">Meta for Developers</a>.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">v18.0</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Meta Business ID</Label>
                            <Input
                                value={metaBusinessId}
                                onChange={e => setMetaBusinessId(e.target.value)}
                                placeholder="Ej: 1234567890"
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>WhatsApp Phone ID</Label>
                            <Input
                                value={whatsappPhoneNumberId}
                                onChange={e => setWhatsappPhoneNumberId(e.target.value)}
                                placeholder="Ej: 100000000000"
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Access Token (System User)</Label>
                        <div className="relative">
                            <Input
                                type={showToken ? "text" : "password"}
                                value={metaAccessToken}
                                onChange={e => setMetaAccessToken(e.target.value)}
                                placeholder="EAAG..."
                                className="font-mono pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <Alert className="bg-blue-50 border-blue-200 mt-2">
                            <AlertTitle className="text-blue-800 text-xs font-semibold">Consejo de Seguridad</AlertTitle>
                            <AlertDescription className="text-blue-700 text-xs">
                                Utiliza un token de "Usuario del Sistema" con permisos de <code>whatsapp_business_messaging</code> y <code>instagram_manage_messages</code>.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <Label>Instagram Account ID (Opcional)</Label>
                        <Input
                            value={instagramAccountId}
                            onChange={e => setInstagramAccountId(e.target.value)}
                            placeholder="Ej: 178414..."
                            className="font-mono"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            className="min-w-[150px]"
                        >
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
