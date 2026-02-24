'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowDownRight, CalendarCheck, Clock, Calculator, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const ADDON_CARDS = [
    {
        id: 'depreciation',
        title: 'Depreciación de Activos',
        description: 'Calcula y genera el comprobante de depreciación mensual para tus activos fijos (Propiedad, Planta y Equipo).',
        icon: ArrowDownRight,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        actionText: 'Ejecutar Depreciación'
    },
    {
        id: 'closing',
        title: 'Cierre de Ejercicio',
        description: 'Genera el asiento automático de cierre contable, cancelando cuentas de resultado al final del año.',
        icon: CalendarCheck,
        color: 'text-rose-600',
        bgColor: 'bg-rose-100',
        actionText: 'Iniciar Cierre Anual'
    },
    {
        id: 'deferred',
        title: 'Amortización de Diferidos',
        description: 'Contabiliza sistemáticamente las cuotas de gastos pagados por anticipado o ingresos diferidos.',
        icon: Clock,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        actionText: 'Amortizar'
    }
]

export default function AddonsPage() {
    const { toast } = useToast()
    const router = useRouter()
    const [selectedAddon, setSelectedAddon] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
    const [year, setYear] = useState(new Date().getFullYear().toString())

    const handleExecute = async () => {
        if (!selectedAddon) return
        setLoading(true)
        try {
            const res = await fetch('/api/accounting/addons/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: selectedAddon,
                    period,
                    year
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al generar el comprobante')
            }

            const data = await res.json()
            toast('Comprobante borrador generado con éxito', 'success')
            setSelectedAddon(null)
            router.push(`/accounting/vouchers/${data.id}`)
        } catch (e: any) {
            toast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainLayout>
            <div className="space-y-8">
                <PageHeader
                    title="Complementos Contables"
                    description="Herramientas automáticas para el cálculo y contabilización de procesos financieros complejos."
                />

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {ADDON_CARDS.map(addon => (
                        <Card key={addon.id} className="group hover:border-slate-300 transition-colors cursor-pointer" onClick={() => setSelectedAddon(addon.id)}>
                            <CardHeader>
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", addon.bgColor, addon.color)}>
                                    <addon.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-xl">{addon.title}</CardTitle>
                                <CardDescription className="h-16 line-clamp-3">
                                    {addon.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="ghost" className={cn("w-full justify-between hover:bg-slate-50", addon.color)}>
                                    {addon.actionText}
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                    <div className="space-y-2 max-w-2xl">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Calculator className="h-6 w-6 text-indigo-400" />
                            Automatización Inteligente
                        </h3>
                        <p className="text-slate-300">
                            Los complementos contables generan comprobantes en estado <b>Borrador</b>. Puedes revisarlos, editarlos y validarlos en la sección de Comprobantes antes de contabilizarlos definitivamente. Esto garantiza precisión y control.
                        </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 text-sm bg-white/10 px-4 py-2 rounded-lg font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Validación Previa
                    </div>
                </div>
            </div>

            {/* Modals for Addons */}
            <Dialog open={selectedAddon === 'depreciation'} onOpenChange={(open) => !open && setSelectedAddon(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Depreciación Mensual</DialogTitle>
                        <DialogDescription>
                            Selecciona el periodo para calcular y generar el comprobante borrador de la depreciación de activos fijos de la empresa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="period">Periodo de Cálculo (Mes)</Label>
                            <Input
                                id="period"
                                type="month"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAddon(null)}>Cancelar</Button>
                        <Button onClick={handleExecute} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {loading ? 'Calculando...' : 'Generar Comprobante'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={selectedAddon === 'closing'} onOpenChange={(open) => !open && setSelectedAddon(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Cierre de Ejercicio</DialogTitle>
                        <DialogDescription>
                            Este proceso cancelará los saldos de las cuentas de ingresos y gastos (Clases 4, 5, 6 y 7) contra la cuenta de resultado del ejercicio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="year">Año de Cierre</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar año..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={(new Date().getFullYear() - 1).toString()}>{new Date().getFullYear() - 1}</SelectItem>
                                    <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <strong>Aviso:</strong> Asegúrate de haber revisado todos tus saldos antes de generar el asiento de cierre.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAddon(null)}>Cancelar</Button>
                        <Button onClick={handleExecute} disabled={loading} className="bg-rose-600 hover:bg-rose-700">
                            {loading ? 'Procesando...' : 'Realizar Cierre'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={selectedAddon === 'deferred'} onOpenChange={(open) => !open && setSelectedAddon(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Amortización de Diferidos</DialogTitle>
                        <DialogDescription>
                            Genera la cuota de amortización correspondiente al periodo seleccionado para cargos y créditos diferidos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="period-def">Periodo de Amortización</Label>
                            <Input
                                id="period-def"
                                type="month"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAddon(null)}>Cancelar</Button>
                        <Button onClick={handleExecute} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading ? 'Generando...' : 'Generar Comprobante'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    )
}
