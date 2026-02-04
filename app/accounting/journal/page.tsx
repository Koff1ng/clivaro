'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function JournalBookPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Libro Diario" description="Visualiza todos los movimientos en orden cronológico." />
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground text-center">
                            Funcionalidad en construcción. Aquí aparecerán todos los asientos detallados.
                            <br />
                            Por ahora, utiliza "Comprobante contable" para ver los documentos.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
