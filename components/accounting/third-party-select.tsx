
'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ChevronsUpDown, User, Building, Landmark, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThirdPartySelectProps {
    value?: string
    onChange: (value: string, name: string, type: string) => void
    disabled?: boolean
}

export function ThirdPartySelect({ value, onChange, disabled }: ThirdPartySelectProps) {
    const [open, setOpen] = useState(false)
    const [thirdParties, setThirdParties] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        setLoading(true)
        fetch('/api/accounting/third-parties')
            .then(res => res.json())
            .then(data => setThirdParties(data))
            .finally(() => setLoading(false))
    }, [])

    const selected = thirdParties.find((tp) => tp.id === value)

    const filtered = useMemo(() => {
        if (!search) return thirdParties.slice(0, 50)
        const s = search.toLowerCase()
        return thirdParties.filter(tp =>
            tp.name.toLowerCase().includes(s) ||
            (tp.taxId && tp.taxId.includes(s))
        ).slice(0, 50)
    }, [thirdParties, search])

    const getIcon = (type: string) => {
        switch (type) {
            case 'CUSTOMER': return <User className="h-3 w-3 mr-2 text-blue-500" />
            case 'SUPPLIER': return <Building className="h-3 w-3 mr-2 text-purple-500" />
            case 'BANK': return <Landmark className="h-3 w-3 mr-2 text-green-500" />
            default: return <User className="h-3 w-3 mr-2 text-gray-400" />
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-9 text-xs font-normal"
                    disabled={disabled || loading}
                >
                    <div className="truncate flex items-center">
                        {selected ? (
                            <>
                                {getIcon(selected.type)}
                                {selected.name}
                            </>
                        ) : (
                            "Seleccionar tercero..."
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex flex-col">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar tercero..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 h-9 text-xs"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No se encontraron resultados.
                            </div>
                        ) : (
                            filtered.map((tp) => (
                                <button
                                    type="button"
                                    key={tp.id}
                                    onClick={() => {
                                        onChange(tp.id, tp.name, tp.type)
                                        setOpen(false)
                                        setSearch('')
                                    }}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors hover:bg-slate-100 flex items-center justify-between",
                                        value === tp.id && "bg-slate-50 font-medium"
                                    )}
                                >
                                    <div className="flex flex-col truncate mr-2">
                                        <div className="flex items-center truncate">
                                            {getIcon(tp.type)}
                                            <span className="truncate">{tp.name}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground ml-5">
                                            {tp.taxId ? `${tp.idType}: ${tp.taxId}` : "Sin ID"}
                                        </span>
                                    </div>
                                    {value === tp.id && <Check className="h-3 w-3 shrink-0 text-blue-600" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
