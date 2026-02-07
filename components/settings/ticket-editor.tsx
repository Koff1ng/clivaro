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
    separator: 'dashes' | 'dots' | 'lines'
    // Font settings for thermal print legibility
    fontSize: 'small' | 'medium' | 'large'
    fontWeight: 'normal' | 'bold'
    headerFontSize: 'medium' | 'large' | 'xlarge'
    lineSpacing: 'compact' | 'normal' | 'relaxed'
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
    separator: 'dashes',
    // Font defaults for better thermal print legibility
    fontSize: 'medium',
    fontWeight: 'bold',
    headerFontSize: 'large',
    lineSpacing: 'normal'
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
    const [settings, setSettings] = useState<TicketDesignSettings>({ ...defaultSettings, ...initialSettings })

    const updateSetting = <K extends keyof TicketDesignSettings>(key: K, value: TicketDesignSettings[K]) => {
        const newSettings = { ...settings, [key]: value }
        setSettings(newSettings)
        onChange(newSettings)
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
                </div>

                {/* Customization */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Personalización de facturas</Label>
                    <p className="text-xs text-muted-foreground">
                        Dale tu toque a la parte final de tus facturas con una frase, imagen o ambas.
                    </p>

                    <div className="space-y-2">
                        <Label className="text-xs">Frase Personalizada:</Label>
                        <Textarea
                            value={settings.customFooterText}
                            onChange={(e) => updateSetting('customFooterText', e.target.value.slice(0, 200))}
                            placeholder="Procura que quede en máximo 200 caracteres"
                            className="resize-none h-20"
                            maxLength={200}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            {settings.customFooterText.length} de 200 caracteres
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Mostrar código QR</Label>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.showQr}
                                onCheckedChange={(checked) => updateSetting('showQr', checked)}
                            />
                            <span className="text-sm">Mostrar QR en el ticket</span>
                        </div>
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
                            "bg-white shadow-lg font-mono",
                            settings.paperSize === 80 ? "w-[300px]" : "w-[220px]",
                            // Font size
                            settings.fontSize === 'small' && "text-[10px]",
                            settings.fontSize === 'medium' && "text-xs",
                            settings.fontSize === 'large' && "text-sm",
                            // Font weight
                            settings.fontWeight === 'bold' && "font-semibold",
                            // Line spacing
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
                        {/* Header */}
                        <div className={cn(
                            "space-y-1 pb-2",
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
                                "font-bold uppercase",
                                settings.headerFontSize === 'medium' && "text-sm",
                                settings.headerFontSize === 'large' && "text-base",
                                settings.headerFontSize === 'xlarge' && "text-lg"
                            )}>{companyInfo.name || 'NOMBRE DE LA EMPRESA'}</div>
                            <div>NIT {companyInfo.nit || '900.000.000-1'}</div>
                            <div>{companyInfo.address || 'Calle 123 #45-67'}, {companyInfo.city || 'Bogotá'}</div>
                            <div>Teléfono: {companyInfo.phone || '+57 300 123 4567'}</div>
                            {companyInfo.email && <div>{companyInfo.email}</div>}
                            <div>Régimen: {companyInfo.regime || 'Responsable de IVA'}</div>
                        </div>

                        <div className="text-center font-bold py-2 border-y border-dashed my-2">
                            Factura electrónica de venta<br />
                            N° {sampleInvoice.number}
                        </div>

                        {/* Invoice Info */}
                        <div className="space-y-1 py-2 text-[10px]">
                            <div>Fecha de emisión: {sampleInvoice.date}</div>
                            <div>Forma de pago: {sampleInvoice.paymentMethod}</div>
                            <div>Vendedor: {sampleInvoice.seller}</div>
                            <div>Vencimiento: {sampleInvoice.dueDate}</div>
                        </div>

                        <div className="py-2 border-t border-dashed">
                            <div className="font-bold">{sampleInvoice.customer.name}</div>
                            <div className="text-[10px]">Teléfono: {sampleInvoice.customer.phone}</div>
                            <div className="text-[10px]">{sampleInvoice.customer.id}</div>
                        </div>

                        <div className="text-[10px] py-1">{getSeparator()}</div>

                        {/* Items */}
                        <div className="space-y-2 py-2">
                            {sampleInvoice.items.map((item, idx) => (
                                <div key={idx} className="text-[10px]">
                                    {settings.groupData ? (
                                        <div>
                                            <div>{idx + 1}. {item.name}</div>
                                            <div className="pl-3">
                                                {item.qty} x {settings.showUnitPrice && formatCurrency(item.price)} = {formatCurrency(item.qty * item.price)}
                                                {item.discount && <span className="text-red-500"> (-{formatCurrency(item.discount)})</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between">
                                            <div className="flex-1">
                                                <span>{idx + 1}. </span>
                                                <span>{item.name}</span>
                                                {settings.showUnitOfMeasure && <span className="text-gray-500"> (UN)</span>}
                                                <div className="pl-3 text-gray-600">{item.sku}</div>
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <div>{item.qty} {settings.showUnitPrice && <span>x {formatCurrency(item.price)}</span>}</div>
                                                {item.discount && <div className="text-red-500">Descuento: -{formatCurrency(item.discount)}</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="text-[10px] py-1">{getSeparator()}</div>

                        {/* Totals */}
                        {settings.showTotals && (
                            <div className="space-y-1 py-2 text-[11px]">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(sampleInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-red-500">
                                    <span>Descuento:</span>
                                    <span>-{formatCurrency(sampleInvoice.discount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(sampleInvoice.subtotal - sampleInvoice.discount)}</span>
                                </div>
                                {sampleInvoice.taxes.map((tax, idx) => (
                                    <div key={idx} className="flex justify-between text-gray-600">
                                        <span>Total {tax.name}:</span>
                                        <span>{formatCurrency(tax.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-sm pt-1 border-t">
                                    <span>Total:</span>
                                    <span>{formatCurrency(sampleInvoice.total)}</span>
                                </div>
                            </div>
                        )}

                        {/* Tax Summary */}
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

                        {/* Line/Product Count */}
                        {(settings.showLineCount || settings.showProductCount) && (
                            <div className="text-[10px] py-2 border-t space-y-1">
                                <div>Total recibido: {formatCurrency(sampleInvoice.total)}</div>
                                {settings.showLineCount && <div>Total de líneas: {sampleInvoice.items.length}</div>}
                                {settings.showProductCount && <div>Total de productos: {sampleInvoice.items.reduce((acc, i) => acc + i.qty, 0)}</div>}
                            </div>
                        )}

                        {/* QR Code */}
                        {settings.showQr && (
                            <div className="flex justify-center py-4">
                                <div className="w-24 h-24 bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">
                                    [Código QR]
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="text-[9px] text-center py-2 space-y-2 border-t">
                            {settings.customFooterText && (
                                <p className="italic">{settings.customFooterText}</p>
                            )}
                            <p>
                                Este documento se asimila en todos sus efectos a una letra de cambio de conformidad con el Art. 774
                                del código de comercio. Autorizo que en caso de incumplimiento de esta obligación sea reportado a
                                las centrales de riesgo, se cobrarán intereses por mora.
                            </p>
                            <div className="font-medium pt-2">
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
