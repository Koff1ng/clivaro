'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, Download, Send, Search, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

interface CreditNote {
    id: string
    number: string
    invoiceId: string
    type: string
    referenceCode: string
    reason: string
    total: number
    status: string
    electronicStatus?: string
    createdAt: string
    invoice: {
        number: string
        customer: {
            name: string
            taxId?: string
        }
    }
    createdBy?: {
        name: string
    }
    _count: {
        items: number
    }
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500',
    PROCESSING: 'bg-blue-500',
    SENT: 'bg-cyan-500',
    ACCEPTED: 'bg-green-500',
    REJECTED: 'bg-red-500'
}

const statusLabels: Record<string, string> = {
    PENDING: 'Pendiente',
    PROCESSING: 'Procesando',
    SENT: 'Enviada',
    ACCEPTED: 'Aceptada',
    REJECTED: 'Rechazada'
}

export function CreditNotesList() {
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    useEffect(() => {
        loadCreditNotes()
    }, [])

    const loadCreditNotes = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (statusFilter !== 'ALL') params.append('electronicStatus', statusFilter)

            const response = await fetch(`/api/credit-notes?${params}`)
            if (response.ok) {
                const data = await response.json()
                setCreditNotes(data)
            }
        } catch (error) {
            console.error('Error loading credit notes:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredNotes = creditNotes.filter(note =>
        note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Notas Crédito Electrónicas</h2>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por número, factura o cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                loadCreditNotes()
                            }}
                            className="border rounded-md px-3 py-2"
                        >
                            <option value="ALL">Todos los estados</option>
                            <option value="PENDING">Pendiente</option>
                            <option value="PROCESSING">Procesando</option>
                            <option value="SENT">Enviada</option>
                            <option value="ACCEPTED">Aceptada</option>
                            <option value="REJECTED">Rechazada</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Credit Notes List */}
            {loading ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Cargando notas crédito...</p>
                </div>
            ) : filteredNotes.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No se encontraron notas crédito</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredNotes.map((note) => (
                        <Card key={note.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-lg">{note.number}</h3>
                                            <Badge className={statusColors[note.electronicStatus || 'PENDING']}>
                                                {statusLabels[note.electronicStatus || 'PENDING']}
                                            </Badge>
                                            {note.type === 'TOTAL' && (
                                                <Badge variant="outline">Total</Badge>
                                            )}
                                            {note.type === 'PARTIAL' && (
                                                <Badge variant="outline">Parcial</Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Factura: </span>
                                                <Link href={`/invoices/${note.invoiceId}`} className="text-blue-600 hover:underline">
                                                    {note.invoice.number}
                                                </Link>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Cliente: </span>
                                                <span className="font-medium">{note.invoice.customer.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Fecha: </span>
                                                <span>{format(new Date(note.createdAt), 'PPP', { locale: es })}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Items: </span>
                                                <span>{note._count.items}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-muted-foreground">Motivo: </span>
                                                <span className="text-sm">{note.reason}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right ml-6">
                                        <div className="text-2xl font-bold text-destructive">
                                            -{formatCurrency(note.total)}
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <Link href={`/credit-notes/${note.id}`}>
                                                <Button size="sm" variant="outline">
                                                    <FileText className="h-4 w-4 mr-1" />
                                                    Ver
                                                </Button>
                                            </Link>
                                            {note.electronicStatus === 'PENDING' && (
                                                <Button size="sm" variant="default">
                                                    <Send className="h-4 w-4 mr-1" />
                                                    Transmitir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
