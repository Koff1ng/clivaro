'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export default function JournalPage() {
    const [isOpen, setIsOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()

    // New Entry Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        status: 'DRAFT',
        lines: [
            { accountId: '', debit: 0, credit: 0 },
            { accountId: '', debit: 0, credit: 0 }
        ]
    })

    // Start with fetching accounts for the select dropdown
    const { data: accounts } = useQuery({
        queryKey: ['accounting-accounts'],
        queryFn: async () => (await fetch('/api/accounting/accounts')).json()
    })

    const { data: entries, isLoading } = useQuery({
        queryKey: ['journal-entries'],
        queryFn: async () => {
            const res = await fetch('/api/accounting/journal')
            if (!res.ok) throw new Error('Error fetching journal')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/accounting/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to create entry')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
            setIsOpen(false)
            setFormData({
                date: new Date().toISOString().split('T')[0],
                description: '',
                reference: '',
                status: 'DRAFT',
                lines: [
                    { accountId: '', debit: 0, credit: 0 },
                    { accountId: '', debit: 0, credit: 0 }
                ]
            })
            toast('Asiento contable registrado', 'success')
        },
        onError: (error: Error) => {
            toast(error.message, 'error')
        }
    })

    const addLine = () => {
        setFormData({
            ...formData,
            lines: [...formData.lines, { accountId: '', debit: 0, credit: 0 }]
        })
    }

    const removeLine = (index: number) => {
        if (formData.lines.length <= 2) return
        const newLines = [...formData.lines]
        newLines.splice(index, 1)
        setFormData({ ...formData, lines: newLines })
    }

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...formData.lines]
        newLines[index] = { ...newLines[index], [field]: value }
        setFormData({ ...formData, lines: newLines })
    }

    const totalDebits = formData.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
    const totalCredits = formData.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!isBalanced) {
            toast('El asiento no está balanceado', 'error')
            return
        }
        createMutation.mutate(formData)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Libro Diario</h1>
                    <p className="text-muted-foreground">Registro cronológico de operaciones contables.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Asiento</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Registrar Asiento Contable</DialogTitle>
                            <DialogDescription>
                                Ingresa los detalles de la operación. Debe estar balanceado.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>Descripción General</Label>
                                    <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ej. Pago de nómina Enero" required />
                                </div>
                            </div>

                            <div className="border rounded-md p-4 bg-slate-50 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="font-semibold">Movimientos</Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Agregar cuenta</Button>
                                </div>

                                {formData.lines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Select value={line.accountId} onValueChange={v => updateLine(idx, 'accountId', v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Cuenta..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts?.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-32">
                                            <Input
                                                type="number"
                                                placeholder="Débito"
                                                value={line.debit || ''}
                                                onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value))}
                                                className={line.debit > 0 ? "bg-green-50" : ""}
                                            />
                                        </div>
                                        <div className="w-32">
                                            <Input
                                                type="number"
                                                placeholder="Crédito"
                                                value={line.credit || ''}
                                                onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value))}
                                                className={line.credit > 0 ? "bg-green-50" : ""}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeLine(idx)}
                                            disabled={formData.lines.length <= 2}
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                ))}

                                <div className="flex justify-end gap-8 pt-2 font-medium">
                                    <div className={totalDebits !== totalCredits ? "text-red-500" : "text-green-600"}>
                                        Débitos: {formatCurrency(totalDebits)}
                                    </div>
                                    <div className={totalDebits !== totalCredits ? "text-red-500" : "text-green-600"}>
                                        Créditos: {formatCurrency(totalCredits)}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending || !isBalanced}>
                                    {createMutation.isPending ? 'Guardando...' : 'Guardar Asiento'}
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
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : entries?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay asientos registrados</TableCell>
                            </TableRow>
                        ) : (
                            entries?.map((entry: any) => {
                                // Calculate total from lines (sum of debits)
                                const total = entry.lines.reduce((s: number, l: any) => s + l.debit, 0)
                                return (
                                    <TableRow key={entry.id}>
                                        <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{entry.description}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {entry.lines.length} movimientos
                                            </div>
                                        </TableCell>
                                        <TableCell>{entry.reference || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={entry.status === 'POSTED' ? 'default' : 'secondary'}>
                                                {entry.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {formatCurrency(total)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
