'use client'

import { ReactNode, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react'
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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    const handleBackendPrint = async () => {
        try {
            setIsGeneratingPdf(true)

            // Capture the current document content
            // We clone the body to avoid modifying the active UI
            const printContent = document.querySelector('.report-content-to-print') || document.body
            
            // Capture all styles
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(style => style.outerHTML)
                .join('\n')

            let htmlContent = `
                <!DOCTYPE html>
                <html lang="es" class="light">
                <head>
                    <meta charset="UTF-8">
                    ${styles}
                    <style>
                        /* Essential print fixes for Puppeteer */
                        body { 
                            background: white !important; 
                            padding: 40px !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-hidden, button, .no-print { display: none !important; }
                        /* Ensure charts and cards show up well */
                        .recharts-responsive-container { width: 100% !important; height: 400px !important; }
                        canvas { max-width: 100% !important; height: auto !important; }
                    </style>
                </head>
                <body class="bg-white">
                    <div class="mb-8">
                        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">${title}</h1>
                        ${description ? `<p style="color: #64748b; font-size: 14px;">${description}</p>` : ''}
                        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e2e8f0;" />
                    </div>
                    ${printContent.innerHTML}
                </body>
                </html>
            `

            const res = await fetch('/api/pdf/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: htmlContent,
                    filename: title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
                })
            })

            if (!res.ok) throw new Error('PDF generation failed')

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            
            // Create a temporary link to trigger download/redirection
            const link = document.createElement('a')
            link.href = url
            link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            // Also open in new tab as fallback/viewer
            window.open(url, '_blank')
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('Error generando el PDF. Intente nuevamente.')
        } finally {
            setIsGeneratingPdf(false)
        }
    }

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
                <div className="flex items-center gap-2 print:hidden">
                    {actions}
                    {onPrint && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleBackendPrint}
                            disabled={isGeneratingPdf}
                        >
                            {isGeneratingPdf ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Printer className="h-4 w-4 mr-2" />
                            )}
                            {isGeneratingPdf ? 'Generando...' : 'Imprimir / PDF'}
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
            <div className="report-content-to-print print:p-8 [&_canvas]:print:block">
                <div className="hidden print:block mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                    {description && <p className="text-lg text-slate-600 mt-2">{description}</p>}
                    <div className="h-divider w-full border-b mt-4 mb-6" />
                </div>
                {children}
            </div>
        </div>
    )
}
