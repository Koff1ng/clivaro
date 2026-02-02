'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, User, Phone, Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

export default function EmployeesPage() {
    const [isOpen, setIsOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        documentId: '',
        email: '',
        phone: '',
        address: '',
        hireDate: new Date().toISOString().split('T')[0],
        baseSalary: 0
    })

    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const res = await fetch('/api/payroll/employees')
            if (!res.ok) throw new Error('Error fetching employees')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/payroll/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to create employee')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            setIsOpen(false)
            setFormData({
                firstName: '',
                lastName: '',
                documentId: '',
                email: '',
                phone: '',
                address: '',
                hireDate: new Date().toISOString().split('T')[0],
                baseSalary: 0
            })
            toast('Empleado creado correctamente', 'success')
        },
        onError: (error: Error) => {
            toast(error.message, 'error')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate(formData)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Empleados</h1>
                    <p className="text-muted-foreground">Gestión de personal y nómina.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Empleado</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Registrar Empleado</DialogTitle>
                            <DialogDescription>
                                Información personal y salarial.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nombres</Label>
                                    <Input value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Apellidos</Label>
                                    <Input value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Identificación</Label>
                                    <Input value={formData.documentId} onChange={e => setFormData({ ...formData, documentId: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Teléfono</Label>
                                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Ingreso</Label>
                                    <Input type="date" value={formData.hireDate} onChange={e => setFormData({ ...formData, hireDate: e.target.value })} required />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>Dirección</Label>
                                    <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2 border-t pt-4">
                                    <Label className="text-lg">Salario Base</Label>
                                    <Input
                                        type="number"
                                        value={formData.baseSalary}
                                        onChange={e => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) })}
                                        required
                                        className="text-lg font-bold"
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Guardando...' : 'Guardar Empleado'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Fecha Ingreso</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Salario Base</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : employees?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay empleados registrados</TableCell>
                            </TableRow>
                        ) : (
                            employees?.map((emp: any) => (
                                <TableRow key={emp.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                <User className="h-4 w-4 text-slate-500" />
                                            </div>
                                            {emp.firstName} {emp.lastName}
                                        </div>
                                    </TableCell>
                                    <TableCell>{emp.documentId}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        <div className="flex flex-col gap-1">
                                            {emp.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</div>}
                                            {emp.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.phone}</div>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{new Date(emp.hireDate).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={emp.status === 'ACTIVE' ? 'default' : 'secondary'}>{emp.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                        {formatCurrency(emp.baseSalary)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
