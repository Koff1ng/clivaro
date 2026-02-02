'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FolderTree } from 'lucide-react'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
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

export default function ChartOfAccountsPage() {
    const [isOpen, setIsOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: 'ASSET',
        parentAccountId: 'none'
    })

    const { data: accounts, isLoading } = useQuery({
        queryKey: ['accounting-accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounting/accounts')
            if (!res.ok) throw new Error('Error fetching accounts')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = { ...data, parentAccountId: data.parentAccountId === 'none' ? null : data.parentAccountId }
            const res = await fetch('/api/accounting/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to create account')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
            setIsOpen(false)
            setFormData({ code: '', name: '', type: 'ASSET', parentAccountId: 'none' })
            toast('Cuenta creada correctamente', 'success')
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
                    <h1 className="text-3xl font-bold tracking-tight">Plan de Cuentas</h1>
                    <p className="text-muted-foreground">Gestiona la estructura contable de la empresa.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nueva Cuenta</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Cuenta Contable</DialogTitle>
                            <DialogDescription>
                                Define el código y nombre de la nueva cuenta.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="code">Código</Label>
                                    <Input
                                        id="code"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="Ej. 1105"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="type">Tipo</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={v => setFormData({ ...formData, type: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ASSET">Activo</SelectItem>
                                            <SelectItem value="LIABILITY">Pasivo</SelectItem>
                                            <SelectItem value="EQUITY">Patrimonio</SelectItem>
                                            <SelectItem value="INCOME">Ingresos</SelectItem>
                                            <SelectItem value="EXPENSE">Gastos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Caja General"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="parent">Cuenta Padre (Opcional)</Label>
                                <Select
                                    value={formData.parentAccountId}
                                    onValueChange={v => setFormData({ ...formData, parentAccountId: v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">-- Ninguna --</SelectItem>
                                        {accounts?.map((acc: any) => (
                                            <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Guardando...' : 'Guardar'}
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
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Padre</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8">Caragndo...</TableCell>
                            </TableRow>
                        ) : accounts?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay cuentas registradas</TableCell>
                            </TableRow>
                        ) : (
                            accounts?.map((account: any) => (
                                <TableRow key={account.id}>
                                    <TableCell className="font-medium font-mono">{account.code}</TableCell>
                                    <TableCell>{account.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{account.type}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {account.parentAccount ? `${account.parentAccount.code} - ${account.parentAccount.name}` : '-'}
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
