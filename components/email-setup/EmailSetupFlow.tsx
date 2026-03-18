'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, Globe, Mail, ShieldCheck, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface EmailSetupFlowProps {
  mode: 'onboarding' | 'settings'
  onComplete?: () => void
}

export default function EmailSetupFlow({ mode, onComplete }: EmailSetupFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [dnsRecords, setDnsRecords] = useState<any[]>([])
  
  // Form state
  const [domain, setDomain] = useState('')
  const [fromPrefix, setFromPrefix] = useState('hola')
  const [fromName, setFromName] = useState('')

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tenant/email-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, fromPrefix, fromName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al configurar dominio')
      
      setDnsRecords(data.dns_records || [])
      setStep(2)
      toast('Dominio registrado. Ahora configura tus registros DNS.', 'success')
    } catch (error: any) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/tenant/email-verify', { method: 'POST' })
      const data = await res.json()
      
      if (data.verified) {
        setStep(3)
        toast('¡Dominio verificado con éxito!', 'success')
      } else {
        toast('El dominio aún no está verificado. Esto puede tardar unos minutos.', 'info')
      }
    } catch (error: any) {
      toast('Error al verificar: ' + error.message, 'error')
    } finally {
      setVerifying(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast('Copiado al portapapeles', 'success')
  }

  const handleReset = async () => {
    if (!confirm('¿Estás seguro? Tendrás que empezar la configuración desde cero.')) return
    setLoading(true)
    try {
      await fetch('/api/tenant/email-setup', { method: 'DELETE' })
      setStep(1)
      setDnsRecords([])
      setDomain('')
    } catch (error: any) {
      toast('Error al reiniciar: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Stepper Header */}
      <div className="flex items-center justify-center mb-8 gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="border-t-4 border-t-blue-600 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Globe className="text-blue-600" />
              Configura tu Dominio de Email
            </CardTitle>
            <CardDescription>
              Tus clientes verán que los correos vienen directamente de tu propia marca.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateDomain}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="domain">Dominio de tu empresa</Label>
                  <Input 
                    id="domain" 
                    placeholder="ej: miempresa.com" 
                    value={domain} 
                    onChange={(e) => setDomain(e.target.value)}
                    required 
                  />
                  <p className="text-xs text-muted-foreground">Debes tener acceso a los registros DNS de este dominio.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromName">Nombre del Remitente</Label>
                  <Input 
                    id="fromName" 
                    placeholder="ej: Ferretería Central" 
                    value={fromName} 
                    onChange={(e) => setFromName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prefix">Prefijo del email</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="prefix" 
                    className="w-32 text-right" 
                    value={fromPrefix} 
                    onChange={(e) => setFromPrefix(e.target.value.toLowerCase())}
                    required 
                  />
                  <span className="text-gray-500 font-medium">@{domain || 'tu-dominio.com'}</span>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
                <Mail className="text-blue-600 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-900 text-sm">Vista previa</h4>
                  <p className="text-blue-800 text-sm">
                    Los emails se enviarán como: <strong>{fromName || 'Tu Empresa'} &lt;{fromPrefix || 'hola'}@{domain || 'tu-dominio.com'}&gt;</strong>
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button type="button" variant="ghost" disabled={loading}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                Continuar
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 2 && (dnsRecords.length > 0) && (
        <Card className="border-t-4 border-t-amber-500 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldCheck className="text-amber-600" />
              Configuración DNS
            </CardTitle>
            <CardDescription>
              Copia estos registros en el panel de control de tu dominio (Cloudflare, GoDaddy, etc.) para verificar la propiedad.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 font-medium border-bottom">
                  <tr>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Nombre / Host</th>
                    <th className="px-4 py-3 text-left">Valor / Contenido</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dnsRecords.map((record, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs"><span className="bg-gray-100 px-1.5 py-0.5 rounded italic">{record.type}</span></td>
                      <td className="px-4 py-3 font-mono text-xs break-all max-w-[200px]">{record.name}</td>
                      <td className="px-4 py-3 font-mono text-[10px] break-all max-w-[300px] text-gray-600">{record.value}</td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => copyToClipboard(record.value)}
                          className="h-8 w-8 hover:text-blue-600"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>La propagación DNS puede tardar hasta 48 horas, aunque usualmente toma menos de 10 minutos.</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleReset} disabled={loading || verifying}>Reiniciar</Button>
            <Button 
                onClick={handleVerify} 
                className="bg-amber-600 hover:bg-amber-700" 
                disabled={verifying}
            >
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {verifying ? 'Verificando...' : 'Verificar registros DNS'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-t-4 border-t-green-500 shadow-xl text-center py-8">
          <CardContent className="space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-3xl">¡Configuración Completa!</CardTitle>
            <p className="text-gray-600 max-w-md mx-auto">
              Tu dominio <strong>{domain}</strong> ha sido verificado. 
              Ahora todos tus correos saldrán desde <strong>{fromPrefix}@{domain}</strong>.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button 
              className="bg-green-600 hover:bg-green-700 min-w-[200px]" 
              onClick={() => {
                if (onComplete) onComplete()
                else if (mode === 'onboarding') router.push('/dashboard')
                else router.refresh()
              }}
            >
              Comenzar a usar
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
