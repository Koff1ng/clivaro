'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Loader2, ArrowLeft, CheckCircle, Plus, Trash2, Edit, CreditCard } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export default function PayrollDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<any>(null)

    // Novedades (Add item) Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedPayslip, setSelectedPayslip] = useState<any>(null)
    const [savingItem, setSavingItem] = useState(false)
    const [newItem, setNewItem] = useState({
        type: 'EARNING',
        concept: '',
        amount: ''
    })

    // Period Status Edit State
    const [updatingStatus, setUpdatingStatus] = useState(false)

    const fetchPeriod = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/hr/payroll/${params.id}`)
            if (res.ok) {
                const data = await res.json()
                setPeriod(data)
            } else {
                toast('Error al cargar la nómina', 'error')
                router.push('/hr/payroll')
            }
        } catch (error) {
            console.error(error)
            toast('Error de conexión', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPeriod()
    }, [params.id])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount || 0)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const handleUpdateStatus = async (newStatus: string) => {
        if (!confirm(`¿Estás seguro de cambiar el estado a ${newStatus}?`)) return

        setUpdatingStatus(true)
        try {
            const res = await fetch(`/api/hr/payroll/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                toast(`Nómina marcada como ${newStatus}`, 'success')
                fetchPeriod()
            } else {
                toast('Error al actualizar estado', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleOpenAddItem = (payslip: any) => {
        setSelectedPayslip(payslip)
        setNewItem({ type: 'EARNING', concept: '', amount: '' })
        setIsModalOpen(true)
    }

    const handleSaveItem = async () => {
        if (!newItem.concept || !newItem.amount) {
            return toast('Por favor, completa el concepto y el monto', 'error')
        }

        setSavingItem(true)
        try {
            const res = await fetch(`/api/hr/payslips/${selectedPayslip.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ADD_ITEM',
                    itemData: {
                        ...newItem,
                        amount: parseFloat(newItem.amount)
                    }
                })
            })

            if (res.ok) {
                toast('Novedad añadida exitosamente', 'success')
                setIsModalOpen(false)
                fetchPeriod() // refetch to get updated totals and items
            } else {
                toast('Error al añadir novedad', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setSavingItem(false)
        }
    }

    const handleRemoveItem = async (payslipId: string, itemId: string) => {
        if (!confirm('¿Eliminar esta novedad?')) return

        try {
            const res = await fetch(`/api/hr/payslips/${payslipId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'REMOVE_ITEM',
                    itemData: { id: itemId }
                })
            })

            if (res.ok) {
                toast('Novedad eliminada', 'success')
                fetchPeriod()
            } else {
                toast('Error al eliminar novedad', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        }
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </MainLayout>
        )
    }

    if (!period) return null

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title={`Nómina: ${period.periodName}`}
                    description={`${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}
                    breadcrumbs={[
                        { label: 'Nómina', href: '/hr/payroll' },
                        { label: 'Procesamiento' }
                    ]}
                    actions={
                        <div className="flex space-x-2">
                            <Button variant="outline" onClick={() => router.push('/hr/payroll')}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                            {period.status === 'DRAFT' && (
                                <Button onClick={() => handleUpdateStatus('APPROVED')} disabled={updatingStatus}>
                                    {updatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <CheckCircle className="mr-2 h-4 w-4" /> Aprobar Nómina
                                </Button>
                            )}
                            {period.status === 'APPROVED' && (
                                <Button
                                    variant="default"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleUpdateStatus('PAID')}
                                    disabled={updatingStatus}
                                >
                                    {updatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <CreditCard className="mr-2 h-4 w-4" /> Pagar Total Nómina
                                </Button>
                            )}
                        </div>
                    }
                />

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Estado</CardDescription>
                            <CardTitle className="text-xl">
                                {period.status === 'DRAFT' && <span className="text-amber-600">Borrador</span>}
                                {period.status === 'APPROVED' && <span className="text-blue-600">Aprobada</span>}
                                {period.status === 'PAID' && <span className="text-emerald-600">Pagada</span>}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Devengos</CardDescription>
                            <CardTitle className="text-xl text-slate-800">{formatCurrency(period.totalEarnings)}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Deducciones</CardDescription>
                            <CardTitle className="text-xl text-red-600">{formatCurrency(period.totalDeductions)}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-100">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-emerald-800">Neto a Pagar</CardDescription>
                            <CardTitle className="text-2xl text-emerald-700">{formatCurrency(period.netPay)}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <div className="bg-white rounded-lg border shadow-sm p-4">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2">Recibos de Empleados</h3>

                    <div className="space-y-6">
                        {period.payslips?.map((payslip: any) => (
                            <div key={payslip.id} className="border rounded-md overflow-hidden">
                                <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b text-sm">
                                    <div className="font-semibold text-slate-700">
                                        {payslip.employee.firstName} {payslip.employee.lastName} -
                                        <span className="text-muted-foreground ml-1">{payslip.employee.documentNumber}</span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-emerald-700 font-bold">Neto: {formatCurrency(payslip.netPay)}</span>
                                        {period.status === 'DRAFT' && (
                                            <Button variant="outline" size="sm" onClick={() => handleOpenAddItem(payslip)}>
                                                <Plus className="mr-1 h-3 w-3" /> Novedad
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-0">
                                    <Table>
                                        <TableHeader className="bg-white">
                                            <TableRow>
                                                <TableHead className="w-[100px]">Tipo</TableHead>
                                                <TableHead>Concepto</TableHead>
                                                <TableHead className="w-[150px] text-right">Devengo (+)</TableHead>
                                                <TableHead className="w-[150px] text-right">Deducción (-)</TableHead>
                                                {period.status === 'DRAFT' && <TableHead className="w-[50px]"></TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payslip.items?.map((item: any) => (
                                                <TableRow key={item.id} className="text-sm border-b-0 h-10">
                                                    <TableCell className="py-1 line-clamp-1">
                                                        {item.type === 'EARNING' ?
                                                            <span className="text-green-600 text-xs font-semibold">D</span> :
                                                            <span className="text-red-500 text-xs font-semibold">DED</span>
                                                        }
                                                    </TableCell>
                                                    <TableCell className="py-1">
                                                        {item.concept}
                                                        {item.isAutomatic && <span className="ml-2 text-[10px] bg-slate-100 px-1 rounded text-slate-500">Auto</span>}
                                                    </TableCell>
                                                    <TableCell className="py-1 text-right text-slate-700">
                                                        {item.type === 'EARNING' ? formatCurrency(item.amount) : ''}
                                                    </TableCell>
                                                    <TableCell className="py-1 text-right text-red-600">
                                                        {item.type === 'DEDUCTION' ? formatCurrency(item.amount) : ''}
                                                    </TableCell>
                                                    {period.status === 'DRAFT' && (
                                                        <TableCell className="py-1 text-right">
                                                            {!item.isAutomatic && (
                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-500" onClick={() => handleRemoveItem(payslip.id, item.id)}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                            <TableRow className="bg-slate-50 font-medium">
                                                <TableCell colSpan={2} className="text-right py-2">Totales Individuales</TableCell>
                                                <TableCell className="text-right py-2 text-slate-800">{formatCurrency(payslip.totalEarnings)}</TableCell>
                                                <TableCell className="text-right py-2 text-red-600">{formatCurrency(payslip.totalDeductions)}</TableCell>
                                                {period.status === 'DRAFT' && <TableCell></TableCell>}
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ))}

                        {(!period.payslips || period.payslips.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                                Ningún recibo generado para este período.
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Novedad Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Añadir Novedad (Devengo/Deducción)</DialogTitle>
                            <p className="text-sm text-muted-foreground pt-1">
                                Para: {selectedPayslip?.employee?.firstName} {selectedPayslip?.employee?.lastName}
                            </p>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Tipo de Novedad</Label>
                                <Select
                                    value={newItem.type}
                                    onValueChange={(val) => setNewItem({ ...newItem, type: val })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EARNING">Devengo (Suma)</SelectItem>
                                        <SelectItem value="DEDUCTION">Deducción (Resta)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Concepto</Label>
                                <Input
                                    value={newItem.concept}
                                    onChange={(e) => setNewItem({ ...newItem, concept: e.target.value })}
                                    placeholder={newItem.type === 'EARNING' ? "Ej: Horas Extras, Auxilio Transporte, Bono..." : "Ej: Salud, Pensión, Préstamo..."}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Monto (COP)</Label>
                                <Input
                                    type="number"
                                    value={newItem.amount}
                                    onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                                    placeholder="Ej: 50000"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveItem} disabled={savingItem}>
                                {savingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Añadir a Nómina
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </MainLayout>
    )
}
