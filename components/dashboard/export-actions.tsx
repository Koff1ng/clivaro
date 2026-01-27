'use client'

import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'

export function DashboardExportActions() {
    const [loading, setLoading] = useState<string | null>(null)
    const { toast } = useToast()

    const handleExport = async (type: 'sales' | 'inventory') => {
        setLoading(type)
        try {
            const url = type === 'sales'
                ? `/api/dashboard/export/sales?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`
                : '/api/dashboard/export/inventory'

            const response = await fetch(url)
            if (!response.ok) throw new Error('Export failed')

            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.setAttribute('download', type === 'sales' ? 'Ventas_Mes.xlsx' : 'Valor_Inventario.xlsx')
            document.body.appendChild(link)
            link.click()
            link.remove()

            toast({
                title: 'Exportación exitosa',
                description: `El reporte de ${type === 'sales' ? 'ventas' : 'inventario'} se ha descargado correctamente.`,
            })
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error al exportar',
                description: 'No se pudo generar el reporte de Excel. Por favor intente de nuevo.',
            })
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('sales')}
                disabled={!!loading}
                className="h-8 gap-2"
            >
                {loading === 'sales' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span className="hidden sm:inline">Exportar Ventas</span>
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('inventory')}
                disabled={!!loading}
                className="h-8 gap-2"
            >
                {loading === 'inventory' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="hidden sm:inline">Exportar Inventario</span>
            </Button>
        </div>
    )
}
