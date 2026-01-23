'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { FileDown, FileUp, Database, Download, Upload, AlertCircle, Loader2, FileSpreadsheet, FileJson, Archive, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useMutation } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { ResetDatabaseDialog } from './reset-database-dialog'

interface DataConfigProps {
    settings: any
    onSave: (data: any) => void
    isLoading: boolean
}

export function DataConfig({ settings, onSave, isLoading }: DataConfigProps) {
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState('export')

    // Export State
    const [exportFormat, setExportFormat] = useState('xlsx')
    const [selectedEntities, setSelectedEntities] = useState<string[]>(['products', 'clients', 'sales'])

    const entities = [
        { id: 'clients', label: 'Clientes' },
        { id: 'products', label: 'Productos e Inventario' },
        { id: 'sales', label: 'Ventas y Facturas' },
        { id: 'suppliers', label: 'Proveedores' },
        { id: 'movements', label: 'Movimientos de Inventario' },
    ]

    const toggleEntity = (id: string) => {
        setSelectedEntities(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const exportMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/data/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entities: selectedEntities, format: exportFormat }),
            })
            if (!res.ok) throw new Error('Errorgenerating export')
            return res.blob()
        },
        onSuccess: (blob) => {
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const ext = exportFormat === 'xlsx' ? 'xlsx' : 'json'
            a.download = `backup-${new Date().toISOString().split('T')[0]}.${ext}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast('Exportación completada', 'success')
        },
        onError: (err) => {
            toast('Error al exportar: ' + err.message, 'error')
        }
    })

    // Import State
    const [importEntity, setImportEntity] = useState('clients')
    const [importData, setImportData] = useState<any>(null)
    const [isLoadingImport, setIsLoadingImport] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setSelectedFile(file)
        setIsLoadingImport(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entityType', importEntity)

        try {
            // Preflight check on server
            const res = await fetch('/api/settings/data/import/preview', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setImportData(data)
        } catch (e: any) {
            toast(e.message, 'error')
            setImportData(null)
        } finally {
            setIsLoadingImport(false)
        }
    }

    const executeImportMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFile) throw new Error("No file selected")

            // Parse on client to send JSON array to 'execute' API
            // This avoids re-uploading file logic variation on server.
            const buffer = await selectedFile.arrayBuffer()
            let data: any[] = []
            if (selectedFile.name.endsWith('.json')) {
                data = JSON.parse(new TextDecoder().decode(buffer))
            } else {
                const wb = XLSX.read(buffer, { type: 'array' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                data = XLSX.utils.sheet_to_json(ws)
            }

            // Handle nested JSON structure if needed
            if (selectedFile.name.endsWith('.json') && !Array.isArray(data) && data[importEntity]) {
                data = data[importEntity]
            }

            const res = await fetch('/api/settings/data/import/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entityType: importEntity, data })
            })
            if (!res.ok) {
                const errResult = await res.json()
                throw new Error(errResult.error || 'Import failed')
            }
            return res.json()
        },
        onSuccess: (res) => {
            toast(`Importación completada: ${res.success} creados/actualizados.`, 'success')
            if (res.failed > 0) {
                toast(`Hubo ${res.failed} errores. Revisa la consola o log.`, 'warning')
            }
            setImportData(null)
            setSelectedFile(null)
        },
        onError: (e) => {
            toast('Error al importar: ' + e.message, 'error')
        }
    })

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Database className="h-5 w-5" />
                    Gestión de Datos y Respaldos
                </CardTitle>
                <CardDescription>
                    Exporta tu información, realiza copias de seguridad o importa datos masivamente.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                        <TabsTrigger value="export" className="gap-2"><FileDown className="h-4 w-4" /> Exportar</TabsTrigger>
                        <TabsTrigger value="import" className="gap-2"><FileUp className="h-4 w-4" /> Importar</TabsTrigger>
                        <TabsTrigger value="backups" className="gap-2"><Archive className="h-4 w-4" /> Backups</TabsTrigger>
                    </TabsList>

                    {/* === EXPORTAR === */}
                    <TabsContent value="export" className="space-y-6 pt-4 animate-in fade-in slide-in-from-left-1 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Formato de Exportación</Label>
                                    <Select value={exportFormat} onValueChange={setExportFormat}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="xlsx">
                                                <div className="flex items-center gap-2">
                                                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx) - Recomendado
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="json">
                                                <div className="flex items-center gap-2">
                                                    <FileJson className="h-4 w-4 text-yellow-600" /> JSON (Técnico)
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Excel es mejor para reportes y lectura humana. JSON es ideal para respaldos completos y restauración.
                                    </p>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <Label>Datos a incluir</Label>
                                    <div className="grid gap-2">
                                        {entities.map(ent => (
                                            <div key={ent.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50">
                                                <Checkbox
                                                    id={`export-${ent.id}`}
                                                    checked={selectedEntities.includes(ent.id)}
                                                    onCheckedChange={() => toggleEntity(ent.id)}
                                                />
                                                <Label htmlFor={`export-${ent.id}`} className="cursor-pointer flex-1 font-normal">
                                                    {ent.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                    <Download className="h-8 w-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium">Listo para exportar</h3>
                                    <p className="text-sm text-gray-500">
                                        Se generará un archivo {exportFormat.toUpperCase()} con {selectedEntities.length} entidades seleccionadas.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => exportMutation.mutate()}
                                    disabled={exportMutation.isPending || selectedEntities.length === 0}
                                    className="w-full max-w-xs"
                                >
                                    {exportMutation.isPending ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
                                    ) : (
                                        <>Descargar Archivo</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* === IMPORTAR === */}
                    <TabsContent value="import" className="space-y-4 pt-4">
                        {!importData ? (
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 text-center space-y-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
                                <Input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept=".xlsx, .xls, .json"
                                    onChange={handleFileUpload}
                                />
                                <div className="mx-auto h-12 w-12 text-gray-400">
                                    <Upload className="h-12 w-12" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-lg">Cargar Archivo</h3>
                                    <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                                        Arrastra tu archivo Excel (.xlsx) o JSON aquí.
                                    </p>
                                </div>
                                <div className="flex justify-center gap-4 pt-4 relative z-10 pointer-events-none">
                                    {/* Select needs pointer events, but it's inside drop zone... UI tricky. 
                        Better: Put select OUTSIDE or make input ignore the select area. 
                        For MVP, I'll move the select out or make it separate. 
                    */}
                                </div>

                                {/* Separate controls area */}
                                <div className="flex flex-col items-center gap-2 pt-2 relative z-20">
                                    <Label>Tipo de datos a importar:</Label>
                                    <Select value={importEntity} onValueChange={setImportEntity}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Tipo de datos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="clients">Clientes</SelectItem>
                                            <SelectItem value="products">Productos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {isLoadingImport && <div className="text-blue-600 flex justify-center gap-2 pt-2"><Loader2 className="animate-spin" /> Analizando...</div>}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <FileSpreadsheet className="h-4 w-4" /> Vista Previa ({importData.totalRows} filas)
                                    </h3>
                                    <Button variant="ghost" size="sm" onClick={() => { setImportData(null); setSelectedFile(null); }}>Cancelar</Button>
                                </div>

                                {/* Preview Table */}
                                <div className="border rounded-md overflow-x-auto max-h-[300px]">
                                    <table className="w-full text-sm text-left relative">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b sticky top-0">
                                            <tr>
                                                {importData.headers.map((h: string) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importData.preview.map((row: any, i: number) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    {importData.headers.map((h: string) => <td key={`${i}-${h}`} className="px-4 py-2 truncate max-w-[200px]">{String(row[h] || '')}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {importData.validationError && (
                                    <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700 text-sm flex items-start gap-2">
                                        <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                        <span><strong>Error de Validación:</strong> {importData.validationError}</span>
                                    </div>
                                )}

                                {importData.missingFields.length > 0 ? (
                                    <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700 text-sm">
                                        <strong>Error:</strong> Faltan columnas requeridas: {importData.missingFields.join(', ')}
                                    </div>
                                ) : !importData.validationError && (
                                    <div className="bg-green-50 p-4 rounded-md border border-green-200 text-green-700 text-sm flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" /> Estructura válida. Listo para importar.
                                    </div>
                                )}

                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={() => executeImportMutation.mutate()}
                                        disabled={executeImportMutation.isPending || importData.missingFields.length > 0 || !!importData.validationError}
                                    >
                                        {executeImportMutation.isPending ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
                                        ) : (
                                            'Confirmar Importación'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* === BACKUPS & RESET === */}
                    <TabsContent value="backups" className="space-y-6 pt-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
                            <div className="space-y-1">
                                <h3 className="font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                    <AlertCircle className="h-4 w-4" />
                                    Backups Automáticos
                                </h3>
                                <p className="text-sm text-yellow-700/80 dark:text-yellow-300/80">
                                    Configura la frecuencia de copias de seguridad automáticas.
                                </p>
                            </div>
                            <Switch disabled />
                        </div>

                        {/* Danger Zone */}
                        <div className="border border-red-200 dark:border-red-900 rounded-lg overflow-hidden">
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 border-b border-red-200 dark:border-red-900">
                                <h3 className="font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Zona de Peligro
                                </h3>
                            </div>
                            <div className="p-6 bg-white dark:bg-slate-950 space-y-4">
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Resetear Base de Datos</h4>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Esta acción eliminará permanentemente todos los datos transaccionales (Ventas, Compras, Inventario, Clientes, etc.).
                                        La configuración de la empresa y los usuarios se mantendrán.
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <ResetDatabaseDialog />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                </Tabs>
            </CardContent>
        </Card>
    )
}
