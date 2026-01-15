'use client'

import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings as SettingsIcon, Loader2 } from 'lucide-react'

interface GeneralFormData {
  timezone: string
  currency: string
  dateFormat: string
  timeFormat: string
  language: string
  invoicePrefix: string
  invoiceNumberFormat: string
  quotationPrefix: string
  quotationNumberFormat: string
  purchaseOrderPrefix: string
  purchaseOrderNumberFormat: string
}

interface GeneralConfigProps {
  settings: any
  onSave: (data: Partial<GeneralFormData>) => void
  isLoading: boolean
}

const timezones = [
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
]

const currencies = [
  { value: 'COP', label: 'Peso Colombiano (COP)' },
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'MXN', label: 'Peso Mexicano (MXN)' },
  { value: 'CLP', label: 'Peso Chileno (CLP)' },
  { value: 'ARS', label: 'Peso Argentino (ARS)' },
]

export function GeneralConfig({ settings, onSave, isLoading }: GeneralConfigProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<GeneralFormData>({
    defaultValues: {
      timezone: settings?.timezone || 'America/Bogota',
      currency: settings?.currency || 'COP',
      dateFormat: settings?.dateFormat || 'DD/MM/YYYY',
      timeFormat: settings?.timeFormat || '24h',
      language: settings?.language || 'es',
      invoicePrefix: settings?.invoicePrefix || 'FV',
      invoiceNumberFormat: settings?.invoiceNumberFormat || '000000',
      quotationPrefix: settings?.quotationPrefix || 'COT',
      quotationNumberFormat: settings?.quotationNumberFormat || '000000',
      purchaseOrderPrefix: settings?.purchaseOrderPrefix || 'OC',
      purchaseOrderNumberFormat: settings?.purchaseOrderNumberFormat || '000000',
    }
  })

  const onSubmit = (data: GeneralFormData) => {
    onSave(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Configuración General
        </CardTitle>
        <CardDescription>
          Personaliza la configuración general de tu empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Localización */}
          <div className="space-y-4 pt-4">
            <h3 className="font-semibold">Localización</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona Horaria</Label>
                <Select
                  value={watch('timezone')}
                  onValueChange={(value) => setValue('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={watch('currency')}
                  onValueChange={(value) => setValue('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Formato de Fecha</Label>
                <Select
                  value={watch('dateFormat')}
                  onValueChange={(value) => setValue('dateFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeFormat">Formato de Hora</Label>
                <Select
                  value={watch('timeFormat')}
                  onValueChange={(value) => setValue('timeFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12 horas (AM/PM)</SelectItem>
                    <SelectItem value="24h">24 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={watch('language')}
                  onValueChange={(value) => setValue('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Numeración de Documentos */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Numeración de Documentos</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Prefijo Facturas</Label>
                  <Input
                    id="invoicePrefix"
                    {...register('invoicePrefix')}
                    placeholder="FV"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceNumberFormat">Formato Número Facturas</Label>
                  <Input
                    id="invoiceNumberFormat"
                    {...register('invoiceNumberFormat')}
                    placeholder="000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quotationPrefix">Prefijo Cotizaciones</Label>
                  <Input
                    id="quotationPrefix"
                    {...register('quotationPrefix')}
                    placeholder="COT"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotationNumberFormat">Formato Número Cotizaciones</Label>
                  <Input
                    id="quotationNumberFormat"
                    {...register('quotationNumberFormat')}
                    placeholder="000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseOrderPrefix">Prefijo Órdenes de Compra</Label>
                  <Input
                    id="purchaseOrderPrefix"
                    {...register('purchaseOrderPrefix')}
                    placeholder="OC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseOrderNumberFormat">Formato Número Órdenes</Label>
                  <Input
                    id="purchaseOrderNumberFormat"
                    {...register('purchaseOrderNumberFormat')}
                    placeholder="000000"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

