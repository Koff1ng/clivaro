'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Receipt, Loader2, AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

async function fetchTransmissions() {
    const res = await fetch('/api/electronic-invoicing/transmissions')
    if (!res.ok) throw new Error('Failed to fetch transmissions')
    return res.json()
}

export default function ElectronicInvoicingMonitor() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['ei-transmissions'],
        queryFn: fetchTransmissions,
        refetchInterval: 10000 // Refetch every 10s
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ALEGRA_ACCEPTED':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Aceptada</Badge>
            case 'ALEGRA_REJECTED':
                return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Rechazada</Badge>
            case 'QUEUED':
                return <Badge variant="secondary" className="bg-slate-100 text-slate-600"><Clock className="h-3 w-3 mr-1" /> En Cola</Badge>
            case 'SENT_TO_ALEGRA':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"><Send className="h-3 w-3 mr-1" /> Enviando</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <PageHeader
                title="Monitor de Facturación Electrónica"
                description="Seguimiento en tiempo real de las facturas enviadas a Alegra."
                icon={<Receipt className="h-6 w-6" />}
                actions={
                    <Button variant="outline" asChild>
                        <Link href="/dashboard">
                            Volver al panel
                        </Link>
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Mes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.pagination?.total || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Transmisiones</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-destructive">Error al cargar los datos.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Factura</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha Intento</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Intentos</TableHead>
                                    <TableHead>Alegra ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data?.transmissions?.map((t: any) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">{t.invoice.number}</TableCell>
                                        <TableCell>{t.invoice.customer.name}</TableCell>
                                        <TableCell>{format(new Date(t.updatedAt), 'dd MMM, HH:mm', { locale: es })}</TableCell>
                                        <TableCell>{getStatusBadge(t.status)}</TableCell>
                                        <TableCell>{t.attemptCount}</TableCell>
                                        <TableCell className="text-xs font-mono">{t.alegraInvoiceId || '-'}</TableCell>
                                    </TableRow>
                                ))}
                                {!data?.transmissions?.length && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay transmisiones registradas.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
