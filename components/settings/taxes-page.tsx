'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Label } from '@/components/ui/label'

interface TaxRate {
    id: string
    name: string
    rate: number
    type: string
    description?: string
    active: boolean
}

export function TaxesPage() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTax, setEditingTax] = useState<TaxRate | null>(null)
    const [formData, setFormData] = useState({ name: '', rate: '', type: 'IVA', description: '' })

    const { data: taxes = [], isLoading } = useQuery<TaxRate[]>({
        queryKey: ['tax-rates'],
        queryFn: async () => {
            const res = await fetch('/api/tax-rates')
            if (!res.ok) throw new Error('Failed to fetch taxes')
            return res.json()
        }
    })

    const filteredTaxes = taxes.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.type.toLowerCase().includes(search.toLowerCase())
    )

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/tax-rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error('Failed to create tax')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax-rates'] })
            setIsDialogOpen(false)
            resetForm()
            toast('Impuesto creado exitosamente', 'success')
        },
        onError: () => toast('Error al crear impuesto', 'error')
    })

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/tax-rates/${editingTax?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error('Failed to update tax')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax-rates'] })
            setIsDialogOpen(false)
            resetForm()
            toast('Impuesto actualizado', 'success')
        },
        onError: () => toast('Error al actualizar impuesto', 'error')
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/tax-rates/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete tax')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax-rates'] })
            toast('Impuesto eliminado', 'success')
        },
        onError: () => toast('Error al eliminar impuesto', 'error')
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const payload = {
            ...formData,
            rate: parseFloat(formData.rate)
        }

        if (editingTax) {
            updateMutation.mutate(payload)
        } else {
            createMutation.mutate(payload)
        }
    }

    const resetForm = () => {
        setEditingTax(null)
        setFormData({ name: '', rate: '', type: 'IVA', description: '' })
    }

    const openEdit = (tax: TaxRate) => {
        setEditingTax(tax)
        setFormData({
            name: tax.name,
            rate: String(tax.rate),
            type: tax.type,
            description: tax.description || ''
        })
        setIsDialogOpen(true)
    }

    const handleDelete = (id: string, name: string) => {
        if (confirm(`¿Estás seguro de eliminar el impuesto "${name}"?`)) {
            deleteMutation.mutate(id)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Impuestos y Retenciones</h3>
                    <p className="text-sm text-muted-foreground">
                        Configura las tasas de impuestos aplicables a tus productos y servicios.
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Impuesto
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar impuestos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Tasa (%)</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredTaxes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron impuestos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTaxes.map((tax) => (
                                <TableRow key={tax.id}>
                                    <TableCell className="font-medium">{tax.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{tax.type}</Badge>
                                    </TableCell>
                                    <TableCell>{tax.rate}%</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {tax.description || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(tax)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(tax.id, tax.name)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {editingTax ? 'Editar Impuesto' : 'Crear Nuevo Impuesto'}
                        </DialogTitle>
                        <DialogDescription>
                            Define las reglas del impuesto. Recuerda que las retenciones se restan automáticamente.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. IVA General"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="rate">Tasa (%)</Label>
                                    <Input
                                        id="rate"
                                        type="number"
                                        step="0.01"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                        placeholder="19"
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="type">Tipo</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(val) => setFormData({ ...formData, type: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="IVA">IVA</SelectItem>
                                            <SelectItem value="ICO">Impoconsumo (ICO)</SelectItem>
                                            <SelectItem value="RETEFUENTE">ReteFuente</SelectItem>
                                            <SelectItem value="RETEICA">ReteICA</SelectItem>
                                            <SelectItem value="RETEIVA">ReteIVA</SelectItem>
                                            <SelectItem value="OTHER">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Descripción (Opcional)</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Detalles adicionales..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
