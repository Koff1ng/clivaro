
'use client'

import { useState, useMemo } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountSelectProps {
    value?: string
    onChange: (value: string) => void
    accounts: any[]
}

export function AccountSelect({ value, onChange, accounts }: AccountSelectProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    const selected = accounts.find(a => a.id === value)

    const filtered = useMemo(() => {
        if (!search) return accounts.slice(0, 100) // Show first 100 if no search
        const s = search.toLowerCase()
        return accounts.filter(a =>
            a.code.includes(s) ||
            a.name.toLowerCase().includes(s)
        ).slice(0, 100) // Increase limit for search
    }, [accounts, search])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-9 text-xs font-normal"
                >
                    <div className="truncate flex items-center">
                        {selected ? (
                            <span className="truncate">
                                <span className="font-mono font-bold mr-2 text-slate-500">{selected.code}</span>
                                {selected.name}
                            </span>
                        ) : (
                            "Seleccionar cuenta..."
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <div className="flex flex-col">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por código o nombre..."
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
                                No se encontraron cuentas.
                            </div>
                        ) : (
                            filtered.map((acc) => (
                                <button
                                    key={acc.id}
                                    onClick={() => {
                                        onChange(acc.id)
                                        setOpen(false)
                                        setSearch('')
                                    }}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors hover:bg-slate-100 flex items-center justify-between",
                                        value === acc.id && "bg-slate-50 font-medium"
                                    )}
                                >
                                    <div className="flex items-center truncate mr-2">
                                        <span className={cn(
                                            "font-mono font-bold mr-3 w-16 shrink-0",
                                            acc.code.length === 1 ? "text-blue-700" :
                                                acc.code.length === 2 ? "text-blue-600" :
                                                    acc.code.length === 4 ? "text-slate-600" : "text-slate-500"
                                        )}>
                                            {acc.code}
                                        </span>
                                        <span className="truncate">{acc.name}</span>
                                    </div>
                                    {value === acc.id && <Check className="h-3 w-3 shrink-0 text-blue-600" />}
                                </button>
                            ))
                        )}
                        {filtered.length >= 100 && (
                            <div className="p-2 text-center text-[10px] text-muted-foreground border-t">
                                Mostrando primeros 100 resultados. Use la búsqueda para filtrar.
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
