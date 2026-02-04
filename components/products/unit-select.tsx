'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Search, ChevronDown, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COMMON_UNITS = [
    // Generics
    { id: 'UNIT', label: 'Unidad' },
    { id: 'SERVICE', label: 'Servicio' },
    { id: 'PIECE', label: 'Pieza' },
    { id: 'SET', label: 'Juego / Set' },
    { id: 'KIT', label: 'Kit' },
    { id: 'PAIR', label: 'Par' },
    { id: 'BOX', label: 'Caja' },
    { id: 'PACK', label: 'Paquete' },
    { id: 'DOZEN', label: 'Docena' },
    { id: 'ROLL', label: 'Rollo' },
    { id: 'PALLET', label: 'Estiba / Pallet' },

    // Weight
    { id: 'KILO', label: 'Kilogramo (kg)' },
    { id: 'GRAM', label: 'Gramo (g)' },
    { id: 'MILLIGRAM', label: 'Miligramo (mg)' },
    { id: 'TON', label: 'Tonelada (t)' },
    { id: 'POUND', label: 'Libra (lb)' },
    { id: 'OUNCE', label: 'Onza (oz)' },

    // Volume
    { id: 'LITER', label: 'Litro (L)' },
    { id: 'MILLILITER', label: 'Mililitro (ml)' },
    { id: 'GALLON', label: 'Galón (gal)' },
    { id: 'CUBIC_METER', label: 'Metro Cúbico (m³)' },

    // Length
    { id: 'METER', label: 'Metro (m)' },
    { id: 'CENTIMETER', label: 'Centímetro (cm)' },
    { id: 'MILLIMETER', label: 'Milímetro (mm)' },
    { id: 'INCH', label: 'Pulgada (in)' },
    { id: 'FOOT', label: 'Pie (ft)' },
    { id: 'YARD', label: 'Yarda (yd)' },

    // Area
    { id: 'SQUARE_METER', label: 'Metro Cuadrado (m²)' },
    { id: 'SQUARE_FOOT', label: 'Pie Cuadrado (ft²)' },

    // Time / Service
    { id: 'HOUR', label: 'Hora' },
    { id: 'DAY', label: 'Día' },
    { id: 'WEEK', label: 'Semana' },
    { id: 'MONTH', label: 'Mes' },
    { id: 'YEAR', label: 'Año' },
    { id: 'SESSION', label: 'Sesión' },
    { id: 'PROJECT', label: 'Proyecto' },
    { id: 'CONTRACT', label: 'Contrato' },
]

interface UnitSelectProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

export function UnitSelect({ value, onChange, disabled }: UnitSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 200)
    const containerRef = useRef<HTMLDivElement>(null)

    // Custom unit state logic:
    // Use props value, if it matches a preset, show preset label.
    // Else show value itself.

    const selectedOption = COMMON_UNITS.find(u => u.id === value)
    const displayLabel = selectedOption ? selectedOption.label : (value || 'Seleccionar unidad')

    const filteredOptions = useMemo(() => {
        const term = debouncedSearch.toLowerCase()
        return COMMON_UNITS.filter(u =>
            u.label.toLowerCase().includes(term) ||
            u.id.toLowerCase().includes(term)
        )
    }, [debouncedSearch])

    // Logic to determine if we should show "Create" option
    // Show if search matches no existing ID exactly
    const showCreate = debouncedSearch && !COMMON_UNITS.some(u => u.id === debouncedSearch.toUpperCase() || u.label.toLowerCase() === debouncedSearch.toLowerCase())

    // Close click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleSelect = (id: string) => {
        onChange(id)
        setIsOpen(false)
        setSearch('')
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span className={!value ? 'text-muted-foreground' : ''}>
                    {displayLabel}
                </span>
                <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95 max-h-[300px] flex flex-col">
                    <div className="p-2 border-b">
                        <Input
                            autoFocus
                            placeholder="Buscar o crear unidad..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8"
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelect(opt.id)}
                                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            >
                                <span>{opt.label}</span>
                                {value === opt.id && <Check className="h-4 w-4" />}
                            </button>
                        ))}

                        {filteredOptions.length === 0 && !showCreate && (
                            <p className="p-2 text-xs text-muted-foreground text-center">No hay coincidencias</p>
                        )}

                        {showCreate && (
                            <button
                                type="button"
                                onClick={() => handleSelect(search.toUpperCase())}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none bg-blue-50 text-blue-700 hover:bg-blue-100"
                            >
                                <Plus className="h-4 w-4" />
                                Crear "{search.toUpperCase()}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
