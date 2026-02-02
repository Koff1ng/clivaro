'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface PaymentMethod {
    id: string
    name: string
    type: string
    active: boolean
}

export function PaymentMethodsConfig() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [isOpen, setIsOpen] = useState(false)
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [type, setType] = useState('ELECTRONIC')

    const { data: methods, isLoading } = useQuery<PaymentMethod[]>({
        queryKey: ['payment-methods'],
        queryFn: async () => {
            const res = await fetch('/api/settings/payment-methods')
            if (!res.ok) throw new Error('Failed to fetch payment methods')
            return res.json()
        }
    })

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingMethod
                ? `/api/settings/payment-methods/${editingMethod.id}`
                : '/api/settings/payment-methods'
            const res = await fetch(url, {
                method: editingMethod ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error('Failed to save payment method')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
            toast(editingMethod ? 'Método actualizado' : 'Método creado', 'success')
            closeDialog()
        },
        onError: (error: any) => {
            toast(error.message, 'error')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/payment-methods/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Failed to delete payment method')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
            toast('Método eliminado o desactivado', 'success')
        }
    })

    const openDialog = (method?: PaymentMethod) => {
        if (method) {
            setEditingMethod(method)
            setName(method.name)
            setType(method.type)
        } else {
            setEditingMethod(null)
            setName('')
            setType('ELECTRONIC')
        }
        setIsOpen(true)
    }

    const closeDialog = () => {
        setIsOpen(false)
        setEditingMethod(null)
        setName('')
        setType('ELECTRONIC')
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return
        saveMutation.mutate({ name, type })
    }

    const toggleStatus = (method: PaymentMethod) => {
        setEditingMethod(method)
        saveMutation.mutate({ active: !method.active })
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Métodos de Pago</CardTitle>
                    <CardDescription>
                        Configura los métodos de pago disponibles en el POS y facturación.
                    </CardDescription>
                </div>
                <Button onClick={() => openDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Método
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {methods?.map((method) => (
                            <TableRow key={method.id}>
                                <TableCell className="font-medium">{method.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{method.type}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={method.active}
                                            onCheckedChange={() => toggleStatus(method)}
                                            disabled={saveMutation.isPending}
                                        />
                                        {method.active ? (
                                            <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>
                                        ) : (
                                            <Badge variant="secondary">Inactivo</Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => openDialog(method)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(method.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {methods?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No hay métodos de pago configurados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingMethod ? 'Editar Método' : 'Nuevo Método de Pago'}</DialogTitle>
                            <DialogDescription>
                                Ingresa los detalles del método de pago.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Método</Label>
                                <Input
                                    id="name"
                                    placeholder="Ej: Nequi, Daviplata, Tarjeta Visa"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Pago</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Efectivo</SelectItem>
                                        <SelectItem value="ELECTRONIC">Electrónico / Billetera</SelectItem>
                                        <SelectItem value="CARD">Tarjeta</SelectItem>
                                        <SelectItem value="TRANSFER">Transferencia Bancaria</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    El tipo ayuda a categorizar el dinero para el cierre de caja.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                                <Button type="submit" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {editingMethod ? 'Actualizar' : 'Crear'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
