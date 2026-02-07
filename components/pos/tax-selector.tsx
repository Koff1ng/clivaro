'use client'

import { useState, useEffect } from 'react'
import { Check, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface TaxRate {
    id: string
    name: string
    rate: number
    type: string
}

interface TaxSelectorProps {
    selectedTaxes: TaxRate[]
    onTaxesChange: (taxes: TaxRate[]) => void
    disabled?: boolean
}

export function TaxSelector({ selectedTaxes = [], onTaxesChange, disabled }: TaxSelectorProps) {
    const [availableTaxes, setAvailableTaxes] = useState<TaxRate[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (open && availableTaxes.length === 0) {
            loadTaxes()
        }
    }, [open, availableTaxes.length])

    async function loadTaxes() {
        setIsLoading(true)
        try {
            const res = await fetch('/api/tax-rates')
            if (res.ok) {
                const data = await res.json()
                setAvailableTaxes(data)
            }
        } catch (error) {
            console.error('Failed to load taxes', error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleTax = (tax: TaxRate) => {
        const isSelected = selectedTaxes.some((t) =>
            t.id === tax.id || (t.id === 'default' && t.rate === tax.rate && t.type === tax.type)
        )

        if (isSelected) {
            // Deselect: Remove matching taxes
            onTaxesChange(selectedTaxes.filter((t) =>
                !(t.id === tax.id || (t.id === 'default' && t.rate === tax.rate && t.type === tax.type))
            ))
            return
        }

        // Selection Logic with Rules
        let newSelection = [...selectedTaxes]

        if (tax.type === 'IVA' || tax.type === 'ICO') {
            // Rule: IVA and ICO are mutually exclusive. 
            // Also, usually only one IVA or ICO per product (single primary tax).
            // Remove any existing IVA or ICO
            newSelection = newSelection.filter(t => t.type !== 'IVA' && t.type !== 'ICO')
        }

        // Retentions (RETEFUENTE, RETEICA, etc) can be multiple, so we just add them.
        onTaxesChange([...newSelection, tax])
    }

    const taxes = selectedTaxes.filter(t => t.type === 'IVA' || t.type === 'ICO')
    const retentions = selectedTaxes.filter(t => t.type.startsWith('RETE'))

    const totalTaxRate = taxes.reduce((sum, t) => sum + t.rate, 0)
    const totalRetentionRate = retentions.reduce((sum, t) => sum + t.rate, 0)

    // Group available taxes
    const additiveTaxes = availableTaxes.filter(t => t.type === 'IVA' || t.type === 'ICO')
    const subtractiveTaxes = availableTaxes.filter(t => t.type.startsWith('RETE'))

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={disabled}
                >
                    <Badge variant={totalRetentionRate > 0 ? "secondary" : "secondary"} className="px-1 font-mono">
                        {totalTaxRate > 0 ? `+${totalTaxRate}%` : '0%'}
                        {totalRetentionRate > 0 && ` / -${totalRetentionRate}%`}
                    </Badge>
                    Impuestos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configurar Impuestos</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[400px] pr-4">
                    <div className="space-y-4 py-4">
                        {isLoading ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                Cargando...
                            </div>
                        ) : availableTaxes.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                No hay impuestos configurados.
                            </div>
                        ) : (
                            <>
                                {/* Additive Taxes Section */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Impuestos (Suman)</h4>
                                    {additiveTaxes.map((tax) => {
                                        const isSelected = selectedTaxes.some((t) =>
                                            t.id === tax.id || (t.id === 'default' && t.rate === tax.rate && t.type === tax.type)
                                        )
                                        return (
                                            <Button
                                                key={tax.id}
                                                variant={isSelected ? "default" : "outline"}
                                                className="w-full justify-between font-normal"
                                                onClick={() => toggleTax(tax)}
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-medium">{tax.name}</span>
                                                    <span className="text-[10px] opacity-70 uppercase">{tax.type}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{tax.rate}%</span>
                                                    {isSelected && <Check className="h-4 w-4" />}
                                                </div>
                                            </Button>
                                        )
                                    })}
                                </div>

                                {/* Subtractive Taxes Section */}
                                {subtractiveTaxes.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t">
                                        <h4 className="text-sm font-medium text-muted-foreground text-orange-600">Retenciones (Restan)</h4>
                                        {subtractiveTaxes.map((tax) => {
                                            const isSelected = selectedTaxes.some((t) => t.id === tax.id)
                                            return (
                                                <Button
                                                    key={tax.id}
                                                    variant={isSelected ? "secondary" : "outline"}
                                                    className={`w-full justify-between font-normal ${isSelected ? 'border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100' : ''}`}
                                                    onClick={() => toggleTax(tax)}
                                                >
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <span className="font-medium">{tax.name}</span>
                                                        <span className="text-[10px] opacity-70 uppercase">{tax.type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-orange-600">-{tax.rate}%</span>
                                                        {isSelected && <Check className="h-4 w-4 text-orange-600" />}
                                                    </div>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                    <div className="flex flex-col gap-1 text-muted-foreground w-2/3">
                        <div className="flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            <span className="text-[11px]">IVA e Impoconsumo son excluyentes.</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-green-600">+{totalTaxRate}%</div>
                        {totalRetentionRate > 0 && (
                            <div className="font-bold text-orange-600">-{totalRetentionRate}%</div>
                        )}
                    </div>
                </div>
                <Button onClick={() => setOpen(false)} className="w-full mt-2">
                    Confirmar
                </Button>
            </DialogContent>
        </Dialog>
    )
}
