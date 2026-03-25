'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, TrendingUp, DollarSign, Package, Warehouse, Users, Banknote, Truck, Lock } from 'lucide-react'

export interface ReportsMenuDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

// Only these reports have actual implementations
const IMPLEMENTED_REPORTS = new Set([
    'sales-by-period',
    'top-products',
    'current-stock',
    'inventory-valuation',
    'low-stock',
    'profit-margins',
    'cash-flow',
])

const reportCategories = [
    {
        id: 'sales',
        title: 'Reportes de Ventas',
        icon: TrendingUp,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30',
        reports: [
            { id: 'sales-by-period', name: 'Ventas por Período', description: 'Resumen de ventas diarias, semanales o mensuales' },
            { id: 'sales-by-seller', name: 'Ventas por Vendedor', description: 'Rendimiento individual de cada vendedor' },
            { id: 'sales-by-category', name: 'Ventas por Categoría', description: 'Análisis de ventas por categoría de producto' },
        ]
    },
    {
        id: 'costs',
        title: 'Reportes de Costos',
        icon: DollarSign,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30',
        reports: [
            { id: 'profit-margins', name: 'Márgenes de Ganancia', description: 'Rentabilidad por producto y categoría' },
            { id: 'cost-analysis', name: 'Análisis de Costos', description: 'Comparación de costos vs precios de venta' },
            { id: 'low-margin-products', name: 'Productos con Bajo Margen', description: 'Productos que requieren ajuste de precio' },
        ]
    },
    {
        id: 'products',
        title: 'Reportes de Productos',
        icon: Package,
        color: 'text-violet-600',
        bgColor: 'bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:hover:bg-violet-900/30',
        reports: [
            { id: 'top-products', name: 'Productos Más Vendidos', description: 'Top 10, 20 o 50 productos por ventas' },
            { id: 'slow-moving', name: 'Productos de Baja Rotación', description: 'Productos con pocas o ninguna venta' },
            { id: 'abc-analysis', name: 'Análisis ABC', description: 'Clasificación de inventario por importancia' },
        ]
    },
    {
        id: 'inventory',
        title: 'Reportes de Inventario',
        icon: Warehouse,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30',
        reports: [
            { id: 'current-stock', name: 'Stock Actual', description: 'Inventario actual por almacén' },
            { id: 'low-stock', name: 'Bajo Stock', description: 'Productos que necesitan reabastecimiento' },
            { id: 'inventory-valuation', name: 'Valorización de Inventario', description: 'Valor total del inventario actual' },
            { id: 'stock-movements', name: 'Movimientos de Inventario', description: 'Historial de entradas y salidas' },
        ]
    },
    {
        id: 'customers',
        title: 'Reportes de Clientes',
        icon: Users,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20 dark:hover:bg-pink-900/30',
        reports: [
            { id: 'top-customers', name: 'Mejores Clientes', description: 'Clientes con más compras y facturación' },
            { id: 'accounts-receivable', name: 'Cuentas por Cobrar', description: 'Estado de cartera y pagos pendientes' },
            { id: 'inactive-customers', name: 'Clientes Inactivos', description: 'Clientes sin compras recientes' },
        ]
    },
    {
        id: 'cash',
        title: 'Caja y Finanzas',
        icon: Banknote,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/30',
        reports: [
            { id: 'cash-flow', name: 'Flujo de Caja', description: 'Ingresos y egresos diarios' },
            { id: 'shift-summary', name: 'Resumen de Turnos', description: 'Consolidado de turnos de caja' },
            { id: 'payment-methods', name: 'Formas de Pago', description: 'Distribución por método de pago' },
        ]
    },
    {
        id: 'suppliers',
        title: 'Reportes de Proveedores',
        icon: Truck,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30',
        reports: [
            { id: 'purchases-by-supplier', name: 'Compras por Proveedor', description: 'Historial de compras y gasto total' },
            { id: 'accounts-payable', name: 'Cuentas por Pagar', description: 'Pagos pendientes a proveedores' },
            { id: 'supplier-performance', name: 'Rendimiento de Proveedores', description: 'Evaluación de cumplimiento y calidad' },
        ]
    }
]

export function ReportsMenuDialog({ open, onOpenChange }: ReportsMenuDialogProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const router = useRouter()

    const handleReportClick = (reportId: string) => {
        if (!IMPLEMENTED_REPORTS.has(reportId)) return
        router.push(`/dashboard/reports/${reportId}`)
        onOpenChange(false)
    }

    const implementedCount = reportCategories.reduce(
        (sum, cat) => sum + cat.reports.filter(r => IMPLEMENTED_REPORTS.has(r.id)).length, 0
    )
    const totalCount = reportCategories.reduce((sum, cat) => sum + cat.reports.length, 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Reportes del Sistema
                        <Badge variant="secondary" className="text-[10px] font-bold ml-2">
                            {implementedCount}/{totalCount} disponibles
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {reportCategories.map((category) => {
                        const Icon = category.icon
                        const availableCount = category.reports.filter(r => IMPLEMENTED_REPORTS.has(r.id)).length
                        return (
                            <div
                                key={category.id}
                                className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${selectedCategory === category.id
                                    ? 'border-primary shadow-md scale-[1.02]'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                                onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2.5 rounded-xl ${category.bgColor}`}>
                                        <Icon className={`h-5 w-5 ${category.color}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm">{category.title}</h3>
                                        <span className="text-[10px] text-slate-400">{availableCount}/{category.reports.length} activos</span>
                                    </div>
                                </div>

                                {selectedCategory === category.id && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {category.reports.map((report) => {
                                            const isAvailable = IMPLEMENTED_REPORTS.has(report.id)
                                            return (
                                                <Button
                                                    key={report.id}
                                                    variant="ghost"
                                                    className={`w-full justify-start text-left h-auto py-2.5 px-3 rounded-lg ${
                                                        !isAvailable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleReportClick(report.id)
                                                    }}
                                                    disabled={!isAvailable}
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm">{report.name}</span>
                                                            {!isAvailable && (
                                                                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 font-bold text-slate-400 border-slate-300">
                                                                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                                                                    Próximamente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5">{report.description}</div>
                                                    </div>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    💡 <strong>Tip:</strong> Haz clic en una categoría para ver los reportes. Los reportes marcados como "Próximamente" estarán disponibles en futuras actualizaciones.
                </div>
            </DialogContent>
        </Dialog>
    )
}
