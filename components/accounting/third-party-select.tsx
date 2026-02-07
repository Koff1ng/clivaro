
'use client'

import { useState, useEffect } from 'react'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown, User, Building, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThirdPartySelectProps {
    value?: string
    onChange: (value: string, name: string) => void
    disabled?: boolean
}

export function ThirdPartySelect({ value, onChange, disabled }: ThirdPartySelectProps) {
    const [open, setOpen] = useState(false)
    const [thirdParties, setThirdParties] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setLoading(true)
        fetch('/api/accounting/third-parties')
            .then(res => res.json())
            .then(data => setThirdParties(data))
            .finally(() => setLoading(false))
    }, [])

    const selected = thirdParties.find((tp) => tp.id === value)

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
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar tercero por nombre o NIT..." />
                    <CommandList>
                        <CommandEmpty>No se encontró el tercero.</CommandEmpty>
                        <CommandGroup>
                            {thirdParties.map((tp) => (
                                <CommandItem
                                    key={tp.id}
                                    value={tp.name + " " + (tp.taxId || "")}
                                    onSelect={() => {
                                        onChange(tp.id, tp.name)
                                        setOpen(false)
                                    }}
                                    className="text-xs"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === tp.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <div className="flex items-center">
                                            {getIcon(tp.type)}
                                            {tp.name}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground ml-5">
                                            {tp.taxId ? `${tp.idType}: ${tp.taxId}` : "Sin ID"}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
