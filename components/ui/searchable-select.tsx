'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Search, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOption ? '' : 'text-muted-foreground'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Cargando...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-sm text-muted-foreground space-y-2">
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
                    <Plus className="h-3 w-3 mr-2" />
                    {createLabel}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    {option.label}
                  </button>
                ))}
                {onCreate && (
                  <div className="p-2 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onCreate()
                        setIsOpen(false)
                      }}
                      className="w-full justify-start text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      {createLabel}
                    </Button>
                  </div>
                )}
              </>
            )}
            {filteredOptions.length === 50 && debouncedSearch && (
              <div className="p-2 text-center text-xs text-muted-foreground border-t">
                Mostrando primeros 50 resultados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

