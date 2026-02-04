'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function AddonsPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Complementos Contables" description="Depreciación, Cierre de Año, Diferidos." />
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Módulo de Complementos disponible próximamente.
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
