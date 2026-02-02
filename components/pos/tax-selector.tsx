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

interface TaxRate {
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

export function TaxSelector({ selectedTaxes, onTaxesChange, disabled }: TaxSelectorProps) {
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
        const isSelected = selectedTaxes.some((t) => t.id === tax.id)
        if (isSelected) {
            onTaxesChange(selectedTaxes.filter((t) => t.id !== tax.id))
        } else {
            onTaxesChange([...selectedTaxes, tax])
        }
    }

    const totalRate = selectedTaxes.reduce((sum, t) => sum + t.rate, 0)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={disabled}
                >
                    <Badge variant="secondary" className="px-1 font-mono">
                        {totalRate}%
                    </Badge>
                    Impuestos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Seleccionar Impuestos</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-2 py-4">
                        {isLoading ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                Cargando impuestos...
                            </div>
                        ) : availableTaxes.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                No hay impuestos configurados.
                            </div>
                        ) : (
                            availableTaxes.map((tax) => {
                                const isSelected = selectedTaxes.some((t) => t.id === tax.id)
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
                            })
                        )}
                    </div>
                </ScrollArea>
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                        <Info className="h-3 w-3" />
                        <span className="text-[11px]">En Colombia, los impuestos se calculan sobre la base neta.</span>
                    </div>
                    <div className="font-bold">Total: {totalRate}%</div>
                </div>
                <Button onClick={() => setOpen(false)} className="w-full mt-2">
                    Confirmar
                </Button>
            </DialogContent>
        </Dialog>
    )
}
