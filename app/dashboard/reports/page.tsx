'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useEffect } from 'react'
import {
    TrendingUp,
    DollarSign,
    Package,
    Warehouse,
    Users,
    Banknote,
    Truck,
    FileText,
    ArrowRight,
    BarChart3,
    PieChart,
    ArrowDownRight,
    Search
} from 'lucide-react'

const reportCategories = [
    {
        id: 'sales',
        title: 'Ventas y Comercial',
        icon: TrendingUp,
        description: 'Análisis de ventas, rendimiento y tendencias del mercado',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-100',
        reports: [
            {
                id: 'sales-by-period',
                name: 'Ventas por Período',
                description: 'Resumen de ventas diarias, semanales o mensuales con comparativa de IVA',
                icon: BarChart3
            },
            {
                id: 'top-products',
                name: 'Productos Más Vendidos',
                description: 'Ranking de productos por volumen de ventas e ingresos totales',
                icon: Package
            },
        ],
    },
    {
        id: 'inventory',
        title: 'Inventario y Almacén',
        icon: Warehouse,
        description: 'Control de stock actual, valorización y movimientos de mercancía',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-100',
        reports: [
            {
                id: 'current-stock',
                name: 'Stock por Almacén',
                description: 'Estado actual del inventario filtrado por bodega o sucursal',
                icon: Warehouse
            },
            {
                id: 'low-stock',
                name: 'Alertas de Stock Bajo',
                description: 'Productos que han alcanzado su nivel crítico de reabastecimiento',
                icon: ArrowDownRight
            },
        ],
    },
    {
        id: 'financial',
        title: 'Finanzas y Rentabilidad',
        icon: DollarSign,
        description: 'Márgenes de ganancia, flujo de caja y análisis de costos operativos',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-100',
        reports: [
            {
                id: 'profit-margins',
                name: 'Márgenes de Ganancia',
                description: 'Análisis detallado de rentabilidad por producto y categoría',
                icon: PieChart
            },
            {
                id: 'cash-flow',
                name: 'Flujo de Caja',
                description: 'Consolidado de ingresos, egresos y movimientos de caja',
                icon: Banknote
            },
        ],
    },
]

export default function ReportsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    if (status === 'loading') {
        return (
            <MainLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </MainLayout>
        )
    }

    const userPermissions = (session?.user as any)?.permissions || []

    if (!userPermissions.includes('view_reports')) {
        return (
            <MainLayout>
                <div className="p-8 text-center text-destructive">
                    No tienes permiso para ver esta sección.
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-8 pb-12">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Centro de Reportes</h1>
                    <p className="text-muted-foreground text-lg">
                        Análisis inteligente y seguimiento en tiempo real de tu ferretería.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {reportCategories.map((category) => {
                        const Icon = category.icon
                        return (
                            <div key={category.id} className="flex flex-col space-y-4">
                                <div className="flex items-center gap-3 px-1">
                                    <div className={`p-2.5 rounded-xl ${category.bgColor} ${category.color}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold tracking-tight">{category.title}</h2>
                                </div>

                                <div className="grid gap-4">
                                    {category.reports.map((report) => (
                                        <Link
                                            key={report.id}
                                            href={`/dashboard/reports/${report.id}`}
                                            className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/50"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-4">
                                                    <div className="mt-1 rounded-lg bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                        <report.icon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold leading-none mb-2 group-hover:text-primary transition-colors">
                                                            {report.name}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {report.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer Info */}
                <div className="rounded-3xl bg-slate-900 p-8 text-white">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left">
                            <h3 className="text-xl font-bold">¿Necesitas un reporte personalizado?</h3>
                            <p className="text-slate-400">Nuestro equipo puede ayudarte a generar análisis específicos para tu negocio.</p>
                        </div>
                        <Link
                            href="mailto:soporte@ferreteria.com"
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-8 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
                        >
                            Contactar Soporte
                        </Link>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
