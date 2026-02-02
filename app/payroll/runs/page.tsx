'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
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

export default function PayrollRunsPage() {
    const [isOpen, setIsOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()

    // Default dates: First and last day of current month
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

    const [formData, setFormData] = useState({
        startDate: firstDay,
        endDate: lastDay,
        notes: ''
    })

    // Fetch Runs
    const { data: runs, isLoading } = useQuery({
        queryKey: ['payroll-runs'],
        queryFn: async () => {
            const res = await fetch('/api/payroll/runs')
            if (!res.ok) throw new Error('Error fetching runs')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/payroll/runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to generate payroll')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
            setIsOpen(false)
            setFormData({
                startDate: firstDay,
                endDate: lastDay,
                notes: ''
            })
            toast('Nómina generada correctamente', 'success')
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
                    <h1 className="text-3xl font-bold tracking-tight">Cortes de Nómina</h1>
                    <p className="text-muted-foreground">Genera y consulta periodos de pago.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Generar Nómina</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Generar Nómina</DialogTitle>
                            <DialogDescription>
                                Calcula automáticamente el pago para empleados activos.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha Inicio</Label>
                                    <Input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Fin</Label>
                                    <Input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Ej. Quincena 1 Enero" />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Generando...' : 'Generar'}
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
                            <TableHead>Periodo</TableHead>
                            <TableHead>Fecha Pago</TableHead>
                            <TableHead>Empleados</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : runs?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay registros de nómina</TableCell>
                            </TableRow>
                        ) : (
                            runs?.map((run: any) => (
                                <TableRow key={run.id}>
                                    <TableCell className="font-medium">
                                        {format(new Date(run.startDate), 'dd MMM')} - {format(new Date(run.endDate), 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        {run.paymentDate ? format(new Date(run.paymentDate), 'dd/MM/yyyy') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {run._count?.items || 0}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={run.status === 'PAID' ? 'default' : 'secondary'}>{run.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                        {formatCurrency(run.total)}
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

function User(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
