'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageCircle, Loader2, QrCode, CheckCircle2, XCircle,
  Power, Wifi, WifiOff, RefreshCw, Smartphone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SessionStatus {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'bridge_offline'
  qr: string | null
  phone: string | null
  name: string | null
}

export function WhatsAppSettings() {
  const queryClient = useQueryClient()
  const [polling, setPolling] = useState(false)

  // Fetch session status
  const { data: session, isLoading } = useQuery<SessionStatus>({
    queryKey: ['whatsapp-session'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/session')
      if (!res.ok) return { status: 'bridge_offline', qr: null, phone: null, name: null }
      return res.json()
    },
    refetchInterval: polling ? 3000 : false, // Poll every 3s when waiting for QR/connect
  })

  // Auto-enable polling when connecting/qr
  useEffect(() => {
    if (session?.status === 'connecting' || session?.status === 'qr') {
      setPolling(true)
    } else {
      setPolling(false)
    }
  }, [session?.status])

  // Start session (Triggers QR)
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/session', { method: 'POST' })
      return res.json()
    },
    onSuccess: () => {
      setPolling(true)
      queryClient.invalidateQueries({ queryKey: ['whatsapp-session'] })
    },
  })

  // Stop session
  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/session', { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-session'] })
    },
  })

  const status = session?.status || 'disconnected'

  const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    disconnected: { label: 'Desconectado', icon: WifiOff, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
    connecting: { label: 'Conectando...', icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    qr: { label: 'Escanea el QR', icon: QrCode, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    connected: { label: 'Conectado', icon: Wifi, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    bridge_offline: { label: 'Servidor no disponible', icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  }

  const cfg = statusConfig[status] || statusConfig.disconnected
  const StatusIcon = cfg.icon

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-green-600" />
          WhatsApp Business
        </CardTitle>
        <CardDescription>
          Conecta tu WhatsApp para enviar y recibir mensajes desde el CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className={cn('p-4 rounded-lg flex items-center gap-3', cfg.bg)}>
          <StatusIcon className={cn('h-5 w-5', cfg.color, status === 'connecting' && 'animate-spin')} />
          <div className="flex-1">
            <p className={cn('font-medium text-sm', cfg.color)}>{cfg.label}</p>
            {session?.phone && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Smartphone className="inline h-3 w-3 mr-1" />
                +{session.phone} ({session.name || 'WhatsApp'})
              </p>
            )}
          </div>
          {status === 'connected' && (
            <Badge className="bg-green-500 text-white text-[10px]">Activo</Badge>
          )}
        </div>

        {/* QR Code */}
        {status === 'qr' && session?.qr && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-dashed border-indigo-200">
              <img
                src={session.qr}
                alt="WhatsApp QR Code"
                className="w-56 h-56"
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Escanea con WhatsApp</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Abre WhatsApp → ⋮ Menú → Dispositivos vinculados → Vincular dispositivo
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {(status === 'disconnected' || status === 'bridge_offline') && (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {startMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Conectando...</>
              ) : (
                <><Power className="h-4 w-4 mr-2" />Conectar WhatsApp</>
              )}
            </Button>
          )}

          {status === 'qr' && (
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsapp-session'] })}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar QR
            </Button>
          )}

          {status === 'connected' && (
            <Button
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="flex-1"
            >
              <Power className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          )}
        </div>

        {/* Help text */}
        <div className="text-[11px] text-muted-foreground leading-relaxed border-t pt-4">
          <p><strong>¿Cómo funciona?</strong></p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>Los mensajes se envían desde tu número de WhatsApp real</li>
            <li>Puedes responder directamente desde el Inbox del CRM</li>
            <li>Tu teléfono debe mantener conexión a internet</li>
            <li>Las sesiones se reconectan automáticamente</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
