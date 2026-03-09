'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, ShieldCheck, Download, Loader2, User, Building2, MapPin, Calendar, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'

export function LegalAuditDashboard() {
    const [logs, setLogs] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const { toast } = useToast()

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/admin/legal-logs?search=${encodeURIComponent(search)}`)
            if (response.ok) {
                const data = await response.json()
                setLogs(data.logs || [])
            }
        } catch (error) {
            console.error('Error fetching legal logs:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchLogs()
    }

    const handleSyncSchemas = async () => {
        if (!confirm('¿Deseas sincronizar todos los esquemas de las empresas? Esto añadirá las columnas legales faltantes en cada base de datos.')) return

        setSyncing(true)
        try {
            const response = await fetch('/api/admin/migrate-tenants', { method: 'POST' })
            const data = await response.json()

            if (response.ok) {
                toast(`Sincronización completada: ${data.summary.success} empresas actualizadas.`, 'success')
                fetchLogs()
            } else {
                toast(`Error en la sincronización: ${data.error}`, 'error')
            }
        } catch (error) {
            console.error('Error syncing schemas:', error)
            toast('Error al conectar con el servidor para la sincronización.', 'error')
        } finally {
            setSyncing(false)
        }
    }

    const exportToCSV = () => {
        const headers = ['Tenant', 'Nombre', 'Email', 'Versión', 'Fecha Aceptación', 'IP', 'Marketing']
        const rows = logs.map(l => [
            l.tenantName,
            l.name,
            l.email || l.username,
            l.legalVersion,
            l.legalAcceptedAt ? format(new Date(l.legalAcceptedAt), 'yyyy-MM-dd HH:mm:ss') : '',
            l.acceptanceIp,
            l.marketingAccepted ? 'SÍ' : 'NO'
        ])

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(',') + "\n"
            + rows.map(r => r.join(',')).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `auditoria_legal_${format(new Date(), 'yyyyMMdd')}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                        Auditoría Legal y Cumplimiento
                    </h2>
                    <p className="text-slate-500">
                        Registro centralizado de aceptación de términos y política de datos (Ley 1581).
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="bg-white dark:bg-slate-950 border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={handleSyncSchemas}
                        disabled={syncing}
                    >
                        {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                        Sincronizar Esquemas
                    </Button>
                    <Button
                        variant="outline"
                        className="bg-white dark:bg-slate-950 border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={exportToCSV}
                        disabled={logs.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar Auditoría (CSV)
                    </Button>
                </div>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre, email o usuario..."
                                className="pl-10 bg-white dark:bg-slate-950"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Filtrar'}
                        </Button>
                    </form>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                            <p className="text-slate-500 text-sm font-medium">Cargando registros de auditoría...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-500 text-sm font-medium">No se encontraron registros de aceptación.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/30 dark:bg-slate-900/10">
                                        <TableHead className="font-bold">Tenant / Organización</TableHead>
                                        <TableHead className="font-bold">Usuario</TableHead>
                                        <TableHead className="font-bold">Documento / Versión</TableHead>
                                        <TableHead className="font-bold">Fecha y Hora (Col)</TableHead>
                                        <TableHead className="font-bold">IP de Origen</TableHead>
                                        <TableHead className="font-bold">Marketing</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log, idx) => (
                                        <TableRow key={`${log.tenantSlug}-${log.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-slate-100">{log.tenantName}</p>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{log.tenantSlug}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-start gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                        <User className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-slate-100">{log.name}</p>
                                                        <p className="text-xs text-slate-500">{log.email || log.username}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30">
                                                    {log.legalVersion}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-medium">
                                                        {log.legalAcceptedAt ? format(new Date(log.legalAcceptedAt), "d 'de' MMMM, yyyy HH:mm", { locale: es }) : 'N/A'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-mono">{log.acceptanceIp || 'Desconocida'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {log.marketingAccepted ? (
                                                    <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase tracking-wider">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Aceptado
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px] uppercase tracking-wider font-medium">No aceptado</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed">
                    <strong>Aviso de Cumplimiento:</strong> Este registro sirve como prueba legal de consentimiento bajo la Ley 1581 de 2012 de Colombia. La alteración de estos registros puede invalidar el cumplimiento normativo. Los datos de IP y marcas temporales son capturados automáticamente por el sistema al momento de la aceptación.
                </p>
            </div>
        </div>
    )
}
