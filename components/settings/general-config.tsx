'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs' // Removed for vertical layout
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Settings as SettingsIcon, Loader2, Plus, Trash2, Printer, MapPin, Hash, Building2, Receipt, FileText, ShoppingCart, Search, Network, Edit, Warehouse, Settings } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { TicketEditor, TicketDesignSettings } from './ticket-editor'
import { MetaConfig } from './meta-config'
import { ZoneManager } from '../warehouses/zone-manager'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
    ticketDesign: TicketDesignSettings
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

  // Restaurant Mode
  enableRestaurantMode: boolean

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

  const [scannedDevices, setScannedDevices] = useState<{ ip: string, name: string, port: number }[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [showTicketEditor, setShowTicketEditor] = useState(false)
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false)
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null)
  const [newWarehouse, setNewWarehouse] = useState({ name: '', address: '', active: true })
  const queryClient = useQueryClient()

  // Fetch warehouses
  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Failed to fetch warehouses')
      return res.json()
    }
  })

  // Create warehouse mutation
  const createWarehouseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear almacén')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setShowWarehouseDialog(false)
      setNewWarehouse({ name: '', address: '', active: true })
      toast('Almacén creado exitosamente', 'success')
    },
    onError: (err: any) => {
      toast(err.message, 'error')
    }
  })

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
      enableRestaurantMode: settings?.enableRestaurantMode || false,
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

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <aside className="lg:w-64 flex-shrink-0">
              <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-4 lg:pb-0">
                <Button
                  type="button"
                  variant={activeTab === 'identity' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('identity')}
                >
                  <Building2 className="mr-2 h-4 w-4" /> Identidad
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'localization' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('localization')}
                >
                  <MapPin className="mr-2 h-4 w-4" /> Regional
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'numbering' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('numbering')}
                >
                  <Hash className="mr-2 h-4 w-4" /> Numeración
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'printing' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('printing')}
                >
                  <Printer className="mr-2 h-4 w-4" /> Impresión POS
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'meta' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('meta')}
                >
                  <Network className="mr-2 h-4 w-4" /> Integraciones
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'inventory' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('inventory')}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" /> Inventario
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'warehouses' ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab('warehouses')}
                >
                  <Warehouse className="mr-2 h-4 w-4" /> Almacenes
                </Button>
              </nav>
            </aside>

            {/* Content Area */}
            <div className="flex-1 space-y-4">
              {/* Identity Content */}
              {activeTab === 'identity' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nombre Comercial</Label>
                      <Input id="companyName" {...register('companyName')} placeholder="Mi Ferretería S.A.S" />
                    </div>
                    {/* ... (Existing Identity Fields preserved/restored below in blocks effectively) ... */}
                    {/* Simplified for Diff - assuming surrounding code handles the fields, we just wrap them */}
                    <div className="space-y-2">
                      <Label htmlFor="companyNit">NIT / ID Tributario</Label>
                      <Input id="companyNit" {...register('companyNit')} placeholder="900.000.000-1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyRegime">Régimen</Label>
                      <Select value={watch('companyRegime')} onValueChange={(val) => setValue('companyRegime', val)}>
                        <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                        <SelectContent>{regimes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Ciudad</Label><Input {...register('companyCity')} /></div>
                    <div className="space-y-2"><Label>Dirección</Label><Input {...register('companyAddress')} /></div>
                    <div className="space-y-2"><Label>Teléfono</Label><Input {...register('companyPhone')} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input {...register('companyEmail')} /></div>
                    <div className="space-y-2"><Label>Web</Label><Input {...register('companyWebsite')} /></div>
                  </div>
                </div>
              )}

              {/* Localization Content */}
              {activeTab === 'localization' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
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
                  {/* ... Date/Time formats ... */}
                  <div className="space-y-2"><Label>Fecha</Label><Select value={watch('dateFormat')} onValueChange={v => setValue('dateFormat', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Hora</Label><Select value={watch('timeFormat')} onValueChange={v => setValue('timeFormat', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12h">12h</SelectItem><SelectItem value="24h">24h</SelectItem></SelectContent></Select></div>
                </div>
              )}

              {/* Numbering Content */}
              {activeTab === 'numbering' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="p-4 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4" /> Facturación</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Prefijo</Label><Input {...register('invoicePrefix')} /></div>
                      <div><Label>Formato</Label><Input {...register('invoiceNumberFormat')} /></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Cotizaciones</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Prefijo</Label><Input {...register('quotationPrefix')} /></div>
                      <div><Label>Formato</Label><Input {...register('quotationNumberFormat')} /></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Compras</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Prefijo</Label><Input {...register('purchaseOrderPrefix')} /></div>
                      <div><Label>Formato</Label><Input {...register('purchaseOrderNumberFormat')} /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Printing Content (Preserving key mechanics) */}
              {activeTab === 'printing' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
                    <div className="space-y-1">
                      <h3 className="font-medium">Habilitar Impresión Térmica</h3>
                      <p className="text-sm text-gray-500">Motor de impresión directa para POS.</p>
                    </div>
                    <Switch
                      checked={initialCustomSettings.printing?.enabled}
                      onCheckedChange={(checked) => handlePrintingChange('enabled', checked)}
                    />
                  </div>

                  {/* Printers List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Dispositivos</h3>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={scanNetwork} disabled={isScanning}>
                          {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Escanear'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={addPrinter}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {/* Printers Loop */}
                    {printers.map((printer, index) => (
                      <div key={printer.id} className="p-4 border rounded-lg bg-white dark:bg-slate-950 space-y-3 relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-red-500 h-8 w-8" onClick={() => removePrinter(printer.id)}><Trash2 className="h-4 w-4" /></Button>
                        <div className="grid md:grid-cols-2 gap-4 pr-8">
                          <div className="space-y-1"><Label className="text-xs">Nombre</Label><Input value={printer.name} onChange={(e) => updatePrinter(printer.id, 'name', e.target.value)} className="h-8" /></div>
                          <div className="space-y-1"><Label className="text-xs">IP / Puerto</Label><Input value={printer.interfaceConfig} onChange={(e) => updatePrinter(printer.id, 'interfaceConfig', e.target.value)} className="h-8" /></div>
                        </div>
                      </div>
                    ))}
                    {printers.length === 0 && <div className="text-center py-4 text-sm text-gray-400 border border-dashed rounded">Sin impresoras</div>}
                  </div>

                  {/* Ticket Design */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Plantilla de Ticket</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowTicketEditor(true)}>Editar Diseño</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Meta Content */}
              {activeTab === 'meta' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <MetaConfig />
                </div>
              )}

              {/* Warehouses Content */}
              {activeTab === 'warehouses' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Gestión de Almacenes</h3>
                      <p className="text-sm text-gray-500">Configura los puntos físicos de inventario.</p>
                    </div>
                    <Button type="button" onClick={() => setShowWarehouseDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Almacén
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isLoadingWarehouses ? (
                      <div className="col-span-2 flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      warehouses.map((w: any) => (
                        <div key={w.id} className="p-4 border rounded-xl bg-white dark:bg-slate-950 flex flex-col h-fit">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-bold flex items-center gap-2">
                                {w.name}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${w.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {w.active ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {w.address || 'Sin dirección'}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setExpandedWarehouseId(expandedWarehouseId === w.id ? null : w.id)}
                                title="Ver zonas"
                              >
                                {expandedWarehouseId === w.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {expandedWarehouseId === w.id && (
                            <div className="mt-4 pt-4 border-t space-y-4 animate-in slide-in-from-top-2 duration-200">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Zonas de Almacenamiento</h4>
                              </div>
                              <ZoneManager warehouseId={w.id} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {!isLoadingWarehouses && warehouses.length === 0 && (
                      <div className="col-span-2 text-center py-12 text-gray-500 border border-dashed rounded-xl">
                        No hay almacenes configurados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inventory Content */}
              {activeTab === 'inventory' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="p-4 border rounded-xl bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-bold text-orange-900 dark:text-orange-100">Modo Restaurante</h3>
                        <p className="text-sm text-orange-800/70 dark:text-orange-200/60">
                          Habilita funciones avanzadas como recetas (BOM), gestión de ingredientes, mermas y consumo automático en POS.
                        </p>
                      </div>
                      <Switch
                        checked={watch('enableRestaurantMode')}
                        onCheckedChange={(checked) => setValue('enableRestaurantMode', checked)}
                      />
                    </div>
                  </div>

                  {watch('enableRestaurantMode') && (
                    <div className="space-y-4 pt-2">
                      <div className="p-4 border rounded-xl bg-white dark:bg-slate-950 space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <SettingsIcon className="h-4 w-4 text-primary" />
                          Configuración de Restaurante
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Una vez activado, podrás configurar recetas en la gestión de productos y verás nuevas opciones en el módulo de inventario.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                          <div className="p-3 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                            <h4 className="text-sm font-medium mb-1">Recetas e Ingredientes</h4>
                            <p className="text-xs text-muted-foreground">Descuento automático de insumos al vender platos elaborados.</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                            <h4 className="text-sm font-medium mb-1">Control de Mermas</h4>
                            <p className="text-xs text-muted-foreground">Registro de desperdicios, vencimientos y consumo de personal.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

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
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Dispositivos Encontrados
            </DialogTitle>
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

      {/* Ticket Editor Dialog */}
      <Dialog open={showTicketEditor} onOpenChange={setShowTicketEditor}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Plantilla de Impresión
            </DialogTitle>
            <DialogDescription>
              Personaliza el diseño de tus tirillas de impresión. Los cambios se verán reflejados en tiempo real.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <TicketEditor
              settings={initialCustomSettings.printing?.ticketDesign as any || {}}
              companyInfo={{
                name: watch('companyName'),
                nit: watch('companyNit'),
                address: watch('companyAddress'),
                city: watch('companyCity'),
                phone: watch('companyPhone'),
                email: watch('companyEmail'),
                regime: watch('companyRegime')
              }}
              onChange={(newSettings) => {
                updateCustomSettings(prev => ({
                  ...prev,
                  printing: {
                    ...(prev.printing as any),
                    ticketDesign: newSettings
                  }
                }))
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowTicketEditor(false)}>Cancelar</Button>
            <Button onClick={() => setShowTicketEditor(false)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Crear Nuevo Almacén
            </DialogTitle>
            <DialogDescription>
              Define un nuevo punto de almacenamiento para tu inventario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="w-name">Nombre del Almacén</Label>
              <Input
                id="w-name"
                value={newWarehouse.name}
                onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                placeholder="Ej: Bodega Principal, Local Centro..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-address">Dirección (opcional)</Label>
              <Input
                id="w-address"
                value={newWarehouse.address}
                onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                placeholder="Calle 123 #45-67"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="w-active">Activo</Label>
              <Switch
                id="w-active"
                checked={newWarehouse.active}
                onCheckedChange={(checked) => setNewWarehouse({ ...newWarehouse, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarehouseDialog(false)}>Cancelar</Button>
            <Button
              disabled={!newWarehouse.name || createWarehouseMutation.isPending}
              onClick={() => createWarehouseMutation.mutate(newWarehouse)}
            >
              {createWarehouseMutation.isPending ? 'Creando...' : 'Crear Almacén'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

