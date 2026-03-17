'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Search, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface SearchableSelectProps {
  options: Array<{ id: string; label: string;[key: string]: any }>
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  onSearch?: (search: string) => void
  loading?: boolean
  className?: string
  disabled?: boolean
  onCreate?: () => void
  createLabel?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccione...',
  searchPlaceholder = 'Buscar...',
  onSearch,
  loading = false,
  className = '',
  disabled = false,
  onCreate,
  createLabel = 'Crear nuevo'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtrar opciones localmente
  const filteredOptions = useMemo(() => {
    if (!debouncedSearch) return options.slice(0, 50) // Mostrar solo primeros 50 si no hay búsqueda

    const searchLower = debouncedSearch.toLowerCase()
    return options
      .filter(opt =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.id.toLowerCase().includes(searchLower)
      )
      .slice(0, 50) // Limitar a 50 resultados
  }, [options, debouncedSearch])

  // Llamar a onSearch si se proporciona (para búsqueda en servidor)
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedSearch)
    }
  }, [debouncedSearch, onSearch])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={isOpen} onOpenChange={(open) => !disabled && setIsOpen(open)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              !selectedOption && "text-muted-foreground",
              isOpen && "ring-2 ring-ring ring-offset-2"
            )}
          >
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[300px]"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto py-1">
            {loading ? (
              <div className="p-4 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground space-y-3">
                <p>{debouncedSearch ? 'No se encontraron resultados' : 'No hay opciones disponibles'}</p>
                {onCreate && debouncedSearch && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onCreate()
                      setIsOpen(false)
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createLabel}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-px">
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none"
                  >
                    <div className="font-medium">{option.label}</div>
                    {option.sku && (
                      <div className="text-xs text-muted-foreground">SKU: {option.sku}</div>
                    )}
                  </button>
                ))}
                {onCreate && (
                  <div className="p-1 border-t mt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onCreate()
                        setIsOpen(false)
                      }}
                      className="w-full justify-start text-muted-foreground hover:text-foreground h-9"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {createLabel}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {filteredOptions.length === 50 && debouncedSearch && (
              <div className="p-2 text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-t bg-muted/30">
                Mostrando primeros 50 resultados
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

