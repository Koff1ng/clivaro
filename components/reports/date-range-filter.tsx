'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { es } from 'date-fns/locale'

export interface DateRange {
    from: Date
    to: Date
}

interface DateRangeFilterProps {
    value: DateRange
    onChange: (range: DateRange) => void
}

const presets = [
    {
        label: 'Hoy',
        getValue: () => ({
            from: new Date(),
            to: new Date(),
        }),
    },
    {
        label: 'Últimos 7 días',
        getValue: () => ({
            from: subDays(new Date(), 6),
            to: new Date(),
        }),
    },
    {
        label: 'Últimos 30 días',
        getValue: () => ({
            from: subDays(new Date(), 29),
            to: new Date(),
        }),
    },
    {
        label: 'Este mes',
        getValue: () => ({
            from: startOfMonth(new Date()),
            to: endOfMonth(new Date()),
        }),
    },
    {
        label: 'Este año',
        getValue: () => ({
            from: startOfYear(new Date()),
            to: endOfYear(new Date()),
        }),
    },
]

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
    const [customFrom, setCustomFrom] = useState(format(value.from, 'yyyy-MM-dd'))
    const [customTo, setCustomTo] = useState(format(value.to, 'yyyy-MM-dd'))

    const handlePreset = (preset: typeof presets[0]) => {
        const range = preset.getValue()
        onChange(range)
        setCustomFrom(format(range.from, 'yyyy-MM-dd'))
        setCustomTo(format(range.to, 'yyyy-MM-dd'))
    }

    const handleCustomChange = () => {
        onChange({
            from: new Date(customFrom),
            to: new Date(customTo),
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Período:</span>
                {presets.map((preset) => (
                    <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreset(preset)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Desde:</label>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        onBlur={handleCustomChange}
                        className="px-3 py-2 border rounded-md text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Hasta:</label>
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        onBlur={handleCustomChange}
                        className="px-3 py-2 border rounded-md text-sm"
                    />
                </div>
                <Button size="sm" onClick={handleCustomChange}>
                    Aplicar
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                Mostrando datos desde {format(value.from, 'PPP', { locale: es })} hasta{' '}
                {format(value.to, 'PPP', { locale: es })}
            </div>
        </div>
    )
}
