'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FileText, Send, Download, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CreditNoteDetailsProps {
    creditNoteId: string
}

export function CreditNoteDetails({ creditNoteId }: CreditNoteDetailsProps) {
    const router = useRouter()
    const [creditNote, setCreditNote] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transmitting, setTransmitting] = useState(false)

    useEffect(() => {
        loadCreditNote()
    }, [creditNoteId])

    const loadCreditNote = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/credit-notes/${creditNoteId}`)
            if (response.ok) {
                const data = await response.json()
                setCreditNote(data)
            } else {
                console.error('No se pudo cargar la nota crédito')
                alert('No se pudo cargar la nota crédito')
                router.push('/credit-notes')
            }
        } catch (error) {
            console.error('Error loading credit note:', error)
            alert('Error al cargar la nota crédito')
        } finally {
            setLoading(false)
        }
    }

    const handleTransmit = async () => {
        try {
            setTransmitting(true)
            const response = await fetch(`/api/credit-notes/${creditNoteId}/transmit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'ALEGRA' })
            })

            if (response.ok) {
                alert('Transmisión iniciada correctamente')
                await loadCreditNote()
            } else {
                const error = await response.json()
                alert(error.error || 'Error al transmitir')
            }
        } catch (error) {
            console.error('Error transmitting:', error)
            alert('Error al transmitir la nota crédito')
        } finally {
            setTransmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        )
    }

    if (!creditNote) return null

    const statusIcon = {
        PENDING: <Clock className="h-5 w-5 text-yellow-500" />,
        PROCESSING: <Clock className="h-5 w-5 text-blue-500 animate-spin" />,
        SENT: <Clock className="h-5 w-5 text-cyan-500" />,
        ACCEPTED: <CheckCircle className="h-5 w-5 text-green-500" />,
        REJECTED: <XCircle className="h-5 w-5 text-red-500" />
    }[creditNote.electronicStatus || 'PENDING']

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/credit-notes')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{creditNote.number}</h1>
                        <p className="text-muted-foreground">Nota Crédito Electrónica</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {creditNote.electronicStatus === 'PENDING' && (
                        <Button onClick={handleTransmit} disabled={transmitting}>
                            <Send className="h-4 w-4 mr-2" />
                            {transmitting ? 'Transmitiendo...' : 'Transmitir a DIAN'}
                        </Button>
                    )}
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Descargar PDF
                    </Button>
                </div>
            </div>

            {/* Status Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        {statusIcon}
                        <div>
                            <p className="font-semibold">
                                Estado: {creditNote.electronicStatus === 'ACCEPTED' ? 'Aceptada por DIAN' :
                                    creditNote.electronicStatus === 'SENT' ? 'Enviada a DIAN' :
                                        creditNote.electronicStatus === 'PROCESSING' ? 'Procesando' :
                                            creditNote.electronicStatus === 'REJECTED' ? 'Rechazada' :
                                                'Pendiente de envío'}
                            </p>
                            {creditNote.electronicSentAt && (
                                <p className="text-sm text-muted-foreground">
                                    Enviada: {format(new Date(creditNote.electronicSentAt), 'PPP p', { locale: es })}
                                </p>
                            )}
                        </div>
                    </div>
                    {creditNote.cufe && (
                        <div className="bg-muted p-3 rounded text-sm">
                            <p className="font-mono text-xs break-all">CUFE: {creditNote.cufe}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Invoice and Customer Info */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Información de Factura</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <span className="text-sm text-muted-foreground">Factura Original:</span>
                            <Link href={`/invoices/${creditNote.invoiceId}`} className="block text-blue-600 hover:underline font-medium">
                                {creditNote.invoice.number}
                            </Link>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Tipo de Devolución:</span>
                            <p className="font-medium">{creditNote.type === 'TOTAL' ? 'Total' : 'Parcial'}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Código de Referencia:</span>
                            <p className="font-medium">{creditNote.referenceCode} - {creditNote.referenceCode === '20' ? 'Anulación' : 'Devolución'}</p>
                        </div>
                        {creditNote.affectedPeriod && (
                            <div>
                                <span className="text-sm text-muted-foreground">Período Afectado:</span>
                                <p className="font-medium">{creditNote.affectedPeriod}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <span className="text-sm text-muted-foreground">Nombre:</span>
                            <p className="font-medium">{creditNote.invoice.customer.name}</p>
                        </div>
                        {creditNote.invoice.customer.taxId && (
                            <div>
                                <span className="text-sm text-muted-foreground">NIT/CC:</span>
                                <p className="font-medium">{creditNote.invoice.customer.taxId}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Reason */}
            <Card>
                <CardHeader>
                    <CardTitle>Motivo de Devolución</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{creditNote.reason}</p>
                </CardContent>
            </Card>

            {/* Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Items Devueltos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {creditNote.items.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-4 border rounded">
                                <div className="flex-1">
                                    <p className="font-medium">{item.description}</p>
                                    <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                        <span>Cantidad: {item.quantity}</span>
                                        <span>Precio: {formatCurrency(item.unitPrice)}</span>
                                        {item.discount > 0 && <span>Descuento: {item.discount}%</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-destructive">-{formatCurrency(item.subtotal)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Separator className="my-4" />

                    {/* Totals */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>-{formatCurrency(creditNote.subtotal)}</span>
                        </div>
                        {creditNote.discount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Descuento:</span>
                                <span>-{formatCurrency(creditNote.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IVA:</span>
                            <span>-{formatCurrency(creditNote.tax)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total Nota Crédito:</span>
                            <span className="text-destructive">-{formatCurrency(creditNote.total)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transmission Events */}
            {creditNote.transmission?.events && creditNote.transmission.events.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Transmisión</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {creditNote.transmission.events.map((event: any) => (
                                <div key={event.id} className="flex items-start gap-3 text-sm">
                                    <span className="text-muted-foreground">
                                        {format(new Date(event.createdAt), 'PPp', { locale: es })}
                                    </span>
                                    <span>-</span>
                                    <span>{event.message || event.event}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
