'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Loader2, Mail, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import EmailSetupFlow from '../email-setup/EmailSetupFlow'
import { useToast } from '@/components/ui/toast'
import { useState } from 'react'

async function fetchEmailConfig() {
  const res = await fetch('/api/settings') // Reuse settings API if it includes emailConfig
  const data = await res.json()
  // If not in settings API, fetch separately
  const resConfig = await fetch('/api/tenant/email-verify', { method: 'POST' })
  return resConfig.json()
}

export function EmailConfigTab() {
  const [resetting, setResetting] = useState(false)
  const { toast } = useToast()
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-email-config'],
    queryFn: async () => {
        const res = await fetch('/api/tenant/email-verify', { method: 'POST' })
        if (!res.ok) return { not_found: true }
        return res.json()
    },
  })

  const handleReset = async () => {
    if (!confirm('¿Estás seguro de que deseas cambiar tu dominio de email? Esto detendrá los envíos actuales hasta que el nuevo dominio sea verificado.')) return
    
    setResetting(true)
    try {
      const res = await fetch('/api/tenant/email-setup', { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar configuración')
      toast('Configuración eliminada', 'success')
      refetch()
    } catch (error: any) {
      toast(error.message, 'error')
    } finally {
      setResetting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // If no config found or error returned as 404
  if (data?.not_found || data?.error === 'Configuración no encontrada') {
    return <EmailSetupFlow mode="settings" onComplete={() => refetch()} />
  }

  const isVerified = data?.verified

  return (
    <div className="space-y-6">
      <Card className={`border-l-4 ${isVerified ? 'border-l-green-500' : 'border-l-amber-500'}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Mail className={isVerified ? 'text-green-600' : 'text-amber-600'} />
              Estado del Correo Corporativo
            </CardTitle>
            <CardDescription>
              Configuración de envíos con dominio propio
            </CardDescription>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isVerified ? 'Verificado' : 'Pendiente de Verificación'}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isVerified && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">Tu dominio aún no está listo.</p>
                <p>Asegúrate de haber agregado los registros DNS correctamente. La propagación puede tardar unos minutos.</p>
                <Button 
                    variant="link" 
                    className="p-0 h-auto text-amber-700 underline mt-1"
                    onClick={() => refetch()}
                >
                    <RefreshCw className="w-3 h-3 mr-1" /> Re-intentar verificación
                </Button>
              </div>
            </div>
          )}

          {isVerified && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="text-green-600 mt-0.5" />
              <div className="text-sm text-green-900">
                <p className="font-semibold">¡Todo listo!</p>
                <p>Tus correos se están enviando correctamente desde tu dominio corporativo.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border rounded-lg bg-gray-50/50">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Dominio</p>
              <p className="font-medium text-lg">{data?.domain || 'Configurando...'}</p>
            </div>
            <div className="p-4 border rounded-lg bg-gray-50/50">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Email de Salida</p>
              <p className="font-medium text-lg text-blue-600">{data?.from_email || '...'}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-6">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Cambiar Dominio / Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {!isVerified && (
        <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 px-1">Registros DNS Pendientes</h3>
            <Card>
                <CardContent className="p-0">
                    <EmailSetupFlow mode="settings" onComplete={() => refetch()} />
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  )
}
