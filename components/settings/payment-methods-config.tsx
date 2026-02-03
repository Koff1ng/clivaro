import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle, CreditCard, Banknote, Wallet, Smartphone, ArrowLeftRight, Landmark, Coins, Receipt } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PaymentMethod {
    id: string
    name: string
    type: string
    active: boolean
    color?: string
    icon?: string
}

const PREDEFINED_COLORS = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#10b981' },
    { name: 'Rojo', value: '#ef4444' },
    { name: 'Púrpura', value: '#8b5cf6' },
    { name: 'Naranja', value: '#f59e0b' },
    { name: 'Índigo', value: '#6366f1' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Gris', value: '#6b7280' },
]

const PREDEFINED_ICONS = [
    { name: 'Tarjeta', icon: CreditCard, value: 'credit-card' },
    { name: 'Efectivo', icon: Banknote, value: 'banknote' },
    { name: 'Billetera', icon: Wallet, value: 'wallet' },
    { name: 'Celular', icon: Smartphone, value: 'smartphone' },
    { name: 'Transferencia', icon: ArrowLeftRight, value: 'arrow-left-right' },
    { name: 'Banco', icon: Landmark, value: 'landmark' },
    { name: 'Monedas', icon: Coins, value: 'coins' },
    { name: 'Factura', icon: Receipt, value: 'receipt' },
]

const IconRenderer = ({ name, className }: { name?: string; className?: string }) => {
    const iconObj = PREDEFINED_ICONS.find(i => i.value === name) || PREDEFINED_ICONS[0]
    const Icon = iconObj.icon
    return <Icon className={className} />
}

export function PaymentMethodsConfig() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [isOpen, setIsOpen] = useState(false)
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [type, setType] = useState('ELECTRONIC')
    const [color, setColor] = useState('#3b82f6')
    const [icon, setIcon] = useState('credit-card')

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
            setColor(method.color || '#3b82f6')
            setIcon(method.icon || 'credit-card')
        } else {
            setEditingMethod(null)
            setName('')
            setType('ELECTRONIC')
            setColor('#3b82f6')
            setIcon('credit-card')
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
        saveMutation.mutate({ name, type, color, icon })
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
                            <TableHead>Visual</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {methods?.map((method) => (
                            <TableRow key={method.id}>
                                <TableCell>
                                    <div
                                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-sm"
                                        style={{ backgroundColor: method.color || '#3b82f6' }}
                                    >
                                        <IconRenderer name={method.icon} className="h-5 w-5" />
                                    </div>
                                </TableCell>
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
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No hay métodos de pago configurados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingMethod ? 'Editar Método' : 'Nuevo Método de Pago'}</DialogTitle>
                            <DialogDescription>
                                Personaliza el aspecto y comportamiento del método de pago.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Tipo de Pago</Label>
                                    <Select value={type} onValueChange={setType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                            <SelectItem value="ELECTRONIC">Electrónico</SelectItem>
                                            <SelectItem value="CARD">Tarjeta</SelectItem>
                                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                            <SelectItem value="CREDIT">Crédito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Vista Previa</Label>
                                    <div
                                        className="h-10 w-full rounded-md flex items-center justify-center text-white"
                                        style={{ backgroundColor: color }}
                                    >
                                        <IconRenderer name={icon} className="h-5 w-5 mr-2" />
                                        <span className="text-xs font-medium truncate px-1">{name || 'Nombre'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Color de Identidad</Label>
                                <div className="grid grid-cols-8 gap-2">
                                    {PREDEFINED_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            className={cn(
                                                "h-8 w-8 rounded-full border-2 transition-all",
                                                color === c.value ? "border-black scale-110 shadow-sm" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: c.value }}
                                            onClick={() => setColor(c.value)}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Icono Representativo</Label>
                                <div className="grid grid-cols-8 gap-2">
                                    {PREDEFINED_ICONS.map((i) => (
                                        <button
                                            key={i.value}
                                            type="button"
                                            className={cn(
                                                "h-8 w-8 rounded-md flex items-center justify-center border transition-all",
                                                icon === i.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80 border-transparent"
                                            )}
                                            onClick={() => setIcon(i.value)}
                                            title={i.name}
                                        >
                                            <i.icon className="h-4 w-4" />
                                        </button>
                                    ))}
                                </div>
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
