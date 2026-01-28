'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2, Save, Loader2, ArrowRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RecipeItem {
    id?: string
    ingredientId: string
    quantity: number
    unitId?: string
    ingredient?: {
        name: string
        sku: string
        unitOfMeasure: string
    }
}

interface Recipe {
    id?: string
    productId: string
    yield: number
    active: boolean
    items: RecipeItem[]
}

export function RecipeEditor({ productId, productName, onSave }: { productId: string, productName: string, onSave?: () => void }) {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [items, setItems] = useState<RecipeItem[]>([])
    const [yieldValue, setYieldValue] = useState(1)
    const [isActive, setIsActive] = useState(true)

    // Fetch Units
    const { data: units = [] } = useQuery({
        queryKey: ['units'],
        queryFn: async () => {
            const res = await fetch('/api/units')
            if (!res.ok) throw new Error('Failed to fetch units')
            return res.json()
        }
    })

    // Fetch Recipe
    const { data: recipe, isLoading: isLoadingRecipe } = useQuery({
        queryKey: ['recipe', productId],
        queryFn: async () => {
            const res = await fetch(`/api/recipes?productId=${productId}`)
            if (!res.ok) throw new Error('Failed to fetch recipe')
            return res.json()
        }
    })

    // Fetch Ingredients (RAW or PREPARED products)
    const { data: ingredientsData, isLoading: isLoadingIngredients } = useQuery({
        queryKey: ['products-ingredients', productId], // exclude self
        queryFn: async () => {
            const res = await fetch('/api/products?limit=100') // Basic fetch, ideally filter on server
            if (!res.ok) throw new Error('Failed to fetch products')
            const data = await res.json()
            // Filter only RAW, PREPARED, or RETAIL that can be used as ingredients, and exclude self
            return data.products.filter((p: any) => p.id !== productId)
        }
    })

    useEffect(() => {
        if (recipe) {
            setItems(recipe.items || [])
            setYieldValue(recipe.yield || 1)
            setIsActive(recipe.active ?? true)
        }
    }, [recipe])

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                productId,
                yield: yieldValue,
                active: isActive,
                items: items.map(it => ({
                    ingredientId: it.ingredientId,
                    quantity: it.quantity,
                    unitId: it.unitId || null
                }))
            }
            const res = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to save recipe')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipe', productId] })
            toast('Receta guardada exitosamente', 'success')
            if (onSave) onSave()
        },
        onError: (err: any) => {
            toast(err.message, 'error')
        }
    })

    const addItem = () => {
        setItems([...items, { ingredientId: '', quantity: 1 }])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItem = (index: number, field: keyof RecipeItem, value: any) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        setItems(newItems)
    }

    if (isLoadingRecipe) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Receta de {productName}</h3>
                    <p className="text-sm text-muted-foreground">Define los ingredientes y cantidades para elaborar este producto.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="yield">Rendimento / Yield</Label>
                        <Input
                            id="yield"
                            type="number"
                            step="0.01"
                            value={yieldValue}
                            onChange={(e) => setYieldValue(Number(e.target.value))}
                            className="w-20"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="flex items-end gap-3 p-3 border rounded-lg bg-muted/20">
                        <div className="flex-1 space-y-2">
                            <Label>Ingrediente / Insumo</Label>
                            <Select
                                value={item.ingredientId}
                                onValueChange={(val) => updateItem(index, 'ingredientId', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione producto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ingredientsData?.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} ({p.sku}) - {p.unitOfMeasure}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-24 space-y-2">
                            <Label>Cantidad</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            />
                        </div>

                        <div className="w-24 space-y-2">
                            <Label>Unidad</Label>
                            <Select
                                value={item.unitId || ''}
                                onValueChange={(val) => updateItem(index, 'unitId', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Base" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Original</SelectItem>
                                    {units.map((u: any) => (
                                        <SelectItem key={u.id} value={u.id}>{u.symbol}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 mb-0.5"
                            onClick={() => removeItem(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                        No hay ingredientes definidos en esta receta.
                    </div>
                )}

                <Button
                    type="button"
                    variant="outline"
                    onClick={addItem}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Ingrediente
                </Button>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Receta
                </Button>
            </div>
        </div>
    )
}
