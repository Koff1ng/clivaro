'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

async function fetchCategories() {
  const res = await fetch('/api/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  const data = await res.json()
  return data.categories || []
}

async function createCategory(name: string) {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create category')
  }
  return res.json()
}

interface CategorySelectProps {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
}

export function CategorySelect({ value, onChange, onBlur, name, id }: CategorySelectProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [localCategories, setLocalCategories] = useState<string[]>([])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: serverCategories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  // Combinar categorías del servidor con las locales (recién creadas)
  const allCategories = [...new Set([...serverCategories, ...localCategories])].sort()

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (data) => {
      const categoryName = data.name
      // Agregar la categoría a la lista local
      setLocalCategories(prev => {
        if (!prev.includes(categoryName)) {
          return [...prev, categoryName]
        }
        return prev
      })
      // Invalidar query para refrescar desde el servidor
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      // Establecer el valor seleccionado
      onChange(categoryName)
      setNewCategory('')
      setIsAdding(false)
      toast('Categoría creada exitosamente', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'Error al crear categoría', 'error')
    },
  })

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      createCategoryMutation.mutate(newCategory.trim())
    }
  }

  const handleCancelAdd = () => {
    setNewCategory('')
    setIsAdding(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          id={id}
          name={name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Seleccionar categoría...</option>
          {allCategories.map((category: string) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {!isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Nombre de la nueva categoría"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCategory()
              } else if (e.key === 'Escape') {
                handleCancelAdd()
              }
            }}
            autoFocus
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCategory}
            disabled={!newCategory.trim() || createCategoryMutation.isPending}
          >
            Guardar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelAdd}
            disabled={createCategoryMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

