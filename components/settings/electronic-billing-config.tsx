'use client'

import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface ElectronicBillingFormData {
  electronicBillingProvider: string
  electronicBillingApiUrl?: string
  electronicBillingApiKey?: string
  companyNit: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  billingResolutionNumber: string
  billingResolutionPrefix: string
  billingResolutionFrom: string
  billingResolutionTo: string
  billingResolutionValidFrom: string
  billingResolutionValidTo: string
  softwareId?: string
  softwarePin?: string
  technicalKey?: string
  alegraEmail?: string
  alegraToken?: string
}

interface ElectronicBillingConfigProps {
  settings: any
  onSave: (data: Partial<ElectronicBillingFormData>) => void
  isLoading: boolean
}

export function ElectronicBillingConfig({ settings, onSave, isLoading }: ElectronicBillingConfigProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ElectronicBillingFormData>({
    defaultValues: {
      electronicBillingProvider: settings?.electronicBillingProvider || 'FEG',
      electronicBillingApiUrl: settings?.electronicBillingApiUrl || '',
      electronicBillingApiKey: settings?.electronicBillingApiKey || '',
      companyNit: settings?.companyNit || '',
      companyName: settings?.companyName || '',
      companyAddress: settings?.companyAddress || '',
      companyPhone: settings?.companyPhone || '',
      companyEmail: settings?.companyEmail || '',
      billingResolutionNumber: settings?.billingResolutionNumber || '',
      billingResolutionPrefix: settings?.billingResolutionPrefix || 'FV',
      billingResolutionFrom: settings?.billingResolutionFrom || '1',
      billingResolutionTo: settings?.billingResolutionTo || '999999',
      billingResolutionValidFrom: (() => {
        try {
          const d = settings?.billingResolutionValidFrom ? new Date(settings.billingResolutionValidFrom) : new Date()
          return isNaN(d.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(d, 'yyyy-MM-dd')
        } catch { return format(new Date(), 'yyyy-MM-dd') }
      })(),
      billingResolutionValidTo: (() => {
        try {
          const d = settings?.billingResolutionValidTo ? new Date(settings.billingResolutionValidTo) : new Date(new Date().setFullYear(new Date().getFullYear() + 1))
          return isNaN(d.getTime()) ? format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd') : format(d, 'yyyy-MM-dd')
        } catch { return format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd') }
      })(),
      softwareId: settings?.softwareId || '',
      softwarePin: settings?.softwarePin || '',
      technicalKey: settings?.technicalKey || '',
      alegraEmail: settings?.alegraEmail || '',
      alegraToken: settings?.alegraToken || '',
    }
  })

  const provider = watch('electronicBillingProvider')

  const onSubmit = (data: ElectronicBillingFormData) => {
    onSave({
      ...data,
      billingResolutionValidFrom: new Date(data.billingResolutionValidFrom).toISOString(),
      billingResolutionValidTo: new Date(data.billingResolutionValidTo).toISOString(),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Facturación Electrónica
        </CardTitle>
        <CardDescription>
          Configura las credenciales y parámetros para la facturación electrónica DIAN
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Proveedor */}
          <div className="space-y-2">
            <Label htmlFor="electronicBillingProvider">Proveedor de Facturación Electrónica</Label>
            <Select
              value={watch('electronicBillingProvider')}
              onValueChange={(value) => setValue('electronicBillingProvider', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALEGRA">Alegra (Recomendado)</SelectItem>
                <SelectItem value="FEG">Facturación Electrónica Gratuita (FEG)</SelectItem>
                <SelectItem value="CUSTOM">Proveedor Personalizado</SelectItem>
                <SelectItem value="DIAN_DIRECT">Integración Directa con DIAN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ALEGRA Configuration */}
          {provider === 'ALEGRA' && (
            <>
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Credenciales de Alegra</h3>
                <p className="text-sm text-muted-foreground">
                  Ingresa el correo viculado a tu cuenta de Alegra y tu Token de API.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="alegraEmail">Correo Electrónico (Alegra)</Label>
                  <Input
                    id="alegraEmail"
                    type="email"
                    {...register('alegraEmail')}
                    placeholder="ejemplo@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alegraToken">Token API</Label>
                  <Input
                    id="alegraToken"
                    type="password"
                    {...register('alegraToken')}
                    placeholder="Token de acceso..."
                  />
                </div>
              </div>
            </>
          )}

          {/* API URL y Key (solo para CUSTOM) */}
          {provider === 'CUSTOM' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="electronicBillingApiUrl">URL de la API</Label>
                <Input
                  id="electronicBillingApiUrl"
                  {...register('electronicBillingApiUrl')}
                  placeholder="https://api.tu-proveedor.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="electronicBillingApiKey">API Key</Label>
                <Input
                  id="electronicBillingApiKey"
                  type="password"
                  {...register('electronicBillingApiKey')}
                  placeholder="Tu API Key"
                />
              </div>
            </>
          )}

          {/* Configuration for DIAN Direct */}
          {provider === 'DIAN_DIRECT' && (
            <>
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Credenciales Técnicas DIAN</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="softwareId">ID de Software</Label>
                    <Input
                      id="softwareId"
                      {...register('softwareId')}
                      placeholder="Identificador del software habilitado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="softwarePin">PIN de Software</Label>
                    <Input
                      id="softwarePin"
                      type="password"
                      {...register('softwarePin')}
                      placeholder="PIN de 5 dígitos"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technicalKey">Clave Técnica (Rango de Numeración)</Label>
                  <Input
                    id="technicalKey"
                    type="password"
                    {...register('technicalKey')}
                    placeholder="Clave para cálculo de CUFE"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Certificado Digital (.p12)</Label>
                  <div className="p-4 border rounded-md bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Para habilitar la firma digital, carga tu certificado .p12 otorgado por una entidad autorizada (ej. Andes SCD, GSE).
                    </p>
                    <Button variant="outline" size="sm" type="button" onClick={() => alert('La carga de archivos estará disponible pronto')}>
                      Seleccionar Archivo .p12
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Datos de la Empresa */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Datos de la Empresa</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyNit">NIT *</Label>
                <Input
                  id="companyNit"
                  {...register('companyNit', { required: 'El NIT es requerido' })}
                  placeholder="900000000-1"
                />
                {errors.companyNit && (
                  <p className="text-sm text-destructive">{errors.companyNit.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre de la Empresa *</Label>
                <Input
                  id="companyName"
                  {...register('companyName', { required: 'El nombre es requerido' })}
                  placeholder="Mi Empresa S.A.S"
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAddress">Dirección</Label>
              <Input
                id="companyAddress"
                {...register('companyAddress')}
                placeholder="Calle 123 #45-67"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Teléfono</Label>
                <Input
                  id="companyPhone"
                  {...register('companyPhone')}
                  placeholder="+57 300 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  {...register('companyEmail')}
                  placeholder="facturacion@empresa.com"
                />
              </div>
            </div>
          </div>

          {/* Resolución de Facturación */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Resolución de Facturación</h3>

            <div className="space-y-2">
              <Label htmlFor="billingResolutionNumber">Número de Resolución *</Label>
              <Input
                id="billingResolutionNumber"
                {...register('billingResolutionNumber', { required: 'El número de resolución es requerido' })}
                placeholder="12345678901234"
              />
              {errors.billingResolutionNumber && (
                <p className="text-sm text-destructive">{errors.billingResolutionNumber.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingResolutionPrefix">Prefijo *</Label>
                <Input
                  id="billingResolutionPrefix"
                  {...register('billingResolutionPrefix', { required: 'El prefijo es requerido' })}
                  placeholder="FV"
                />
                {errors.billingResolutionPrefix && (
                  <p className="text-sm text-destructive">{errors.billingResolutionPrefix.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingResolutionFrom">Desde *</Label>
                <Input
                  id="billingResolutionFrom"
                  {...register('billingResolutionFrom', { required: 'El rango inicial es requerido' })}
                  placeholder="1"
                />
                {errors.billingResolutionFrom && (
                  <p className="text-sm text-destructive">{errors.billingResolutionFrom.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingResolutionTo">Hasta *</Label>
                <Input
                  id="billingResolutionTo"
                  {...register('billingResolutionTo', { required: 'El rango final es requerido' })}
                  placeholder="999999"
                />
                {errors.billingResolutionTo && (
                  <p className="text-sm text-destructive">{errors.billingResolutionTo.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingResolutionValidFrom">Válida Desde *</Label>
                <Input
                  id="billingResolutionValidFrom"
                  type="date"
                  {...register('billingResolutionValidFrom', { required: 'La fecha de inicio es requerida' })}
                />
                {errors.billingResolutionValidFrom && (
                  <p className="text-sm text-destructive">{errors.billingResolutionValidFrom.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingResolutionValidTo">Válida Hasta *</Label>
                <Input
                  id="billingResolutionValidTo"
                  type="date"
                  {...register('billingResolutionValidTo', { required: 'La fecha de fin es requerida' })}
                />
                {errors.billingResolutionValidTo && (
                  <p className="text-sm text-destructive">{errors.billingResolutionValidTo.message}</p>
                )}
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

