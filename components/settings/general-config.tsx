'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Settings as SettingsIcon, Loader2, Plus, Trash2, Printer, MapPin, Hash, Building2, Receipt, FileText, ShoppingCart, Search, Network } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

// Interfaces for custom settings structure
interface PrinterDefinition {
  id: string
  name: string
  type: 'thermal' | 'laser' // For now mainly thermal
  interfaceType: 'usb' | 'lan' | 'bluetooth'
  interfaceConfig: string // IP for LAN, empty/device ID for USB
  width: 58 | 80
  columns: 48 | 42
  active: boolean
  default: boolean
}

interface CustomSettings {
  identity?: {
    logo?: string
    regime?: string
    city?: string
    country?: string
    website?: string
  }
  printing?: {
    enabled: boolean
    paperWidth: 58 | 80
    type: 'html' | 'escpos'
    font?: 'monospace'
    autoCut: boolean
    printers: PrinterDefinition[]
    ticketDesign: {
      showLogo: boolean
      logoWidth?: number
      showQr: boolean
      showCufe: boolean
      footerText: string
      separator: 'dashes' | 'dots' | 'lines'
    }
    posBehavior: {
      autoPrint: boolean
      previewBeforePrint: boolean
      copies: number
      retryOnFail: boolean
    }
  }
}

interface GeneralFormData {
  // Localization
  timezone: string
  currency: string
  dateFormat: string
  timeFormat: string
  language: string

  // Numbering
  invoicePrefix: string
  invoiceNumberFormat: string
  quotationPrefix: string
  quotationNumberFormat: string
  purchaseOrderPrefix: string
  purchaseOrderNumberFormat: string

  // Identity (Mixed: some in TenantSettings columns, some in customSettings)
  companyName: string
  companyNit: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyRegime: string // Stored in customSettings or separate state mapping
  companyCity: string
  companyWebsite: string

  // Custom Settings (JSON)
  customSettings: string
}

interface GeneralConfigProps {
  settings: any
  onSave: (data: any) => void
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

const regimes = [
  'Responsable de IVA',
  'No responsable de IVA',
  'Régimen Simple',
  'Gran Contribuyente',
]

export function GeneralConfig({ settings, onSave, isLoading }: GeneralConfigProps) {
  const { toast } = useToast()

  // Parse initial custom settings
  const initialCustomSettings: CustomSettings = settings?.customSettings
    ? JSON.parse(settings.customSettings)
    : { printing: { printers: [], ticketDesign: { showLogo: true, showQr: true, showCufe: true, footerText: 'Gracias por su compra', separator: 'dashes' }, posBehavior: { autoPrint: false, previewBeforePrint: true, copies: 1, retryOnFail: false }, enabled: true, paperWidth: 80, type: 'escpos', autoCut: true } }

  const [activeTab, setActiveTab] = useState('identity')
  const [printers, setPrinters] = useState<PrinterDefinition[]>(initialCustomSettings.printing?.printers || [])

  // Scanner State
  const [isScanning, setIsScanning] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [scannedDevices, setScannedDevices] = useState<{ ip: string, name: string, port: number }[]>([])

  const scanNetwork = async () => {
    try {
      setIsScanning(true)
      toast('Escaneando red local (puerto 9100)... Esto puede tardar unos segundos.', 'info')

      const res = await fetch('/api/settings/scan-printers')
      if (!res.ok) throw new Error('Error al escanear')
      const data = await res.json()

      if (data.devices) {
        setScannedDevices(data.devices)
        setShowScanDialog(true)
        if (data.devices.length === 0) {
          toast('No se encontraron dispositivos en el puerto 9100', 'warning')
        } else {
          toast(`Se encontraron ${data.devices.length} dispositivos`, 'success')
        }
      }
    } catch (error: any) {
      toast('Error al buscar impresoras: ' + error.message, 'error')
    } finally {
      setIsScanning(false)
    }
  }

  const addScannedPrinter = (device: { ip: string, name: string }) => {
    const newPrinter: PrinterDefinition = {
      id: crypto.randomUUID(),
      name: device.name,
      type: 'thermal',
      interfaceType: 'lan',
      interfaceConfig: `${device.ip}:9100`, // Default RAW port
      width: 80,
      columns: 48,
      active: true,
      default: printers.length === 0
    }
    const updatedPrinters = [...printers, newPrinter]
    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
    setShowScanDialog(false)
    toast('Impresora agregada exitosamente', 'success')
  }

  // Initialize form
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
      companyName: settings?.companyName || '',
      companyNit: settings?.companyNit || '',
      companyAddress: settings?.companyAddress || '',
      companyPhone: settings?.companyPhone || '',
      companyEmail: settings?.companyEmail || '',
      companyRegime: initialCustomSettings.identity?.regime || 'Responsable de IVA',
      companyCity: initialCustomSettings.identity?.city || '',
      companyWebsite: initialCustomSettings.identity?.website || '',
      customSettings: settings?.customSettings || '{}'
    }
  })

  // Watchers for custom logic
  const printingEnabled = watch('customSettings') ? JSON.parse(watch('customSettings') || '{}')?.printing?.enabled : false

  // Helper to update custom settings state
  const updateCustomSettings = (updater: (prev: CustomSettings) => CustomSettings) => {
    const current = watch('customSettings') ? JSON.parse(watch('customSettings')) : initialCustomSettings
    const updated = updater(current || initialCustomSettings)
    setValue('customSettings', JSON.stringify(updated))
  }

  // Identity field updaters (that go into customSettings)
  const handleIdentityChange = (field: keyof NonNullable<CustomSettings['identity']>, value: string) => {
    updateCustomSettings(prev => ({
      ...prev,
      identity: { ...prev.identity, [field]: value }
    }))
  }

  // Printing field updaters
  const handlePrintingChange = (field: keyof NonNullable<CustomSettings['printing']>, value: any) => {
    updateCustomSettings(prev => ({
      ...prev,
      printing: { ...(prev.printing as any), [field]: value }
    }))
  }

  // Ticket Design Updaters
  const handleTicketDesignChange = (field: string, value: any) => {
    updateCustomSettings(prev => ({
      ...prev,
      printing: {
        ...(prev.printing as any),
        ticketDesign: { ...prev.printing?.ticketDesign, [field]: value }
      }
    }))
  }

  const addPrinter = () => {
    const newPrinter: PrinterDefinition = {
      id: crypto.randomUUID(),
      name: 'Nueva Impresora',
      type: 'thermal',
      interfaceType: 'lan', // Default to LAN as it's cleaner to config manually
      interfaceConfig: '',
      width: 80,
      columns: 48,
      active: true,
      default: printers.length === 0
    }
    const updatedPrinters = [...printers, newPrinter]
    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
  }

  const updatePrinter = (id: string, field: keyof PrinterDefinition, value: any) => {
    const updatedPrinters = printers.map(p => {
      if (p.id !== id) return p
      // handle default toggle logic
      if (field === 'default' && value === true) {
        // disable default for others if this one is set to true
        // (will be handled by a second map pass or effect if needed, but here simple mapped update)
        return { ...p, [field]: value }
      }
      return { ...p, [field]: value }
    })

    // Ensure only one default
    if (field === 'default' && value === true) {
      updatedPrinters.forEach(p => {
        if (p.id !== id) p.default = false
      })
    }

    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
  }

  const removePrinter = (id: string) => {
    const updatedPrinters = printers.filter(p => p.id !== id)
    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
  }

  const onSubmit = (data: GeneralFormData) => {
    // Merge identity fields from form form into customSettings object
    const currentCustom = data.customSettings ? JSON.parse(data.customSettings) : {}
    const finalCustom: CustomSettings = {
      ...currentCustom,
      identity: {
        ...currentCustom.identity,
        regime: data.companyRegime,
        city: data.companyCity,
        website: data.companyWebsite,
      },
      printing: {
        ...currentCustom.printing,
        printers: printers, // Ensure printers state is synced
      }
    }

    // Filter out fields that are NOT in TenantSettings schema
    // companyRegime, companyCity, companyWebsite are stored in customSettings JSON, 
    // but the form has them as top-level inputs which causes Prisma "Unknown argument" error.
    const { companyRegime, companyCity, companyWebsite, ...schemaData } = data;

    // Clean payload for API (API expects root fields + customSettings string)
    const payload = {
      ...schemaData,
      customSettings: JSON.stringify(finalCustom)
    }
    onSave(payload)
  }

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-xl">
          <SettingsIcon className="h-5 w-5" />
          Configuración General
        </CardTitle>
        <CardDescription>
          Administra la identidad global, localización, numeración y dispositivos de impresión.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="identity" className="gap-2"><Building2 className="h-4 w-4" /> Identidad</TabsTrigger>
              <TabsTrigger value="localization" className="gap-2"><MapPin className="h-4 w-4" /> Localización</TabsTrigger>
              <TabsTrigger value="numbering" className="gap-2"><Hash className="h-4 w-4" /> Numeración</TabsTrigger>
              <TabsTrigger value="printing" className="gap-2"><Printer className="h-4 w-4" /> Impresión</TabsTrigger>
            </TabsList>

            {/* === IDENTIDAD === */}
            <TabsContent value="identity" className="space-y-4 pt-4 animate-in fade-in slide-in-from-left-1 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre Comercial / Razón Social</Label>
                  <Input id="companyName" {...register('companyName')} placeholder="Mi Ferretería S.A.S" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyNit">NIT / Identificación Tributaria</Label>
                  <Input id="companyNit" {...register('companyNit')} placeholder="900.000.000-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRegime">Régimen Fiscal</Label>
                  <Select
                    value={watch('companyRegime')}
                    onValueChange={(val) => setValue('companyRegime', val)}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {regimes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCity">Ciudad</Label>
                  <Input id="companyCity" {...register('companyCity')} placeholder="Bogotá, Colombia" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Dirección</Label>
                  <Input id="companyAddress" {...register('companyAddress')} placeholder="Calle 123 # 45-67" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Teléfono</Label>
                  <Input id="companyPhone" {...register('companyPhone')} placeholder="+57 300 123 4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email de Contacto</Label>
                  <Input id="companyEmail" {...register('companyEmail')} placeholder="contacto@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Sitio Web (Opcional)</Label>
                  <Input id="companyWebsite" {...register('companyWebsite')} placeholder="www.empresa.com" />
                </div>
              </div>
            </TabsContent>

            {/* === LOCALIZACIÓN === */}
            <TabsContent value="localization" className="space-y-4 pt-4 animate-in fade-in slide-in-from-left-1 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select value={watch('timezone')} onValueChange={(val) => setValue('timezone', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={watch('currency')} onValueChange={(val) => setValue('currency', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato de Fecha</Label>
                  <Select value={watch('dateFormat')} onValueChange={(val) => setValue('dateFormat', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato de Hora</Label>
                  <Select value={watch('timeFormat')} onValueChange={(val) => setValue('timeFormat', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12 horas (05:30 PM)</SelectItem>
                      <SelectItem value="24h">24 horas (17:30)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* === NUMERACIÓN === */}
            <TabsContent value="numbering" className="space-y-4 pt-4 animate-in fade-in slide-in-from-left-1 duration-300">
              <div className="space-y-6">
                {/* Facturas */}
                <div className="p-4 border rounded-lg bg-gray-50/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4" /> Facturación POS / Venta</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prefijo (Ej: POS-)</Label>
                      <Input {...register('invoicePrefix')} placeholder="POS" />
                    </div>
                    <div>
                      <Label>Formato (Ceros a la izquierda)</Label>
                      <Input {...register('invoiceNumberFormat')} placeholder="000000" />
                    </div>
                  </div>
                </div>

                {/* Cotizaciones */}
                <div className="p-4 border rounded-lg bg-gray-50/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Cotizaciones</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prefijo (Ej: COT-)</Label>
                      <Input {...register('quotationPrefix')} placeholder="COT" />
                    </div>
                    <div>
                      <Label>Formato</Label>
                      <Input {...register('quotationNumberFormat')} placeholder="000000" />
                    </div>
                  </div>
                </div>

                {/* Órdenes de Compra */}
                <div className="p-4 border rounded-lg bg-gray-50/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Órdenes de Compra</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prefijo (Ej: OC-)</Label>
                      <Input {...register('purchaseOrderPrefix')} placeholder="OC" />
                    </div>
                    <div>
                      <Label>Formato</Label>
                      <Input {...register('purchaseOrderNumberFormat')} placeholder="000000" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* === IMPRESIÓN === */}
            <TabsContent value="printing" className="space-y-4 pt-4 animate-in fade-in slide-in-from-left-1 duration-300">

              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                <div className="space-y-1">
                  <h3 className="font-medium">Habilitar Impresión Térmica</h3>
                  <p className="text-sm text-gray-500">Permite imprimir tickets POS desde la aplicación.</p>
                </div>
                <Switch
                  checked={initialCustomSettings.printing?.enabled} // This is read-only from prop/state, handled via updateCustomSettings
                  onCheckedChange={(checked) => handlePrintingChange('enabled', checked)}
                />
              </div>

              {/* Lista de Impresoras */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Impresoras Registradas</h3>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={scanNetwork} disabled={isScanning} className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      {isScanning ? 'Buscando...' : 'Escanear Red'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addPrinter} className="gap-2">
                      <Plus className="h-3 w-3" /> Agregar Manual
                    </Button>
                  </div>
                </div>

                {printers.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg text-gray-400">
                    <Printer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tienes impresoras configuradas</p>
                    <Button type="button" variant="link" onClick={scanNetwork} className="mt-2 text-blue-500">
                      Intentar búsqueda automática
                    </Button>
                  </div>
                )}

                <div className="grid gap-3">
                  {printers.map((printer, index) => (
                    <div key={printer.id} className="p-4 border rounded-lg bg-white space-y-3 relative group">
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removePrinter(printer.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                        <div className="space-y-1">
                          <Label className="text-xs">Nombre</Label>
                          <Input value={printer.name} onChange={(e) => updatePrinter(printer.id, 'name', e.target.value)} placeholder="Ej: Caja Principal" className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Interfaz</Label>
                          <div className="flex gap-2">
                            <Select value={printer.interfaceType} onValueChange={(val) => updatePrinter(printer.id, 'interfaceType', val)}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lan">LAN (Ethernet/WiFi)</SelectItem>
                                <SelectItem value="usb">USB (Directo)</SelectItem>
                              </SelectContent>
                            </Select>
                            {printer.interfaceType === 'lan' && (
                              <Input value={printer.interfaceConfig} onChange={(e) => updatePrinter(printer.id, 'interfaceConfig', e.target.value)} placeholder="IP:Puerto (192.168.1.200:9100)" className="h-8 flex-1" />
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Ancho Papel</Label>
                            <Select value={String(printer.width)} onValueChange={(val) => updatePrinter(printer.id, 'width', Number(val))}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="80">80 mm (Estándar)</SelectItem>
                                <SelectItem value="58">58 mm (Pequeño)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Columnas</Label>
                            <Select value={String(printer.columns)} onValueChange={(val) => updatePrinter(printer.id, 'columns', Number(val))}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="48">48 cols (Normal 80mm)</SelectItem>
                                <SelectItem value="42">42 cols (Grande)</SelectItem>
                                <SelectItem value="32">32 cols (58mm)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pt-4">
                          <div className="flex items-center gap-2">
                            <Switch checked={printer.default} onCheckedChange={(chk) => updatePrinter(printer.id, 'default', chk)} id={`default-${printer.id}`} />
                            <Label htmlFor={`default-${printer.id}`} className="cursor-pointer">Predeterminada</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={printer.active} onCheckedChange={(chk) => updatePrinter(printer.id, 'active', chk)} id={`active-${printer.id}`} />
                            <Label htmlFor={`active-${printer.id}`} className="cursor-pointer">Activa</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diseño del Ticket - To be implemented fully, placeholder for now */}
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-3">Diseño del Ticket</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <Label className="text-xs">Mostrar Logo</Label>
                    <Switch
                      checked={initialCustomSettings.printing?.ticketDesign?.showLogo}
                      onCheckedChange={(chk) => handleTicketDesignChange('showLogo', chk)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <Label className="text-xs">Mostrar QR</Label>
                    <Switch
                      checked={initialCustomSettings.printing?.ticketDesign?.showQr}
                      onCheckedChange={(chk) => handleTicketDesignChange('showQr', chk)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Texto Pie de Página</Label>
                    <Input
                      value={initialCustomSettings.printing?.ticketDesign?.footerText || ''}
                      onChange={(e) => handleTicketDesignChange('footerText', e.target.value)}
                      className="h-8 mt-1"
                    />
                  </div>
                </div>
              </div>

            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-6 border-t font-medium">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispositivos Encontrados</DialogTitle>
            <DialogDescription>
              Se encontraron los siguientes dispositivos escuchando en el puerto 9100.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {scannedDevices.map((device) => (
              <div key={device.ip} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => addScannedPrinter(device)}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Printer className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{device.name}</div>
                    <div className="text-xs text-gray-500">{device.ip}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-blue-600">
                  + Agregar
                </Button>
              </div>
            ))}
            {scannedDevices.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No se encontraron resultados. Asegúrate que la impresora esté encendida y en la misma red.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowScanDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

