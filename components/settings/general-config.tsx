'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { 
  Settings as SettingsIcon, 
  Loader2, 
  Plus, 
  Trash2, 
  Printer, 
  MapPin, 
  Hash, 
  Building2, 
  Receipt, 
  FileText, 
  ShoppingCart, 
  Network, 
  Edit, 
  Warehouse, 
  Settings,
  Globe,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { TicketEditor, type TicketDesignSettings } from '@/components/settings/ticket-editor'
import { PdfEditor } from '@/components/settings/pdf-editor'
import { MetaConfig } from './meta-config'
import { ZoneManager } from '../warehouses/zone-manager'
import { cn } from '@/lib/utils'
import { UtensilsCrossed } from 'lucide-react'

// Interfaces for custom settings structure
interface PrinterDefinition {
  id: string
  name: string
  type: 'thermal' | 'laser'
  interfaceType: 'usb' | 'lan' | 'bluetooth'
  interfaceConfig: string
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
  companyName: string
  companyNit: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyRegime: string
  companyCity: string
  companyWebsite: string
  enableRestaurantMode: boolean
  customSettings: string
}

interface GeneralConfigProps {
  settings: any
  onSave: (data: any) => void
  isLoading: boolean
  initialTab?: string
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

export function GeneralConfig({ settings, onSave, isLoading, initialTab = 'identity' }: GeneralConfigProps) {
  const { toast } = useToast()
  
  // Custom states
  const [activeTab, setActiveTab] = useState(initialTab)
  
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Parse initial custom settings
  const initialCustomSettings: CustomSettings = settings?.customSettings
    ? JSON.parse(settings.customSettings)
    : { printing: { printers: [], ticketDesign: { showLogo: true, showQr: true, showCufe: true, footerText: 'Gracias por su compra', separator: 'dashes' }, posBehavior: { autoPrint: false, previewBeforePrint: true, copies: 1, retryOnFail: false }, enabled: true, paperWidth: 80, type: 'escpos', autoCut: true } }

  const [printers, setPrinters] = useState<PrinterDefinition[]>(initialCustomSettings.printing?.printers || [])
  const [scannedDevices, setScannedDevices] = useState<{ ip: string, name: string, port: number }[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [showTicketEditor, setShowTicketEditor] = useState(false)
  const [showPdfEditor, setShowPdfEditor] = useState(false)
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false)
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null)
  const [newWarehouse, setNewWarehouse] = useState({ name: '', location: '', active: true })
  
  const queryClient = useQueryClient()

  // Fetch warehouses
  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Failed to fetch warehouses')
      const data = await res.json()
      return Array.isArray(data) ? data : (data.warehouses || [])
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
      setNewWarehouse({ name: '', location: '', active: true })
      toast('Almacén creado exitosamente', 'success')
    },
    onError: (err: any) => {
      toast(err.message, 'error')
    }
  })

  // Form setup
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

  // Methods
  const updateCustomSettings = (updater: (prev: CustomSettings) => CustomSettings) => {
    const current = watch('customSettings') ? JSON.parse(watch('customSettings')) : initialCustomSettings
    const updated = updater(current || initialCustomSettings)
    setValue('customSettings', JSON.stringify(updated))
  }

  const handlePrintingChange = (field: keyof NonNullable<CustomSettings['printing']>, value: any) => {
    updateCustomSettings(prev => ({
      ...prev,
      printing: { ...(prev.printing as any), [field]: value }
    }))
  }

  const addPrinter = () => {
    const newPrinter: PrinterDefinition = {
      id: crypto.randomUUID(),
      name: 'Nueva Impresora',
      type: 'thermal',
      interfaceType: 'lan',
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
      if (field === 'default' && value === true) return { ...p, [field]: value }
      return { ...p, [field]: value }
    })
    if (field === 'default' && value === true) {
      updatedPrinters.forEach(p => { if (p.id !== id) p.default = false })
    }
    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
  }

  const removePrinter = (id: string) => {
    const updatedPrinters = printers.filter(p => p.id !== id)
    setPrinters(updatedPrinters)
    handlePrintingChange('printers', updatedPrinters)
  }

  const scanNetwork = async () => {
    try {
      setIsScanning(true)
      const res = await fetch('/api/settings/scan-printers')
      const data = await res.json()
      if (data.devices) {
        setScannedDevices(data.devices)
        setShowScanDialog(true)
      }
    } catch (e: any) {
      toast('Error al escanear impresoras', 'error')
    } finally {
      setIsScanning(false)
    }
  }

  const onSubmit = (data: GeneralFormData) => {
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
        printers: printers,
      }
    }
    const { companyRegime, companyCity, companyWebsite, ...schemaData } = data;
    const payload = {
      ...schemaData,
      customSettings: JSON.stringify(finalCustom)
    }
    onSave(payload)
  }

  const renderSectionHeader = (title: string, Icon: any, description: string) => (
    <div className="mb-8 p-8 rounded-[2rem] bg-slate-900 text-white shadow-2xl shadow-slate-200 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-6">
        <div className="p-4 bg-white/10 rounded-2xl shadow-inner">
          <Icon size={32} strokeWidth={2.5} />
        </div>
        <div>
           <h2 className="text-2xl font-black tracking-tighter">{title}</h2>
           <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{description}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12 pb-24">
        
        {/* Identidad */}
        {activeTab === 'identity' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {renderSectionHeader('Identidad de Marca', Building2, 'DATOS CORPORATIVOS Y FISCALES')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nombre Comercial</Label>
                <Input {...register('companyName')} className="rounded-2xl h-14 border-slate-200 bg-white focus:ring-slate-900 px-6 font-semibold" placeholder="Nombre de tu negocio" />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">NIT / ID Tributario</Label>
                <Input {...register('companyNit')} className="rounded-2xl h-14 border-slate-200 bg-white font-mono" placeholder="900.000.000-0" />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Régimen</Label>
                <Select value={watch('companyRegime')} onValueChange={(val) => setValue('companyRegime', val)}>
                  <SelectTrigger className="rounded-2xl h-14 border-slate-200 bg-white px-6 font-semibold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">{regimes.map(r => <SelectItem key={r} value={r} className="rounded-xl">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5"><Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Ciudad</Label><Input {...register('companyCity')} className="rounded-2xl h-14 border-slate-200" /></div>
              <div className="space-y-2.5 md:col-span-2"><Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Dirección Física</Label><Input {...register('companyAddress')} className="rounded-2xl h-14 border-slate-200" /></div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Teléfono</Label><Input {...register('companyPhone')} className="rounded-2xl h-14 border-slate-200" /></div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Email de Contacto</Label><Input {...register('companyEmail')} className="rounded-2xl h-14 border-slate-200" /></div>
            </div>
          </div>
        )}

        {/* Regional */}
        {activeTab === 'localization' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {renderSectionHeader('Regional y Moneda', Globe, 'CONFIGURACIÓN DE ENTORNO')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 border rounded-[2rem] bg-white shadow-sm space-y-4">
                 <h3 className="font-bold flex items-center gap-2"><MapPin size={18} className="text-primary" /> Ubicación Tiempo</h3>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Zona Horaria</Label>
                    <Select value={watch('timezone')} onValueChange={(val) => setValue('timezone', val)}>
                      <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-transparent shadow-inner"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">{timezones.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>
              <div className="p-8 border rounded-[2rem] bg-white shadow-sm space-y-4">
                 <h3 className="font-bold flex items-center gap-2"><Globe size={18} className="text-primary" /> Divisa Principal</h3>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Moneda del Sistema</Label>
                    <Select value={watch('currency')} onValueChange={(val) => setValue('currency', val)}>
                      <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-transparent shadow-inner"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">{currencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Numeración */}
        {activeTab === 'numbering' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {renderSectionHeader('Folios y Prefijos', Hash, 'SECUENCIAS DE DOCUMENTACIÓN')}
            <div className="grid grid-cols-1 gap-6">
              {[
                { label: 'Facturas de Venta', icon: Receipt, prefix: 'invoicePrefix', format: 'invoiceNumberFormat', clr: 'bg-emerald-50 text-emerald-600' },
                { label: 'Cotizaciones', icon: FileText, prefix: 'quotationPrefix', format: 'quotationNumberFormat', clr: 'bg-indigo-50 text-indigo-600' },
                { label: 'Orden de Compra', icon: ShoppingCart, prefix: 'purchaseOrderPrefix', format: 'purchaseOrderNumberFormat', clr: 'bg-amber-50 text-amber-600' }
              ].map((item) => (
                <div key={item.prefix} className="p-8 border rounded-[2.5rem] bg-white shadow-sm group hover:shadow-xl hover:shadow-slate-100 transition-all duration-300">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn("p-3 rounded-2xl", item.clr)}>
                      <item.icon size={22} />
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight">{item.label}</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Prefijo Alpha</Label>
                      <Input {...register(item.prefix as any)} className="rounded-xl h-12 bg-slate-50 border-transparent focus:bg-white transition-all font-bold text-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Siguiente Número</Label>
                      <Input {...register(item.format as any)} className="rounded-xl h-12 bg-slate-50 border-transparent focus:bg-white transition-all font-mono text-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impresión */}
        {activeTab === 'printing' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {renderSectionHeader('Impresión POS', Printer, 'CONTROL DE ESTACIONES Y TICKETS')}
            <div className="p-8 border rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-2xl shadow-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/10 rounded-2.5xl backdrop-blur-md">
                   <Printer size={32} />
                </div>
                <div>
                   <h3 className="text-xl font-black">Activar Impresión Térmica</h3>
                   <p className="text-indigo-100 text-sm opacity-80">Habilita el envío directo a comandos y tirillas.</p>
                </div>
              </div>
              <Switch 
                className="scale-125 data-[state=checked]:bg-white data-[state=checked]:text-indigo-600 border-indigo-400"
                checked={initialCustomSettings.printing?.enabled}
                onCheckedChange={(c) => handlePrintingChange('enabled', c)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Estaciones Configuradas</h4>
                <div className="flex gap-2">
                   <Button type="button" variant="outline" size="sm" className="rounded-full border-slate-200" onClick={scanNetwork}>Escanear Red</Button>
                   <Button type="button" size="sm" className="rounded-full bg-slate-900 h-9 font-bold px-6" onClick={addPrinter}>+ Agregar</Button>
                </div>
              </div>

              {printers.map((p) => (
                <div key={p.id} className="p-6 border rounded-3xl bg-white shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-5">
                     <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                        <Printer size={24} />
                     </div>
                     <div>
                        <div className="font-black text-slate-800">{p.name}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{p.interfaceConfig || 'Sin IP configurada'}</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:bg-slate-50"><Edit size={16} /></Button>
                     <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:bg-red-50" onClick={() => removePrinter(p.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
              ))}
              {printers.length === 0 && (
                <div className="h-40 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 gap-2">
                   <Printer size={32} opacity={0.2} />
                   <span className="text-xs font-bold uppercase tracking-widest">No hay impresoras añadidas</span>
                </div>
              )}
            </div>

            {/* Document Design Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tirilla Design Card */}
              <div className="p-6 border rounded-[2rem] bg-white shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <Receipt size={32} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">Tirilla / Recibo</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Impresión térmica POS</p>
                    <p className="text-xs text-slate-500 mt-2">Configura plantilla (Clásica, Moderna, Minimalista), logo, CUFE, QR, footer legal, tipografía y márgenes.</p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-full bg-amber-600 hover:bg-amber-700 font-bold px-8 w-full"
                    onClick={() => setShowTicketEditor(true)}
                  >
                    <Edit size={16} className="mr-2" /> Diseñar Tirilla
                  </Button>
                </div>
              </div>

              {/* PDF / Letter Design Card */}
              <div className="p-6 border rounded-[2rem] bg-white shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">PDF / Carta</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Formato de impresión en carta</p>
                    <p className="text-xs text-slate-500 mt-2">El formato PDF utiliza logo, pie de página legal, CUFE y frase de agradecimiento configurados en el editor de tirilla.</p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-full bg-indigo-600 hover:bg-indigo-700 font-bold px-8 w-full"
                    onClick={() => setShowPdfEditor(true)}
                  >
                    <Edit size={16} className="mr-2" /> Configurar PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Editor Dialog */}
        {showTicketEditor && (
          <Dialog open={showTicketEditor} onOpenChange={setShowTicketEditor}>
            <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
              <DialogHeader className="p-6 bg-slate-900 text-white">
                <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <Receipt size={24} /> Editor de Tirilla / Factura
                </DialogTitle>
                <DialogDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                  Personaliza la apariencia de tus facturas impresas
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <TicketEditor
                  settings={initialCustomSettings.printing?.ticketDesign || {
                    templateStyle: 'classic',
                    headerAlignment: 'center',
                    showDescription: false,
                    showUnitPrice: true,
                    showLogo: true,
                    groupData: false,
                    showUnitOfMeasure: false,
                    showTotals: true,
                    showLineCount: true,
                    showProductCount: true,
                    paperSize: 80,
                    marginLeft: 0,
                    marginRight: 0,
                    customFooterText: '',
                    showQr: true,
                    showCufe: true,
                    footerText: 'Gracias por su compra',
                    footerTemplate: 'general',
                    separator: 'dashes',
                    fontSize: 'medium',
                    fontWeight: 'bold',
                    headerFontSize: 'large',
                    lineSpacing: 'normal',
                  }}
                  companyInfo={{
                    name: watch('companyName') || '',
                    nit: watch('companyNit') || '',
                    address: watch('companyAddress') || '',
                    city: watch('companyCity') || '',
                    phone: watch('companyPhone') || '',
                    email: watch('companyEmail') || '',
                    regime: watch('companyRegime') || 'Responsable de IVA',
                  }}
                  onChange={(newDesign) => {
                    handlePrintingChange('ticketDesign', newDesign)
                  }}
                  onClose={() => setShowTicketEditor(false)}
                />
              </div>
              {/* Save Button Footer */}
              <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between rounded-b-[2rem] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <p className="text-xs text-muted-foreground">
                  Los cambios se aplican a la tirilla y al formato PDF.
                </p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={() => setShowTicketEditor(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-green-600 hover:bg-green-700 font-bold px-8"
                    disabled={isLoading}
                    onClick={() => {
                      handleSubmit(onSubmit)()
                      toast('Diseño de factura guardado correctamente', 'success')
                      setShowTicketEditor(false)
                    }}
                  >
                    {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save size={16} className="mr-2" />}
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* PDF Editor Dialog */}
        {showPdfEditor && (
          <Dialog open={showPdfEditor} onOpenChange={setShowPdfEditor}>
            <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
              <DialogHeader className="p-6 bg-indigo-900 text-white">
                <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <FileText size={24} /> Editor de PDF / Carta
                </DialogTitle>
                <DialogDescription className="text-indigo-300 uppercase text-[10px] font-bold tracking-widest">
                  Personaliza la apariencia de tus facturas en formato carta
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <PdfEditor
                  settings={initialCustomSettings.printing?.ticketDesign || {
                    templateStyle: 'classic',
                    headerAlignment: 'center',
                    showDescription: false,
                    showUnitPrice: true,
                    showLogo: true,
                    groupData: false,
                    showUnitOfMeasure: false,
                    showTotals: true,
                    showLineCount: true,
                    showProductCount: true,
                    paperSize: 80,
                    marginLeft: 0,
                    marginRight: 0,
                    customFooterText: '',
                    showQr: true,
                    showCufe: true,
                    footerText: 'Gracias por su compra',
                    footerTemplate: 'general',
                    separator: 'dashes',
                    fontSize: 'medium',
                    fontWeight: 'bold',
                    headerFontSize: 'large',
                    lineSpacing: 'normal',
                  }}
                  companyInfo={{
                    name: watch('companyName') || '',
                    nit: watch('companyNit') || '',
                    address: watch('companyAddress') || '',
                    city: watch('companyCity') || '',
                    phone: watch('companyPhone') || '',
                    email: watch('companyEmail') || '',
                    regime: watch('companyRegime') || 'Responsable de IVA',
                  }}
                  onChange={(newDesign) => {
                    handlePrintingChange('ticketDesign', newDesign)
                  }}
                  onClose={() => setShowPdfEditor(false)}
                />
              </div>
              {/* Save Button Footer */}
              <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between rounded-b-[2rem] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <p className="text-xs text-muted-foreground">
                  Los cambios también se aplican al formato tirilla.
                </p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={() => setShowPdfEditor(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-green-600 hover:bg-green-700 font-bold px-8"
                    disabled={isLoading}
                    onClick={() => {
                      handleSubmit(onSubmit)()
                      toast('Diseño de PDF guardado correctamente', 'success')
                      setShowPdfEditor(false)
                    }}
                  >
                    {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save size={16} className="mr-2" />}
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {activeTab === 'warehouses' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {renderSectionHeader('Gestión de Almacenes', Warehouse, 'PUNTOS FÍSICOS DE STOCK')}
            <div className="flex justify-end gap-2 pr-2">
               <Button type="button" className="rounded-full bg-slate-900 font-bold" onClick={() => setShowWarehouseDialog(true)}>
                  <Plus size={16} className="mr-2" /> Nuevo Almacén
               </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {warehouses.map((w: any) => (
                <div key={w.id} className="p-8 border rounded-[2.5rem] bg-white shadow-sm hover:shadow-xl transition-all duration-500">
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
                           <Warehouse size={22} />
                        </div>
                        <div>
                           <h3 className="font-black text-slate-800 text-lg tracking-tight">{w.name}</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{w.location || w.address || 'Sin dirección'}</p>
                        </div>
                     </div>
                     <Badge className={cn("rounded-full px-3", w.active ? "bg-emerald-500" : "bg-slate-400")}>{w.active ? 'Activo' : 'Off'}</Badge>
                  </div>
                  
                  <div className="pt-4 border-t flex justify-between items-center">
                     <Button variant="ghost" size="sm" className="rounded-full text-xs font-black uppercase text-slate-400" onClick={() => setExpandedWarehouseId(expandedWarehouseId === w.id ? null : w.id)}>
                        {expandedWarehouseId === w.id ? 'Cerrar Zonas' : 'Administrar Zonas'}
                     </Button>
                     <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><Edit size={16} /></Button>
                  </div>

                  {expandedWarehouseId === w.id && (
                    <div className="mt-6 pt-6 border-t-2 border-dashed space-y-4 animate-in slide-in-from-top-4 duration-300">
                       <ZoneManager warehouseId={w.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Floating Save Button */}
        <div className="fixed bottom-12 right-12 z-[100] animate-in slide-in-from-bottom-10 duration-700">
          <Button type="submit" disabled={isLoading} className="h-16 px-10 rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] bg-slate-900 border-2 border-slate-800 hover:bg-black transition-all group overflow-hidden">
            <div className="flex items-center gap-3 relative z-10 font-black text-sm uppercase tracking-[0.1em]">
               {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
               <span>Guardar Cambios</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        </div>
      </form>
      
      {/* Dialogs and Modals preserved from original */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
         <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
            <div className="p-8 bg-slate-900 text-white">
               <DialogTitle className="text-2xl font-black flex items-center gap-3"><Printer /> Dispositivos LAN</DialogTitle>
               <DialogDescription className="text-slate-400 mt-1 uppercase text-[10px] font-bold tracking-widest">Escaneo de red completado</DialogDescription>
            </div>
            <div className="p-8 space-y-3">
               {scannedDevices.map(d => (
                  <button key={d.ip} className="w-full flex items-center justify-between p-5 border rounded-2xl hover:bg-slate-50 transition-all text-left group">
                     <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors"><Printer size={20} /></div>
                        <div><div className="font-bold text-slate-800">{d.name}</div><div className="text-[10px] font-bold text-slate-400">{d.ip}</div></div>
                     </div>
                     <Plus className="text-slate-300 group-hover:text-primary" />
                  </button>
               ))}
            </div>
         </DialogContent>
      </Dialog>

      {/* Warehouse Creation Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
         <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
            <div className="p-8 bg-slate-900 text-white">
               <DialogTitle className="text-2xl font-black flex items-center gap-3"><Warehouse size={28} /> Nuevo Almacén</DialogTitle>
               <DialogDescription className="text-slate-400 mt-1 uppercase text-[10px] font-bold tracking-widest">Registrar punto físico de stock</DialogDescription>
            </div>
            <div className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre del Almacén</Label>
                  <Input 
                     placeholder="Ej: Bodega Principal" 
                     value={newWarehouse.name} 
                     onChange={(e) => setNewWarehouse(prev => ({ ...prev, name: e.target.value }))} 
                     className="rounded-xl h-12 bg-slate-50 border-transparent focus:bg-white transition-all font-semibold"
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ubicación / Dirección</Label>
                  <Input 
                     placeholder="Ej: Calle 50 #30-20, Medellín" 
                     value={newWarehouse.location} 
                     onChange={(e) => setNewWarehouse(prev => ({ ...prev, location: e.target.value }))} 
                     className="rounded-xl h-12 bg-slate-50 border-transparent focus:bg-white transition-all"
                  />
               </div>
               <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowWarehouseDialog(false)}>Cancelar</Button>
                  <Button 
                     type="button" 
                     className="rounded-full bg-slate-900 font-bold px-8"
                     disabled={!newWarehouse.name || createWarehouseMutation.isPending}
                     onClick={() => createWarehouseMutation.mutate({ name: newWarehouse.name, location: newWarehouse.location })}
                  >
                     {createWarehouseMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
                     Crear Almacén
                  </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={cn("text-[9px] font-black uppercase tracking-widest py-1 px-2.5 rounded-full text-white", className)}>{children}</span>
}
