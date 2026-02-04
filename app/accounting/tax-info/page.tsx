'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function TaxInfoPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Información Exógena" description="Generación de formatos para la DIAN." />
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Módulo de Exógena disponible próximamente.
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
