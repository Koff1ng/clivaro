'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    Receipt,
    X,
    RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

export type FooterTemplate = 'general' | 'restaurant' | 'retail' | 'services' | 'pharmacy' | 'custom'

export const FOOTER_TEMPLATES: Record<FooterTemplate, { label: string; description: string; text: string }> = {
    general: {
        label: 'General (Estándar)',
        description: 'Texto legal básico para cualquier tipo de negocio',
        text: 'Este documento se asimila en todos sus efectos a una letra de cambio de conformidad con el Art. 774 del código de comercio. Autorizo que en caso de incumplimiento de esta obligación sea reportado a las centrales de riesgo, se cobrarán intereses por mora.',
    },
    restaurant: {
        label: 'Restaurante / Bar',
        description: 'Incluye aviso de propina voluntaria y servicio',
        text: 'La propina sugerida del 10% es completamente voluntaria (Ley 1935/2018). No se incluye propina en el total. Este documento se asimila en todos sus efectos a una letra de cambio (Art. 774 C.C.). Productos preparados para consumo inmediato. Aplican condiciones de higiene y manipulación de alimentos.',
    },
    retail: {
        label: 'Retail / Ferretería',
        description: 'Incluye política de devoluciones y garantías',
        text: 'Cambios y devoluciones: 30 días con factura original y producto en su empaque. Garantía según fabricante. Este documento se asimila en todos sus efectos a una letra de cambio (Art. 774 C.C.). Los productos están sujetos a las condiciones de garantía del fabricante.',
    },
    services: {
        label: 'Servicios Profesionales',
        description: 'Para consultorías, asesorías y servicios técnicos',
        text: 'Servicio prestado conforme a las condiciones pactadas. Este documento se asimila en todos sus efectos a una letra de cambio (Art. 774 C.C.). El incumplimiento de pago generará intereses moratorios conforme a la ley.',
    },
    pharmacy: {
        label: 'Droguería / Farmacia',
        description: 'Incluye aviso de medicamentos y devoluciones limitadas',
        text: 'Medicamentos: no se aceptan devoluciones por bioseguridad (Decreto 677/1995). Productos de venta libre. Este documento se asimila en todos sus efectos a una letra de cambio (Art. 774 C.C.). Verifique el producto antes de retirarse del establecimiento.',
    },
    custom: {
        label: 'Personalizado',
        description: 'Escribe tu propio texto legal de pie de página',
        text: '',
    },
}

export interface BoldSections {
    companyName: boolean
    documentTitle: boolean
    customerName: boolean
    itemNames: boolean
    totals: boolean
    footer: boolean
    legalText: boolean
}

export interface TicketDesignSettings {
    templateStyle: 'classic' | 'modern' | 'minimal'
    headerAlignment: 'left' | 'center' | 'right'
    showDescription: boolean
    showUnitPrice: boolean
    showLogo: boolean
    groupData: boolean
    showUnitOfMeasure: boolean
    showTotals: boolean
    showLineCount: boolean
    showProductCount: boolean
    paperSize: 58 | 80
    marginLeft: number
    marginRight: number
    customFooterText: string
    customFooterImage?: string
    showQr: boolean
    showCufe: boolean
    footerText: string
    footerTemplate: FooterTemplate
    separator: 'dashes' | 'dots' | 'lines'
    // Font settings for thermal print legibility
    fontSize: 'small' | 'medium' | 'large'
    customFontSize?: number  // Custom numeric font size (overrides preset)
    fontWeight: 'normal' | 'bold'
    headerFontSize: 'medium' | 'large' | 'xlarge'
    lineSpacing: 'compact' | 'normal' | 'relaxed'
    // Per-section bold configuration
    boldSections?: BoldSections
}

interface TicketEditorProps {
    settings: TicketDesignSettings
    companyInfo: {
        name: string
        nit: string
        address: string
        city: string
        phone: string
        email: string
        regime: string
    }
    onChange: (settings: TicketDesignSettings) => void
    onClose?: () => void
}

const defaultBoldSections: BoldSections = {
    companyName: true,
    documentTitle: true,
    customerName: true,
    itemNames: false,
    totals: true,
    footer: true,
    legalText: false,
}

const defaultSettings: TicketDesignSettings = {
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
    // Font defaults for better thermal print legibility
    fontSize: 'medium',
    fontWeight: 'bold',
    headerFontSize: 'large',
    lineSpacing: 'normal',
    boldSections: defaultBoldSections,
}

// Sample invoice data for preview
const sampleInvoice = {
    number: '61282',
    prefix: 'FV',
    date: new Date().toLocaleString('es-CO'),
    paymentMethod: 'Crédito',
    seller: 'María López',
    dueDate: '30 días',
    customer: {
        name: 'Alexey Jansen',
        phone: '+57(936)133 6787',
        id: '17691244567938'
    },
    items: [
        { qty: 2, name: 'Awesome Metal Computer', sku: '147415', price: 1027, taxRate: 5 },
        { qty: 6, name: 'Small Plastic Table', sku: '100471', price: 6290, discount: 488, taxRate: 7 },
        { qty: 2, name: 'Fantastic Wooden Sausages', sku: '147415', price: 1919, taxRate: 12 },
    ],
    subtotal: 8814,
    discount: 488,
    taxes: [
        { name: 'IVA 5%', base: 917, amount: 46 },
        { name: 'IVA 7%', base: 2710, amount: 190 },
        { name: 'IVA 12%', base: 5616, amount: 674 },
    ],
    total: 9235
}

export function TicketEditor({ settings: initialSettings, companyInfo, onChange, onClose }: TicketEditorProps) {
    const [settings, setSettings] = useState<TicketDesignSettings>(() => ({
        ...defaultSettings,
        ...initialSettings,
        // Ensure footerTemplate always has a value (backwards compat for old saved settings)
        footerTemplate: initialSettings.footerTemplate || 'general',
    }))

    const updateSetting = <K extends keyof TicketDesignSettings>(key: K, value: TicketDesignSettings[K]) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value }
            onChange(newSettings)
            return newSettings
        })
    }

    // Batch update multiple settings at once (avoids race conditions)
    const updateSettings = (updates: Partial<TicketDesignSettings>) => {
        setSettings(prev => {
            const newSettings = { ...prev, ...updates }
            onChange(newSettings)
            return newSettings
        })
    }

    const resetToDefaults = () => {
        setSettings(defaultSettings)
        onChange(defaultSettings)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
    }

    const getSeparator = () => {
        switch (settings.separator) {
            case 'dashes': return '- '.repeat(24)
            case 'dots': return '. '.repeat(24)
            case 'lines': return '─'.repeat(48)
            default: return '-'.repeat(48)
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Left Panel - Configuration */}
            <div className="lg:w-1/2 space-y-6 overflow-y-auto pb-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Configurar plantilla de impresión
                    </h2>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-gray-500">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restablecer
                        </Button>
                        {onClose && (
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    Elige los parámetros que utilizarás y serán visibles en tus facturas.
                </p>

                {/* Template Type */}
                <div className="space-y-2">
                    <Label>Tipo de tirilla</Label>
                    <p className="text-xs text-muted-foreground">Selecciona la plantilla para la impresión de tus facturas.</p>
                    <Select value={settings.templateStyle} onValueChange={(val: any) => updateSetting('templateStyle', val)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="classic">Clásico</SelectItem>
                            <SelectItem value="modern">Moderno</SelectItem>
                            <SelectItem value="minimal">Minimalista</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Header Alignment */}
                <div className="space-y-2">
                    <Label>Alineación del encabezado</Label>
                    <p className="text-xs text-muted-foreground">Elige la forma en que se mostrarán los datos de tu negocio.</p>
                    <div className="flex gap-2">
                        {(['left', 'center', 'right'] as const).map((align) => (
                            <Button
                                key={align}
                                type="button"
                                variant={settings.headerAlignment === align ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateSetting('headerAlignment', align)}
                                className="flex-1"
                            >
                                {align === 'left' && <AlignLeft className="h-4 w-4" />}
                                {align === 'center' && <AlignCenter className="h-4 w-4" />}
                                {align === 'right' && <AlignRight className="h-4 w-4" />}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label>Incluir descripción de tus productos en tus facturas</Label>
                        <p className="text-xs text-muted-foreground">Esta opción mostrará la descripción de los productos en la impresión</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.showDescription}
                                onCheckedChange={(checked) => updateSetting('showDescription', checked)}
                            />
                            <span className="text-sm">Mostrar descripción</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Mostrar precio unitario de tus productos en tus facturas</Label>
                        <p className="text-xs text-muted-foreground">Esta opción mostrará el precio unitario de los productos en la impresión</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.showUnitPrice}
                                onCheckedChange={(checked) => updateSetting('showUnitPrice', checked)}
                            />
                            <span className="text-sm">Mostrar precios</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Agregar tu logo en la impresión de tus facturas</Label>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.showLogo}
                                onCheckedChange={(checked) => updateSetting('showLogo', checked)}
                            />
                            <span className="text-sm">Mostrar logo</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Agrupar en una columna los datos del producto</Label>
                        <p className="text-xs text-muted-foreground">Activa para mostrar el nombre, cantidad y precio en una sola columna.</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.groupData}
                                onCheckedChange={(checked) => updateSetting('groupData', checked)}
                            />
                            <span className="text-sm">Agrupar datos</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Incluir la unidad de medida en tus ventas</Label>
                        <p className="text-xs text-muted-foreground">Haz visible la unidad de medida de tus productos y servicios.</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.showUnitOfMeasure}
                                onCheckedChange={(checked) => updateSetting('showUnitOfMeasure', checked)}
                            />
                            <span className="text-sm">Hacer visible</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Mostrar total de líneas y productos en tus facturas</Label>
                        <p className="text-xs text-muted-foreground">Incluye el número de líneas de tu factura y el total de productos vendidos.</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                checked={settings.showLineCount && settings.showProductCount}
                                onCheckedChange={(checked) => {
                                    updateSetting('showLineCount', checked)
                                    updateSetting('showProductCount', checked)
                                }}
                            />
                            <span className="text-sm text-blue-600">{settings.showLineCount ? '✓ Dejar de mostrar información' : 'Mostrar información'}</span>
                        </div>
                    </div>
                </div>

                {/* Print Format */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Formato de impresión</Label>
                    <p className="text-xs text-muted-foreground">
                        Selecciona el tamaño y los márgenes de tu plantilla en milímetros (mm)
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Tamaño de tirilla</Label>
                            <Select value={String(settings.paperSize)} onValueChange={(val) => updateSetting('paperSize', Number(val) as 58 | 80)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="80">80mm</SelectItem>
                                    <SelectItem value="58">58mm</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Margen izquierdo</Label>
                            <Input
                                type="number"
                                value={settings.marginLeft}
                                onChange={(e) => updateSetting('marginLeft', Number(e.target.value))}
                                min={0}
                                max={20}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Margen derecho</Label>
                            <Input
                                type="number"
                                value={settings.marginRight}
                                onChange={(e) => updateSetting('marginRight', Number(e.target.value))}
                                min={0}
                                max={20}
                                className="h-9"
                            />
                        </div>
                    </div>
                </div>

                {/* Font Settings for Thermal Print Legibility */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Tipografía y legibilidad</Label>
                    <p className="text-xs text-muted-foreground">
                        Ajusta el tamaño y grosor de la letra para mejorar la legibilidad en impresoras térmicas
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Tamaño de letra (contenido)</Label>
                            <Select value={settings.fontSize} onValueChange={(val: any) => updateSetting('fontSize', val)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Pequeña</SelectItem>
                                    <SelectItem value="medium">Mediana</SelectItem>
                                    <SelectItem value="large">Grande</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Grosor de letra</Label>
                            <Select value={settings.fontWeight} onValueChange={(val: any) => updateSetting('fontWeight', val)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="bold">Negrita (recomendado)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Tamaño del encabezado</Label>
                            <Select value={settings.headerFontSize} onValueChange={(val: any) => updateSetting('headerFontSize', val)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="medium">Mediano</SelectItem>
                                    <SelectItem value="large">Grande</SelectItem>
                                    <SelectItem value="xlarge">Extra grande</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Espaciado entre líneas</Label>
                            <Select value={settings.lineSpacing} onValueChange={(val: any) => updateSetting('lineSpacing', val)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="compact">Compacto</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="relaxed">Espaciado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                        * Se recomienda usar letra Negrita y tamaño Mediano o Grande para impresoras térmicas.
                    </p>

                    {/* Custom Font Size */}
                    <div className="space-y-1 pt-2">
                        <Label className="text-xs">Tamaño personalizado (px)</Label>
                        <p className="text-xs text-muted-foreground">Ingresa un valor numérico para controlar el tamaño exacto de la letra. Deja en 0 para usar el preset de arriba.</p>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={(settings as any).customFontSize || 0}
                                onChange={(e) => {
                                    const val = Math.max(0, Math.min(24, Number(e.target.value)))
                                    updateSetting('customFontSize' as any, val || undefined)
                                }}
                                min={0}
                                max={24}
                                placeholder="0"
                                className="h-9 w-24"
                            />
                            <span className="text-xs text-muted-foreground">{(settings as any).customFontSize ? `${(settings as any).customFontSize}px activo` : 'Usando preset'}</span>
                        </div>
                    </div>
                </div>

                {/* Per-Section Bold Configuration */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Textos en negrita por sección</Label>
                    <p className="text-xs text-muted-foreground">
                        Elige qué secciones del ticket se imprimen en negrita. Permite resaltar elementos clave sin aplicar negrita a todo el documento.
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 mt-2">
                        {[
                            { key: 'companyName' as const, label: 'Nombre de empresa', desc: 'El nombre comercial en el encabezado' },
                            { key: 'documentTitle' as const, label: 'Título del documento', desc: 'FACTURA ELECTRÓNICA y número' },
                            { key: 'customerName' as const, label: 'Nombre del cliente', desc: 'Resalta el nombre del cliente' },
                            { key: 'itemNames' as const, label: 'Nombres de productos', desc: 'Los nombres en la lista de ítems' },
                            { key: 'totals' as const, label: 'Totales y subtotales', desc: 'Subtotal, impuestos y TOTAL' },
                            { key: 'footer' as const, label: 'Frase de agradecimiento', desc: '"Gracias por su compra" y similar' },
                            { key: 'legalText' as const, label: 'Texto legal', desc: 'Aviso de letra de cambio y condiciones' },
                        ].map(({ key, label, desc }) => {
                            const bs = settings.boldSections || defaultBoldSections
                            return (
                                <div key={key} className="flex items-center justify-between p-3 rounded-xl border bg-white hover:bg-slate-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{label}</div>
                                        <div className="text-[10px] text-muted-foreground">{desc}</div>
                                    </div>
                                    <Switch
                                        checked={bs[key]}
                                        onCheckedChange={(checked) => {
                                            const currentBs = settings.boldSections || { ...defaultBoldSections }
                                            updateSetting('boldSections' as any, { ...currentBs, [key]: checked })
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer Template */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Plantilla legal de pie de página</Label>
                    <p className="text-xs text-muted-foreground">
                        Selecciona el tipo de pie de página legal según tu tipo de negocio.
                    </p>
                    <div className="space-y-2">
                        {(Object.keys(FOOTER_TEMPLATES) as FooterTemplate[]).map((key) => {
                            const tmpl = FOOTER_TEMPLATES[key]
                            const isActive = (settings.footerTemplate || 'general') === key
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        if (key === 'custom') {
                                            updateSettings({ footerTemplate: key })
                                        } else {
                                            updateSettings({ footerTemplate: key, customFooterText: '' })
                                        }
                                    }}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg border-2 transition-all",
                                        isActive
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm">{tmpl.label}</div>
                                        {isActive && <div className="text-blue-600 text-xs font-bold">✓ Activo</div>}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1">{tmpl.description}</div>
                                    {isActive && key !== 'custom' && (
                                        <div className="text-[9px] text-gray-500 mt-2 italic leading-tight border-t pt-2">
                                            {tmpl.text}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {settings.footerTemplate === 'custom' && (
                        <div className="space-y-2 mt-3">
                            <Label className="text-xs">Tu texto legal personalizado:</Label>
                            <Textarea
                                value={settings.customFooterText}
                                onChange={(e) => updateSetting('customFooterText', e.target.value.slice(0, 500))}
                                placeholder="Escribe aquí tu texto legal o aviso personalizado (máx. 500 caracteres)"
                                className="resize-none h-24"
                                maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {settings.customFooterText.length} de 500 caracteres
                            </p>
                        </div>
                    )}
                </div>

                {/* Customization */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Personalización adicional</Label>

                    <div className="space-y-2">
                        <Label className="text-xs">Frase de agradecimiento:</Label>
                        <Input
                            value={settings.footerText}
                            onChange={(e) => updateSetting('footerText', e.target.value.slice(0, 100))}
                            placeholder="Ej: ¡Gracias por su compra!"
                            maxLength={100}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.showQr}
                            onCheckedChange={(checked) => updateSetting('showQr', checked)}
                        />
                        <span className="text-sm">Mostrar código QR</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.showCufe}
                            onCheckedChange={(checked) => updateSetting('showCufe', checked)}
                        />
                        <span className="text-sm">Mostrar CUFE (factura electrónica)</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Live Preview */}
            <div className="lg:w-1/2 flex flex-col">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-medium text-blue-600">Vista previa de la tirilla</h3>
                </div>

                <div className="flex-1 flex justify-center overflow-y-auto bg-gray-100 rounded-lg p-4">
                    <div
                        className={cn(
                            "bg-white shadow-lg",
                            settings.templateStyle === 'modern' ? "font-sans" : "font-mono",
                            settings.templateStyle === 'modern' && "rounded-lg",
                            settings.paperSize === 80 ? "w-[300px]" : "w-[220px]",
                            settings.fontSize === 'small' && "text-[10px]",
                            settings.fontSize === 'medium' && "text-xs",
                            settings.fontSize === 'large' && "text-sm",
                            settings.fontWeight === 'bold' && "font-semibold",
                            settings.lineSpacing === 'compact' && "leading-tight",
                            settings.lineSpacing === 'normal' && "leading-normal",
                            settings.lineSpacing === 'relaxed' && "leading-relaxed"
                        )}
                        style={{
                            paddingLeft: `${settings.marginLeft * 2}px`,
                            paddingRight: `${settings.marginRight * 2}px`,
                            paddingTop: '16px',
                            paddingBottom: '16px'
                        }}
                    >
                        {/* ═══ HEADER ═══ */}
                        <div className={cn(
                            "pb-2",
                            settings.templateStyle === 'modern' ? 'space-y-2 px-3' : 'space-y-1',
                            settings.headerAlignment === 'left' && 'text-left',
                            settings.headerAlignment === 'center' && 'text-center',
                            settings.headerAlignment === 'right' && 'text-right'
                        )}>
                            {settings.showLogo && (
                                <div className="mb-2 flex justify-center">
                                    <Logo size="sm" showByline={false} className="h-12 w-auto" />
                                </div>
                            )}
                            <div className={cn(
                                "uppercase",
                                (settings.boldSections?.companyName ?? true) && "font-bold",
                                settings.headerFontSize === 'medium' && "text-sm",
                                settings.headerFontSize === 'large' && "text-base",
                                settings.headerFontSize === 'xlarge' && "text-lg"
                            )}>{companyInfo.name || 'NOMBRE DE LA EMPRESA'}</div>
                            <div>NIT {companyInfo.nit || '900.000.000-1'}</div>
                            {settings.templateStyle !== 'minimal' && (
                                <>
                                    <div>{companyInfo.address || 'Calle 123 #45-67'}, {companyInfo.city || 'Bogotá'}</div>
                                    <div>Tel: {companyInfo.phone || '+57 300 123 4567'}</div>
                                    {companyInfo.email && <div>{companyInfo.email}</div>}
                                </>
                            )}
                            <div className="text-[9px]">{companyInfo.regime || 'Responsable de IVA'}</div>
                        </div>

                        {/* ═══ TITLE ═══ */}
                        {settings.templateStyle === 'modern' ? (
                            <div className={cn("text-center py-2 border-y-2 border-black my-2 bg-black text-white", (settings.boldSections?.documentTitle ?? true) && 'font-bold')}>
                                FACTURA ELECTRÓNICA<br />
                                N° {sampleInvoice.number}
                            </div>
                        ) : settings.templateStyle === 'minimal' ? (
                            <div className={cn("text-center py-2 border-y border-gray-300 my-2 text-[11px]", (settings.boldSections?.documentTitle ?? true) && 'font-bold')}>
                                FE N° {sampleInvoice.number}
                            </div>
                        ) : (
                            <div className={cn("text-center py-2 border-y border-dashed my-2", (settings.boldSections?.documentTitle ?? true) && 'font-bold')}>
                                Factura electrónica de venta<br />
                                N° {sampleInvoice.number}
                            </div>
                        )}

                        {/* ═══ INVOICE INFO ═══ */}
                        <div className={cn(
                            "py-2 text-[10px]",
                            settings.templateStyle === 'modern' ? 'space-y-1 px-2 bg-gray-50 rounded-md my-1' : 'space-y-1'
                        )}>
                            <div>Fecha: {sampleInvoice.date}</div>
                            <div>Pago: {sampleInvoice.paymentMethod}</div>
                            {settings.templateStyle !== 'minimal' && <div>Vendedor: {sampleInvoice.seller}</div>}
                            <div>Venc.: {sampleInvoice.dueDate}</div>
                        </div>

                        {/* ═══ CUSTOMER ═══ */}
                        <div className={cn(
                            "py-2",
                            settings.templateStyle === 'classic' && 'border-t border-dashed',
                            settings.templateStyle === 'modern' && 'border-t-2 border-gray-200 px-2',
                            settings.templateStyle === 'minimal' && 'border-t border-gray-200'
                        )}>
                            <div className={cn((settings.boldSections?.customerName ?? true) && 'font-bold')}>{sampleInvoice.customer.name}</div>
                            <div className="text-[10px]">Tel: {sampleInvoice.customer.phone}</div>
                            {settings.templateStyle !== 'minimal' && <div className="text-[10px]">{sampleInvoice.customer.id}</div>}
                        </div>

                        <div className="text-[10px] py-1">{getSeparator()}</div>

                        {/* ═══ ITEMS ═══ */}
                        <div className="space-y-2 py-2">
                            {sampleInvoice.items.map((item, idx) => (
                                <div key={idx} className={cn(
                                    "text-[10px]",
                                    settings.templateStyle === 'modern' && 'px-1 py-1 rounded hover:bg-gray-50'
                                )}>
                                    {settings.groupData ? (
                                        <div>
                                            <div className={cn(settings.boldSections?.itemNames && 'font-bold')}>{idx + 1}. {item.name}</div>
                                            <div className="pl-3">
                                                {item.qty} x {settings.showUnitPrice && formatCurrency(item.price)} = {formatCurrency(item.qty * item.price)}
                                                {item.discount && <span className="text-red-500"> (-{formatCurrency(item.discount)})</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between">
                                            <div className="flex-1">
                                                <span>{settings.templateStyle !== 'minimal' ? `${idx + 1}. ` : ''}</span>
                                                <span className={cn(settings.boldSections?.itemNames && 'font-bold')}>{item.name}</span>
                                                {settings.showUnitOfMeasure && <span className="text-gray-500"> (UN)</span>}
                                                {settings.showDescription && <div className="pl-3 text-gray-500 text-[9px]">Producto de alta calidad</div>}
                                                {settings.templateStyle === 'classic' && <div className="pl-3 text-gray-600">{item.sku}</div>}
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <div>{item.qty} {settings.showUnitPrice && <span>x {formatCurrency(item.price)}</span>}</div>
                                                {item.discount && <div className="text-red-500">{settings.templateStyle === 'minimal' ? `-${formatCurrency(item.discount)}` : `Desc: -${formatCurrency(item.discount)}`}</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="text-[10px] py-1">{getSeparator()}</div>

                        {/* ═══ TOTALS ═══ */}
                        {settings.showTotals && (
                            <div className={cn(
                                "space-y-1 py-2 text-[11px]",
                                settings.templateStyle === 'modern' && 'bg-gray-50 px-2 rounded-md'
                            )}>
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(sampleInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-red-500">
                                    <span>Descuento:</span>
                                    <span>-{formatCurrency(sampleInvoice.discount)}</span>
                                </div>
                                {settings.templateStyle !== 'minimal' && (
                                    <div className="flex justify-between">
                                        <span>Base:</span>
                                        <span>{formatCurrency(sampleInvoice.subtotal - sampleInvoice.discount)}</span>
                                    </div>
                                )}
                                {sampleInvoice.taxes.map((tax, idx) => (
                                    <div key={idx} className="flex justify-between text-gray-600">
                                        <span>{tax.name}:</span>
                                        <span>{formatCurrency(tax.amount)}</span>
                                    </div>
                                ))}
                                <div className={cn(
                                    "flex justify-between pt-1",
                                    (settings.boldSections?.totals ?? true) && 'font-bold',
                                    settings.templateStyle === 'modern' ? 'text-base border-t-2 border-black' : 'text-sm border-t'
                                )}>
                                    <span>TOTAL:</span>
                                    <span>{formatCurrency(sampleInvoice.total)}</span>
                                </div>
                            </div>
                        )}

                        {/* ═══ TAX SUMMARY ═══ */}
                        {settings.templateStyle !== 'minimal' && (
                            <div className="text-[10px] py-2 border-t">
                                <div className="font-bold text-center mb-1">Resumen de impuestos</div>
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <td>Tarifa</td>
                                            <td className="text-right">Base</td>
                                            <td className="text-right">Impuesto</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sampleInvoice.taxes.map((tax, idx) => (
                                            <tr key={idx}>
                                                <td>{String.fromCharCode(65 + idx)} - {tax.name}</td>
                                                <td className="text-right">{formatCurrency(tax.base)}</td>
                                                <td className="text-right">{formatCurrency(tax.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ═══ COUNTS ═══ */}
                        {(settings.showLineCount || settings.showProductCount) && (
                            <div className="text-[10px] py-2 border-t space-y-1">
                                <div>Total recibido: {formatCurrency(sampleInvoice.total)}</div>
                                {settings.showLineCount && <div>Total de líneas: {sampleInvoice.items.length}</div>}
                                {settings.showProductCount && <div>Total de productos: {sampleInvoice.items.reduce((acc, i) => acc + i.qty, 0)}</div>}
                            </div>
                        )}

                        {/* ═══ QR ═══ */}
                        {settings.showQr && (
                            <div className="flex justify-center py-4">
                                <div className={cn(
                                    "w-24 h-24 flex items-center justify-center text-[8px] text-gray-500",
                                    settings.templateStyle === 'modern' ? 'bg-gray-100 rounded-lg' : 'bg-gray-200'
                                )}>
                                    [Código QR]
                                </div>
                            </div>
                        )}

                        {/* ═══ CUFE ═══ */}
                        {settings.showCufe && (
                            <div className={cn(
                                "text-[8px] py-2 break-all",
                                settings.templateStyle === 'modern' ? 'bg-blue-50 px-2 py-2 rounded-md' : 'border-t'
                            )}>
                                <div className="font-bold">CUFE:</div>
                                <div className="text-gray-500">e8c0dba445b1b7be98cde0cee7473a...</div>
                                <div className="font-bold text-green-700 mt-1">✓ VALIDADA POR LA DIAN</div>
                            </div>
                        )}

                        {/* ═══ FOOTER ═══ */}
                        <div className={cn(
                            "text-[9px] text-center py-2 space-y-2",
                            settings.templateStyle === 'modern' ? 'border-t-2 border-black mt-2' : 'border-t'
                        )}>
                            {settings.footerText && (
                                <div className={cn(
                                    "pt-1",
                                    (settings.boldSections?.footer ?? true) && 'font-bold',
                                    settings.templateStyle === 'modern' ? 'text-sm' : ''
                                )}>
                                    {settings.footerText}
                                </div>
                            )}
                            <p className={cn("text-[8px] text-gray-600 leading-tight", settings.boldSections?.legalText && 'font-bold')}>
                                {settings.footerTemplate === 'custom'
                                    ? (settings.customFooterText || 'Tu texto legal personalizado aparecerá aquí')
                                    : FOOTER_TEMPLATES[settings.footerTemplate || 'general'].text}
                            </p>
                            <div className={cn(
                                "font-medium pt-1",
                                settings.templateStyle === 'minimal' ? 'text-[8px]' : ''
                            )}>
                                Representación impresa de la factura electrónica
                            </div>
                            <div className="text-gray-500">
                                {companyInfo.name} - NIT {companyInfo.nit}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
