'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'

// Mocking fetch logic for demo - in prod would be real /api/settings endpoints
export function MetaConfig() {
    const { toast } = useToast()

    // States for form
    const [metaBusinessId, setMetaBusinessId] = useState('')
    const [metaAccessToken, setMetaAccessToken] = useState('')
    const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('')
    const [instagramAccountId, setInstagramAccountId] = useState('')

    // Placeholder for saving settings
    const saveMutation = useMutation({
        mutationFn: async () => {
            // This would send to /api/settings (TenantSettings update)
            // For now we simulate success
            await new Promise(resolve => setTimeout(resolve, 1000))
            return true
        },
        onSuccess: () => {
            toast('Configuración guardada', 'success')
        }
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integración Meta (WhatsApp & Instagram)</CardTitle>
                <CardDescription>
                    Configura tus credenciales de la API de Meta para habilitar la mensajería en tiempo real.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label>Meta Business ID</Label>
                    <Input
                        value={metaBusinessId}
                        onChange={e => setMetaBusinessId(e.target.value)}
                        placeholder="Ej: 123456789"
                    />
                </div>

                <div className="grid gap-2">
                    <Label>Access Token (System User)</Label>
                    <Input
                        type="password"
                        value={metaAccessToken}
                        onChange={e => setMetaAccessToken(e.target.value)}
                        placeholder="EAAG..."
                    />
                    <p className="text-xs text-muted-foreground">Token permanente generado desde el usuario del sistema en Meta Business Suite.</p>
                </div>

                <div className="grid gap-2">
                    <Label>WhatsApp Phone Number ID</Label>
                    <Input
                        value={whatsappPhoneNumberId}
                        onChange={e => setWhatsappPhoneNumberId(e.target.value)}
                        placeholder="Ej: 100000000000"
                    />
                </div>

                <div className="grid gap-2">
                    <Label>Instagram Account ID (Opcional)</Label>
                    <Input
                        value={instagramAccountId}
                        onChange={e => setInstagramAccountId(e.target.value)}
                        placeholder="Ej: 178414..."
                    />
                </div>

                <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="w-full mt-4"
                >
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Configuración
                </Button>
            </CardContent>
        </Card>
    )
}
