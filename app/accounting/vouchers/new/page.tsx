'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Plus, Save } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { AccountSelect } from '@/components/accounting/account-select'
import { ThirdPartySelect } from '@/components/accounting/third-party-select'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export default function NewVoucherPage() {
    const { toast } = useToast()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])

    // Header
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [type, setType] = useState('JOURNAL')
    const [description, setDescription] = useState('')
    const [reference, setReference] = useState('')

    // Lines
    const [lines, setLines] = useState<any[]>([
        { id: 1, accountId: '', description: '', debit: 0, credit: 0, thirdPartyId: '', thirdPartyName: '', requiresThirdParty: false }
    ])

    useEffect(() => {
        fetch('/api/accounting/accounts')
            .then(res => res.json())
            .then(data => setAccounts(data))
    }, [])

    const addLine = () => {
        setLines([...lines, { id: Date.now(), accountId: '', description: '', debit: 0, credit: 0, thirdPartyId: '', thirdPartyName: '', requiresThirdParty: false }])
    }

    const removeLine = (id: number) => {
        if (lines.length === 1) return
        setLines(lines.filter(l => l.id !== id))
    }

    const updateLine = (id: number, field: string, value: any) => {
        setLines(lines.map(l => {
            if (l.id === id) {
                const newLine = { ...l, [field]: value }
                // Special case for account selection: cache the requiresThirdParty flag
                if (field === 'accountId') {
                    const account = accounts.find(a => a.id === value)
                    if (account) {
                        newLine.requiresThirdParty = account.requiresThirdParty
                    }
                }
                return newLine
            }
            return l
        }))
    }

    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
    const difference = totalDebit - totalCredit

    const handleSave = async () => {
        if (!description) return toast('Descripción requerida', 'error')
        if (Math.abs(difference) > 0.01) return toast('El comprobante no está balanceado', 'error')

        // Validate lines
        for (const l of lines) {
            if (!l.accountId) return toast('Selecciona cuenta en todas las líneas', 'error')
            if (l.requiresThirdParty && !l.thirdPartyId) {
                const account = accounts.find(a => a.id === l.accountId)
                return toast(`La cuenta ${account?.code} requiere un tercero`, 'error')
            }
        }

        setLoading(true)
        try {
            const res = await fetch('/api/accounting/vouchers', {
                method: 'POST',
                body: JSON.stringify({
                    date,
                    type,
                    description,
                    reference,
                    lines: lines.map(l => ({
                        accountId: l.accountId,
                        description: l.description,
                        debit: Number(l.debit),
                        credit: Number(l.credit),
                        accountingThirdPartyId: l.thirdPartyId, // Use the ID
                        thirdPartyName: l.thirdPartyName // Keep name for legacy/reference
                    }))
                }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al guardar')
            }

            toast('Comprobante guardado', 'success')
            router.push('/accounting/vouchers')
        } catch (e: any) {
            toast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Nuevo Comprobante" description="Crear registro contable manual." />

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                    >
                                        <option value="JOURNAL">Diario</option>
                                        <option value="INCOME">Ingreso</option>
                                        <option value="EXPENSE">Egreso</option>
                                        <option value="ADJUSTMENT">Ajuste</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Concepto del movimiento..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Referencia (Opcional)</Label>
                                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Factura #..." />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-50">
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium">Resumen</span>
                                <span className={Math.abs(difference) < 0.01 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                    {Math.abs(difference) < 0.01 ? "Balanceado" : "Descuadrado"}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Total Débito:</span>
                                <span className="font-mono">{formatCurrency(totalDebit)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Total Crédito:</span>
                                <span className="font-mono">{formatCurrency(totalCredit)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t font-semibold">
                                <span>Diferencia:</span>
                                <span className="font-mono">{formatCurrency(difference)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Cuenta</TableHead>
                                    <TableHead>Tercero {lines.some(l => l.requiresThirdParty) && <span className="text-red-500">*</span>}</TableHead>
                                    <TableHead className="w-[150px]">Débito</TableHead>
                                    <TableHead className="w-[150px]">Crédito</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((row, idx) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <AccountSelect
                                                accounts={accounts}
                                                value={row.accountId}
                                                onChange={val => updateLine(row.id, 'accountId', val)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ThirdPartySelect
                                                value={row.thirdPartyId}
                                                onChange={(id, name) => {
                                                    updateLine(row.id, 'thirdPartyId', id)
                                                    updateLine(row.id, 'thirdPartyName', name)
                                                }}
                                                disabled={!row.accountId}
                                            />
                                            {row.requiresThirdParty && !row.thirdPartyId && (
                                                <span className="text-[10px] text-red-500 font-medium">Requerido</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={row.debit}
                                                onChange={e => updateLine(row.id, 'debit', e.target.value)}
                                                className="h-9 text-right"
                                                onFocus={e => e.target.select()}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={row.credit}
                                                onChange={e => updateLine(row.id, 'credit', e.target.value)}
                                                className="h-9 text-right"
                                                onFocus={e => e.target.select()}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => removeLine(row.id)} tabIndex={-1}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="p-4 bg-slate-50 border-t flex justify-between">
                            <Button variant="outline" onClick={addLine}>
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar Línea
                            </Button>
                            <Button onClick={handleSave} disabled={loading || Math.abs(difference) > 0.01}>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Borrador
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
