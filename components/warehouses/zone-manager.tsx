'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function ZoneManager({ warehouseId }: { warehouseId: string }) {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [newZoneName, setNewZoneName] = useState('')
    const [editName, setEditName] = useState('')

    const { data: zones = [], isLoading } = useQuery({
        queryKey: ['warehouse-zones', warehouseId],
        queryFn: async () => {
            const res = await fetch(`/api/warehouses/${warehouseId}/zones`)
            if (!res.ok) throw new Error('Error al cargar zonas')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await fetch(`/api/warehouses/${warehouseId}/zones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al crear zona')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouse-zones', warehouseId] })
            setNewZoneName('')
            toast('Zona creada', 'success')
        },
        onError: (error: any) => toast(error.message, 'error')
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            const res = await fetch(`/api/warehouses/${warehouseId}/zones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al actualizar zona')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouse-zones', warehouseId] })
            setEditingId(null)
            toast('Zona actualizada', 'success')
        },
        onError: (error: any) => toast(error.message, 'error')
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/warehouses/${warehouseId}/zones/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al eliminar zona')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouse-zones', warehouseId] })
            toast('Zona eliminada', 'success')
        },
        onError: (error: any) => toast(error.message, 'error')
    })

    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Nombre de nueva zona (ej: Pasillo A)"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="h-9"
                />
                <Button
                    type="button"
                    size="sm"
                    onClick={() => createMutation.mutate(newZoneName)}
                    disabled={!newZoneName || createMutation.isPending}
                >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Agregar
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-gray-50/50">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-gray-100/50">
                            <th className="text-left p-2">Nombre</th>
                            <th className="text-right p-2 w-24">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zones.map((zone: any) => (
                            <tr key={zone.id} className="border-b last:border-0 hover:bg-white/50">
                                <td className="p-2">
                                    {editingId === zone.id ? (
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-8"
                                            autoFocus
                                        />
                                    ) : (
                                        zone.name
                                    )}
                                </td>
                                <td className="p-2 text-right">
                                    <div className="flex justify-end gap-1">
                                        {editingId === zone.id ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => updateMutation.mutate({ id: zone.id, name: editName })}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => {
                                                        setEditingId(zone.id)
                                                        setEditName(zone.name)
                                                    }}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => {
                                                        if (confirm('¿Estás seguro de eliminar esta zona?')) {
                                                            deleteMutation.mutate(zone.id)
                                                        }
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {zones.length === 0 && (
                            <tr>
                                <td colSpan={2} className="p-4 text-center text-gray-500 italic">No hay zonas configuradas</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
