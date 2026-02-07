import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FileText, Book, TrendingUp, Users, ClipboardList } from 'lucide-react'
import Link from 'next/link'

export default function ReportsPage() {
    const reportGroups = [
        {
            title: 'Libros Oficiales',
            description: 'Registros cronológicos y acumulativos obligatorios.',
            icon: <Book className="h-6 w-6 text-blue-600" />,
            reports: [
                { name: 'Libro Diario', path: '/accounting/reports/journal', description: 'Movimientos detallados por día.' },
                { name: 'Libro Mayor y Balance', path: '/accounting/reports/ledger', description: 'Saldos acumulados por cuenta.' }
            ]
        },
        {
            title: 'Estados Financieros',
            description: 'Informes de situación y desempeño económico.',
            icon: <TrendingUp className="h-6 w-6 text-green-600" />,
            reports: [
                { name: 'Balance General', path: '/accounting/reports/balance-sheet', description: 'Activos, Pasivos y Patrimonio.' },
                { name: 'Estado de Resultados', path: '/accounting/reports/profit-loss', description: 'Ingresos, Gastos y Utilidad.' }
            ]
        },
        {
            title: 'Reportes Auxiliares',
            description: 'Detalle granular para auditoría y control.',
            icon: <ClipboardList className="h-6 w-6 text-purple-600" />,
            reports: [
                { name: 'Auxiliar por Cuenta', path: '/accounting/reports/aux-account', description: 'Movimientos detallados de una cuenta.' },
                { name: 'Auxiliar por Tercero', path: '/accounting/reports/aux-third-party', description: 'Movimientos asociados a un NIT.' }
            ]
        }
    ]

    return (
        <MainLayout>
            <div className="space-y-8">
                <PageHeader
                    title="Centro de Reportes Contables"
                    description="Informes financieros alineados con estándares colombianos (PUC/NIIF)."
                />

                <div className="grid gap-6 md:grid-cols-3">
                    {reportGroups.map((group, idx) => (
                        <Card key={idx} className="flex flex-col h-full border-t-4 border-t-primary/20">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-slate-100 rounded-lg">
                                        {group.icon}
                                    </div>
                                    <CardTitle className="text-xl font-bold">{group.title}</CardTitle>
                                </div>
                                <CardDescription>{group.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-4">
                                {group.reports.map((report, rIdx) => (
                                    <Link key={rIdx} href={report.path} className="block group">
                                        <div className="p-3 rounded-md hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                                            <div className="font-medium text-slate-800 flex items-center justify-between">
                                                {report.name}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-primary text-xs font-bold">VER &rarr;</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">{report.description}</div>
                                        </div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-amber-100 rounded-full">
                            <FileText className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="text-sm text-amber-800">
                            <span className="font-bold">Información de Exógena:</span> Los reportes auxiliares ahora incluyen la discriminación por tercero requerida para los formatos de la DIAN.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
