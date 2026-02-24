'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Loader2, Plus, Calendar, FileText, CheckCircle, ArrowRight } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function PayrollDashboard() {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [periods, setPeriods] = useState<any[]>([])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [newPeriodData, setNewPeriodData] = useState({
        periodName: '',
        startDate: '',
        endDate: '',
    })

    const fetchPeriods = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/hr/payroll')
            if (res.ok) {
                const data = await res.json()
                setPeriods(data)
            } else {
                toast('Error al cargar períodos', 'error')
            }
        } catch (error) {
            console.error(error)
            toast('Error de conexión', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPeriods()
    }, [])

    const handleGeneratePayroll = async () => {
        if (!newPeriodData.periodName || !newPeriodData.startDate || !newPeriodData.endDate) {
            return toast('Por favor, completa todos los campos', 'error')
        }
        setGenerating(true)
        try {
            const res = await fetch('/api/hr/payroll', {
                method: 'POST',
                body: JSON.stringify(newPeriodData),
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                toast('Nómina generada exitosamente', 'success')
                setIsModalOpen(false)
                fetchPeriods()
            } else {
                toast(data.error || 'Error al generar nómina', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setGenerating(false)
        }
    }

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

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Nómina"
                    description="Gestiona los ciclos de pago y los recibos de nómina de los empleados."
                    actions={
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Generar Nómina
                        </Button>
                    }
                />

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Períodos Generados
                            </CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{periods.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Nóminas Pagadas
                            </CardTitle>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {periods.filter(p => p.status === 'PAID').length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Borradores Pendientes
                            </CardTitle>
                            <FileText className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {periods.filter(p => p.status === 'DRAFT').length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden mt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Período</TableHead>
                                <TableHead>Fechas</TableHead>
                                <TableHead className="text-center">Recibos</TableHead>
                                <TableHead className="text-right">Total Devengos</TableHead>
                                <TableHead className="text-right">Total Deducciones</TableHead>
                                <TableHead className="text-right">Neto a Pagar</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : periods.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                        No has generado ningún período de nómina.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                periods.map((period) => (
                                    <TableRow key={period.id}>
                                        <TableCell className="font-medium text-blue-600">
                                            {period.periodName}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {formatDate(period.startDate)} - {formatDate(period.endDate)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="inline-flex items-center justify-center bg-slate-100 rounded-full h-6 w-6 text-xs font-semibold">
                                                {period._count?.payslips || 0}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(period.totalEarnings)}
                                        </TableCell>
                                        <TableCell className="text-right text-red-600">
                                            {formatCurrency(period.totalDeductions)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-emerald-700">
                                            {formatCurrency(period.netPay)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {period.status === 'PAID' && (
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">PAGADA</span>
                                            )}
                                            {period.status === 'DRAFT' && (
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">BORRADOR</span>
                                            )}
                                            {period.status === 'APPROVED' && (
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">APROBADA</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/hr/payroll/${period.id}`)}>
                                                Ver Detalles <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Generate Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Generar Nuevo Período de Nómina</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <p className="text-sm text-muted-foreground pb-2">
                                Esto creará un borrador de nómina y los recibos base para todos los empleados activos.
                            </p>
                            <div className="space-y-2">
                                <Label>Nombre del Período *</Label>
                                <Input
                                    value={newPeriodData.periodName}
                                    onChange={(e) => setNewPeriodData({ ...newPeriodData, periodName: e.target.value })}
                                    placeholder="Ej: Febrero 2026 - Primera Quincena"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha Inicio *</Label>
                                    <Input
                                        type="date"
                                        value={newPeriodData.startDate}
                                        onChange={(e) => setNewPeriodData({ ...newPeriodData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Fin *</Label>
                                    <Input
                                        type="date"
                                        value={newPeriodData.endDate}
                                        onChange={(e) => setNewPeriodData({ ...newPeriodData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleGeneratePayroll} disabled={generating || !newPeriodData.periodName || !newPeriodData.startDate || !newPeriodData.endDate}>
                                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generar Recibos
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    )
}
