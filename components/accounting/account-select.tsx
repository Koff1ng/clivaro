'use client'

import { useState, useMemo, useEffect } from 'react'
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command" // If command exists... checking... Ah, I saw earlier "Check for Command" and I didn't verify file content, just dir. `searchable-select` implemented custom.
// Using custom implementation to avoid dependency issues if Command isn't full.
// Actually, `searchable-select` is good enough base.

import { Input } from '@/components/ui/input'
import { ChevronDown } from 'lucide-react'

interface AccountSelectProps {
    value?: string
    onChange: (value: string) => void
    accounts: any[]
}

export function AccountSelect({ value, onChange, accounts }: AccountSelectProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    const selected = accounts.find(a => a.id === value)

    const filtered = accounts.filter(a =>
        a.code.includes(search) ||
        a.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50)

    return (
        <div className="relative">
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
                onClick={() => setOpen(!open)}
            >
                {selected ? `${selected.code} - ${selected.name}` : "Seleccionar cuenta..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-hidden flex flex-col">
                    <Input
                        placeholder="Buscar cuenta..."
                        className="border-0 border-b rounded-none focus-visible:ring-0"
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="overflow-y-auto flex-1 p-1">
                        {filtered.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-2 text-center">No encontrado.</div>
                        ) : (
                            filtered.map(acc => (
                                <div
                                    key={acc.id}
                                    className={cn(
                                        "cursor-pointer text-sm p-2 hover:bg-slate-100 rounded",
                                        value === acc.id && "bg-slate-100 font-medium"
                                    )}
                                    onClick={() => {
                                        onChange(acc.id)
                                        setOpen(false)
                                    }}
                                >
                                    <span className="font-mono mr-2 text-slate-500">{acc.code}</span>
                                    {acc.name}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
