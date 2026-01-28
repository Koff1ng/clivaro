'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, TrendingUp, DollarSign, Package, Warehouse, Users, Banknote, Truck } from 'lucide-react'

export interface ReportsMenuDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const reportCategories = [
    {
        id: 'sales',
        title: 'Reportes de Ventas',
        icon: TrendingUp,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 hover:bg-blue-100',
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
        color: 'text-green-600',
        bgColor: 'bg-green-50 hover:bg-green-100',
        reports: [
            { id: 'cost-analysis', name: 'Análisis de Costos', description: 'Comparación de costos vs precios de venta' },
            { id: 'profit-margins', name: 'Márgenes de Ganancia', description: 'Rentabilidad por producto y categoría' },
            { id: 'low-margin-products', name: 'Productos con Bajo Margen', description: 'Productos que requieren ajuste de precio' },
        ]
    },
    {
        id: 'products',
        title: 'Reportes de Productos',
        icon: Package,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 hover:bg-purple-100',
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
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 hover:bg-orange-100',
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
        bgColor: 'bg-pink-50 hover:bg-pink-100',
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
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 hover:bg-emerald-100',
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
        bgColor: 'bg-indigo-50 hover:bg-indigo-100',
        reports: [
            { id: 'purchases-by-supplier', name: 'Compras por Proveedor', description: 'Historial de compras y gasto total' },
            { id: 'accounts-payable', name: 'Cuentas por Pagar', description: 'Pagos pendientes a proveedores' },
            { id: 'supplier-performance', name: 'Rendimiento de Proveedores', description: 'Evaluación de cumplimiento y calidad' },
        ]
    }
]

export function ReportsMenuDialog({ open, onOpenChange }: ReportsMenuDialogProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const handleReportClick = (reportId: string) => {
        console.log('Opening report:', reportId)
        // TODO: Implement report navigation/opening logic
        alert(`Abriendo reporte: ${reportId}\n(Próximamente disponible)`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Reportes del Sistema
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {reportCategories.map((category) => {
                        const Icon = category.icon
                        return (
                            <div
                                key={category.id}
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedCategory === category.id
                                        ? 'border-primary shadow-md'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                                        <Icon className={`h-5 w-5 ${category.color}`} />
                                    </div>
                                    <h3 className="font-semibold text-sm">{category.title}</h3>
                                </div>

                                {selectedCategory === category.id && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {category.reports.map((report) => (
                                            <Button
                                                key={report.id}
                                                variant="ghost"
                                                className="w-full justify-start text-left h-auto py-2 px-3"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleReportClick(report.id)
                                                }}
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{report.name}</div>
                                                    <div className="text-xs text-muted-foreground">{report.description}</div>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-blue-50 rounded-lg">
                    💡 <strong>Tip:</strong> Haz clic en una categoría para ver los reportes disponibles
                </div>
            </DialogContent>
        </Dialog>
    )
}
