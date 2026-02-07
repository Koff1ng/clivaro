'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
                <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                            <TableRow>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Número</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Factura</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Cliente</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Fecha</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Estado</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm">Motivo</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Total</TableHead>
                                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredNotes.map((note) => (
                                <TableRow key={note.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 border-b transition-colors">
                                    <TableCell className="py-3 px-4 font-medium text-sm">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            {note.number}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-sm">
                                        <Link href={`/invoices/${note.invoiceId}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                                            {note.invoice.number}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {note.invoice.customer.name}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                        {format(new Date(note.createdAt), 'dd MMM yyyy', { locale: es })}
                                    </TableCell>
                                    <TableCell className="py-3 px-4">
                                        <Badge className={`${statusColors[note.electronicStatus || 'PENDING']} hover:${statusColors[note.electronicStatus || 'PENDING']} text-white rounded-full px-2.5 py-0.5 text-xs font-medium`}>
                                            {statusLabels[note.electronicStatus || 'PENDING']}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-sm text-gray-500 max-w-[200px] truncate" title={note.reason}>
                                        {note.reason}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right font-bold text-red-600 text-sm">
                                        -{formatCurrency(note.total)}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={`/credit-notes/${note.id}`}>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                                                    title="Ver detalles"
                                                >
                                                    <FileText className="h-4 w-4 text-gray-500" />
                                                </Button>
                                            </Link>
                                            {note.electronicStatus === 'PENDING' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
                                                    title="Transmitir a la DIAN"
                                                >
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
