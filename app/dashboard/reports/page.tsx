import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
    TrendingUp,
    DollarSign,
    Package,
    Warehouse,
    Users,
    Banknote,
    Truck,
    FileText,
} from 'lucide-react'

const reportCategories = [
    {
        id: 'sales',
        title: 'Reportes de Ventas',
        icon: TrendingUp,
        description: 'Análisis de ventas, rendimiento y tendencias',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        reports: [
            {
                id: 'sales-by-period',
                name: 'Ventas por Período',
                description: 'Resumen de ventas diarias, semanales o mensuales',
            },
            {
                id: 'top-products',
                name: 'Productos Más Vendidos',
                description: 'Top productos por volumen e ingresos',
            },
        ],
    },
    {
        id: 'inventory',
        title: 'Reportes de Inventario',
        icon: Warehouse,
        description: 'Stock actual, valorización y movimientos',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        reports: [
            {
                id: 'current-stock',
                name: 'Stock Actual',
                description: 'Inventario actual por almacén',
            },
            {
                id: 'inventory-valuation',
                name: 'Valorización de Inventario',
                description: 'Valor total del inventario',
            },
        ],
    },
    {
        id: 'financial',
        title: 'Reportes Financieros',
        icon: DollarSign,
        description: 'Costos, márgenes y rentabilidad',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        reports: [
            {
                id: 'profit-margins',
                name: 'Márgenes de Ganancia',
                description: 'Rentabilidad por producto y categoría',
            },
            {
                id: 'cash-flow',
                name: 'Flujo de Caja',
                description: 'Ingresos y egresos diarios',
            },
        ],
    },
]

export default async function ReportsPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    const userPermissions = (session.user as any).permissions || []

    if (!userPermissions.includes('view_reports')) {
        redirect('/login')
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Reportes"
                    description="Accede a todos los reportes y análisis del sistema"
                />

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {reportCategories.map((category) => {
                        const Icon = category.icon
                        return (
                            <Card key={category.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-lg ${category.bgColor}`}>
                                            <Icon className={`h-6 w-6 ${category.color}`} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{category.title}</CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                {category.description}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {category.reports.map((report) => (
                                            <Link
                                                key={report.id}
                                                href={`/dashboard/reports/${report.id}`}
                                                className="block p-3 rounded-lg hover:bg-muted transition-colors"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                    <div>
                                                        <div className="font-medium text-sm">{report.name}</div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {report.description}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </MainLayout>
    )
}
