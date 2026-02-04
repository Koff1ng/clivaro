'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function ReportsPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Reportes Contables" description="Balance de Prueba, Estado de Resultados, Balance General." />
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Modulo de reportes disponible próximamente.
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
