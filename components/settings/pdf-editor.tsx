'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOOTER_TEMPLATES, type FooterTemplate, type TicketDesignSettings } from './ticket-editor'

interface PdfEditorProps {
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

// Sample data for PDF preview
const sampleInvoice = {
    number: 'FV-000061',
    date: new Date().toLocaleDateString('es-CO'),
    time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    dueDate: '30 días',
    paymentForm: 'CRÉDITO',
    seller: 'María López',
    customer: {
        name: 'Alexey Jansen S.A.S.',
        taxId: '900.123.456-7',
        idType: 'NIT',
        address: 'Calle 80 #45-12',
        city: 'Bogotá D.C.',
        phone: '+57 310 234 5678',
        email: 'alexey@empresa.com',
    },
    items: [
        { name: 'Pintura Acrílica 1GL', qty: 3, price: 45000, discount: 5, subtotal: 128250, taxRate: 19 },
        { name: 'Rodillo Premium 9"', qty: 2, price: 18500, discount: 0, subtotal: 37000, taxRate: 19 },
        { name: 'Cinta Enmascarar 48mm', qty: 5, price: 8900, discount: 10, subtotal: 40050, taxRate: 0 },
    ],
    subtotalBruto: 218500,
    totalDiscount: 13200,
    taxableBase: 205300,
    taxes: [
        { rate: 19, base: 165250, tax: 31398 },
        { rate: 0, base: 40050, tax: 0 },
    ],
    total: 236698,
    cufe: 'e8c0dba445b1b7be98cde0cee7473abc123def456789abcdef0123456789abcd',
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)

export function PdfEditor({ settings: initialSettings, companyInfo, onChange, onClose }: PdfEditorProps) {
    const [settings, setSettings] = useState<TicketDesignSettings>(() => ({
        ...initialSettings,
        footerTemplate: initialSettings.footerTemplate || 'general',
    }))

    const updateSettings = (updates: Partial<TicketDesignSettings>) => {
        setSettings(prev => {
            const newSettings = { ...prev, ...updates }
            onChange(newSettings)
            return newSettings
        })
    }

    const updateSetting = <K extends keyof TicketDesignSettings>(key: K, value: TicketDesignSettings[K]) => {
        updateSettings({ [key]: value } as any)
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Left Panel - PDF Settings */}
            <div className="lg:w-2/5 space-y-6 overflow-y-auto pb-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        📄 Configurar formato PDF / Carta
                    </h2>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <p className="text-sm text-muted-foreground">
                    Configura los elementos visibles en la impresión de factura en formato carta (PDF).
                </p>

                {/* Logo */}
                <div className="space-y-3 pt-2 border-t">
                    <Label className="font-medium">Elementos del encabezado</Label>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.showLogo}
                            onCheckedChange={(checked) => updateSetting('showLogo', checked)}
                        />
                        <span className="text-sm">Mostrar logo de la empresa</span>
                    </div>
                </div>

                {/* CUFE / Electronic */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Facturación electrónica</Label>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.showCufe}
                            onCheckedChange={(checked) => updateSetting('showCufe', checked)}
                        />
                        <span className="text-sm">Mostrar CUFE y estado DIAN</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.showQr}
                            onCheckedChange={(checked) => updateSetting('showQr', checked)}
                        />
                        <span className="text-sm">Mostrar código QR de verificación</span>
                    </div>
                </div>

                {/* Footer Template */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Pie de página legal</Label>
                    <p className="text-xs text-muted-foreground">
                        Selecciona la plantilla legal según tu tipo de negocio.
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
                                            ? "border-indigo-500 bg-indigo-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm">{tmpl.label}</div>
                                        {isActive && <div className="text-indigo-600 text-xs font-bold">✓ Activo</div>}
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

                {/* Thank you phrase */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Frase de agradecimiento</Label>
                    <Input
                        value={settings.footerText}
                        onChange={(e) => updateSetting('footerText', e.target.value.slice(0, 100))}
                        placeholder="Ej: ¡Gracias por su compra!"
                        maxLength={100}
                    />
                </div>
            </div>

            {/* Right Panel - PDF Preview */}
            <div className="lg:w-3/5 flex flex-col">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-medium text-indigo-600">Vista previa del PDF</h3>
                    <p className="text-xs text-muted-foreground">Formato carta — así se verá tu factura impresa</p>
                </div>

                <div className="flex-1 flex justify-center overflow-y-auto bg-gray-100 rounded-lg p-4">
                    <div className="bg-white shadow-xl rounded-sm w-full max-w-[600px] font-sans text-[11px] leading-snug"
                        style={{ padding: '32px', minHeight: '700px' }}
                    >
                        {/* ═══ HEADER ═══ */}
                        <div className="flex justify-between items-start border-b-2 pb-3 mb-4">
                            <div className="flex-1">
                                {settings.showLogo && (
                                    <div className="mb-2 w-16 h-10 bg-gray-200 rounded flex items-center justify-center text-[8px] text-gray-400">
                                        LOGO
                                    </div>
                                )}
                                <div className="font-bold text-base uppercase">{companyInfo.name || 'NOMBRE EMPRESA'}</div>
                                <div className="text-gray-600">NIT: {companyInfo.nit || '900.000.000-1'}</div>
                                <div className="text-gray-500">{companyInfo.address || 'Calle 123 #45-67'}, {companyInfo.city || 'Bogotá'}</div>
                                <div className="text-gray-500">Tel: {companyInfo.phone || '+57 300 123 4567'}</div>
                                {companyInfo.email && <div className="text-gray-500">{companyInfo.email}</div>}
                                <div className="text-[9px] text-gray-400 mt-1">{companyInfo.regime || 'Responsable de IVA'}</div>
                            </div>
                            <div className="text-right bg-indigo-50 rounded-lg p-3 min-w-[180px]">
                                <div className="font-bold text-indigo-700 text-sm">FACTURA ELECTRÓNICA</div>
                                <div className="font-bold text-indigo-900 text-lg">{sampleInvoice.number}</div>
                                <div className="text-gray-500 text-[10px] mt-1">
                                    <div>Fecha: {sampleInvoice.date}</div>
                                    <div>Vence: {sampleInvoice.dueDate}</div>
                                    <div>Pago: {sampleInvoice.paymentForm}</div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ CUSTOMER ═══ */}
                        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-md">
                            <div>
                                <div className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Datos del Cliente</div>
                                <div className="font-semibold">{sampleInvoice.customer.name}</div>
                                <div className="text-gray-600">{sampleInvoice.customer.idType}: {sampleInvoice.customer.taxId}</div>
                                <div className="text-gray-500">{sampleInvoice.customer.address}</div>
                                <div className="text-gray-500">{sampleInvoice.customer.city}</div>
                            </div>
                            <div>
                                <div className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Contacto</div>
                                <div className="text-gray-600">{sampleInvoice.customer.phone}</div>
                                <div className="text-gray-600">{sampleInvoice.customer.email}</div>
                                <div className="mt-2 text-[10px] text-gray-400">
                                    Vendedor: {sampleInvoice.seller}
                                </div>
                            </div>
                        </div>

                        {/* ═══ ITEMS TABLE ═══ */}
                        <table className="w-full mb-4">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[10px]">
                                    <th className="px-2 py-1.5 text-left">#</th>
                                    <th className="px-2 py-1.5 text-left">Descripción</th>
                                    <th className="px-2 py-1.5 text-center">Cant.</th>
                                    <th className="px-2 py-1.5 text-right">Precio</th>
                                    <th className="px-2 py-1.5 text-center">Dto.%</th>
                                    <th className="px-2 py-1.5 text-right">IVA%</th>
                                    <th className="px-2 py-1.5 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sampleInvoice.items.map((item, idx) => (
                                    <tr key={idx} className={cn("border-b", idx % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                                        <td className="px-2 py-1.5 text-gray-500">{idx + 1}</td>
                                        <td className="px-2 py-1.5 font-medium">{item.name}</td>
                                        <td className="px-2 py-1.5 text-center">{item.qty}</td>
                                        <td className="px-2 py-1.5 text-right">{formatCurrency(item.price)}</td>
                                        <td className="px-2 py-1.5 text-center text-red-500">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                                        <td className="px-2 py-1.5 text-right text-gray-500">{item.taxRate}%</td>
                                        <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ═══ TOTALS ═══ */}
                        <div className="flex justify-end mb-4">
                            <div className="w-64 space-y-1">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal bruto:</span>
                                    <span>{formatCurrency(sampleInvoice.subtotalBruto)}</span>
                                </div>
                                <div className="flex justify-between text-red-500">
                                    <span>Descuentos:</span>
                                    <span>-{formatCurrency(sampleInvoice.totalDiscount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Base gravable:</span>
                                    <span>{formatCurrency(sampleInvoice.taxableBase)}</span>
                                </div>
                                {sampleInvoice.taxes.filter(t => t.tax > 0).map((t, i) => (
                                    <div key={i} className="flex justify-between text-gray-600">
                                        <span>IVA {t.rate}%:</span>
                                        <span>{formatCurrency(t.tax)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-base pt-1 border-t-2 border-black">
                                    <span>TOTAL:</span>
                                    <span>{formatCurrency(sampleInvoice.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* ═══ TAX SUMMARY TABLE ═══ */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Resumen de Impuestos</div>
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <td className="px-2 py-1 font-semibold">Tarifa</td>
                                        <td className="px-2 py-1 text-right font-semibold">Base Gravable</td>
                                        <td className="px-2 py-1 text-right font-semibold">Valor Impuesto</td>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sampleInvoice.taxes.map((t, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="px-2 py-1">IVA {t.rate}%</td>
                                            <td className="px-2 py-1 text-right">{formatCurrency(t.base)}</td>
                                            <td className="px-2 py-1 text-right">{formatCurrency(t.tax)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ═══ CUFE / QR ═══ */}
                        {(settings.showCufe || settings.showQr) && (
                            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-start gap-3">
                                    {settings.showQr && (
                                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-[7px] text-gray-400 flex-shrink-0">
                                            QR
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-bold text-green-800 text-[10px]">✓ DOCUMENTO VALIDADO POR LA DIAN</div>
                                        {settings.showCufe && (
                                            <>
                                                <div className="font-bold text-[9px] text-gray-600 mt-1">CUFE:</div>
                                                <div className="text-[8px] text-gray-500 break-all leading-tight">{sampleInvoice.cufe}</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ LEGAL FOOTER ═══ */}
                        <div className="border-t pt-3 space-y-2 text-center">
                            <div className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Información Legal</div>
                            <p className="text-[9px] text-gray-500 leading-tight max-w-md mx-auto">
                                {settings.footerTemplate === 'custom'
                                    ? (settings.customFooterText || 'Tu texto legal personalizado aparecerá aquí')
                                    : FOOTER_TEMPLATES[settings.footerTemplate || 'general'].text}
                            </p>
                            <div className="flex justify-center gap-3 text-[9px] text-gray-400 pt-1">
                                <span>No somos Grandes Contribuyentes</span>
                                <span>|</span>
                                <span>No somos Autoretenedores</span>
                            </div>
                        </div>

                        {/* ═══ THANK YOU ═══ */}
                        <div className="text-center mt-4 pt-3 border-t">
                            <div className="font-bold text-gray-700">{settings.footerText || '¡Gracias por su compra!'}</div>
                            <div className="text-[9px] text-gray-400 mt-1">Representación impresa de la factura electrónica</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
