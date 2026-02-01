'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ReportLayoutProps {
    title: string
    description?: string
    children: ReactNode
    onPrint?: () => void
    onExport?: () => void
    filters?: ReactNode
    actions?: ReactNode
}

export function ReportLayout({
    title,
    description,
    children,
    onPrint,
    onExport,
    filters,
    actions,
}: ReportLayoutProps) {
    const router = useRouter()

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.back()}
                            className="h-8 w-8 p-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-bold">{title}</h1>
                    </div>
                    {description && (
                        <p className="text-sm text-muted-foreground ml-10">{description}</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {actions}
                    {onPrint && (
                        <Button variant="outline" size="sm" onClick={onPrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                    )}
                    {onExport && (
                        <Button variant="outline" size="sm" onClick={onExport}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            {filters && (
                <Card>
                    <CardContent className="pt-6">{filters}</CardContent>
                </Card>
            )}

            {/* Main Content */}
            <div className="print:p-8">{children}</div>
        </div>
    )
}
