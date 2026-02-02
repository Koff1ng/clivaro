'use client'

import { useQuery } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Activity, Database, Server } from 'lucide-react'

export default function HealthPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['system-health'],
        queryFn: async () => {
            const res = await fetch('/api/health')
            if (!res.ok) throw new Error('Failed to fetch health status')
            return res.json()
        },
        refetchInterval: 30000 // Refresh every 30s
    })

    if (isLoading) return (
        <MainLayout>
            <div className="flex items-center justify-center h-screen">
                <Activity className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        </MainLayout>
    )

    if (error) return (
        <MainLayout>
            <div className="p-8">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <XCircle className="h-8 w-8 text-red-500" />
                        <div>
                            <h2 className="text-xl font-bold text-red-700">Error de Conexión</h2>
                            <p className="text-red-600">No se pudo obtener el estado del sistema. Verifique su sesión.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Estado del Sistema</h1>
                    <Badge variant={data.database.status === 'healthy' ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                        {data.database.status === 'healthy' ? 'Sistema Operativo' : 'Problemas Detectados'}
                    </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Base de Datos</CardTitle>
                            <Database className={`h-4 w-4 ${data.database.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold capitalize">{data.database.status}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Latencia: {data.database.latency}ms
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Entorno</CardTitle>
                            <Server className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold uppercase">{data.system.env}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Versión de producción activa
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Última Verificación</CardTitle>
                            <Activity className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-semibold">
                                {new Date(data.timestamp).toLocaleTimeString()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(data.timestamp).toLocaleDateString()}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="bg-slate-900 rounded-lg p-6 text-slate-50 font-mono text-sm overflow-auto max-h-[400px]">
                    <h3 className="text-slate-400 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4" /> System Info Dump
                    </h3>
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
            </div>
        </MainLayout>
    )
}
