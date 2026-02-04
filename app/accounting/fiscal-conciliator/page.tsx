'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function FiscalConciliatorPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Conciliador Fiscal" description="Comparativo Contable vs Fiscal." />
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Módulo de Conciliación Fiscal disponible próximamente.
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
