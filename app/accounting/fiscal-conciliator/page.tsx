
'use client'

import { useState, useEffect, useRef } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
    Upload,
    CheckCircle2,
    History,
    Loader2,
    ArrowRightLeft,
    Check,
    X,
    FileImage
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function FiscalConciliatorPage() {
    const { toast } = useToast()
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')
    const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

    const [loading, setLoading] = useState(false)
    const [reconciliation, setReconciliation] = useState<any>(null)
    const [bookEntries, setBookEntries] = useState<any[]>([])

    // Upload state
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/accounting/accounts')
            if (res.ok) {
                const data = await res.json()
                // Filter for bank accounts or accounts that should be reconciled
                setAccounts(data.filter((a: any) => a.tags?.includes('BANK') || a.code.startsWith('1110')))
            }
        } catch (e) {
            console.error(e)
        }
    }

    const fetchReconciliation = async () => {
        if (!selectedAccount || !period) return
        setLoading(true)
        try {
            const res = await fetch(`/api/accounting/reconciliation?accountId=${selectedAccount}&period=${period}`)
            if (res.ok) {
                const data = await res.json()
                if (data) {
                    setReconciliation(data.reconciliation)
                    setBookEntries(data.bookEntries)
                } else {
                    setReconciliation(null)
                    setBookEntries([])
                }
            }
        } catch (e) {
            toast('Error cargando conciliación', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    useEffect(() => {
        if (selectedAccount && period) {
            fetchReconciliation()
        }
    }, [selectedAccount, period])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedAccount || !period) return

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('accountId', selectedAccount)
        formData.append('period', period)

        try {
            const res = await fetch('/api/accounting/reconciliation', {
                method: 'POST',
                body: formData
            })
            if (res.ok) {
                toast('Extracto bancario procesado con éxito', 'success')
                fetchReconciliation()
            } else {
                toast('Error al procesar el extracto', 'error')
            }
        } catch (e) {
            toast('Error de conexión con el servidor', 'error')
        } finally {
            setUploading(false)
        }
    }

    const handleMatch = async (bankEntryId: string, journalLineId: string) => {
        try {
            const res = await fetch('/api/accounting/reconciliation', {
                method: 'PATCH',
                body: JSON.stringify({ action: 'match', bankEntryId, journalLineId }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Mantenimiento conciliado con libros', 'success')
                fetchReconciliation()
            }
        } catch (e) {
            toast('Error al registrar conciliación', 'error')
        }
    }

    const handleUnmatch = async (bankEntryId: string) => {
        try {
            const res = await fetch('/api/accounting/reconciliation', {
                method: 'PATCH',
                body: JSON.stringify({ action: 'unmatch', bankEntryId }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Conciliación eliminada', 'success')
                fetchReconciliation()
            }
        } catch (e) {
            toast('Error al desvincular el registro', 'error')
        }
    }

    const handleFinalize = async () => {
        if (!reconciliation) return
        try {
            const res = await fetch('/api/accounting/reconciliation', {
                method: 'PATCH',
                body: JSON.stringify({
                    action: 'close',
                    id: reconciliation.id,
                    balanceBank: reconciliation.entries.reduce((acc: number, e: any) => acc + e.amount, 0),
                    balanceBooks: reconciliation.entries.filter((e: any) => e.status === 'MATCHED').reduce((acc: number, e: any) => acc + e.amount, 0)
                }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Conciliación finalizada y cerrada', 'success')
                fetchReconciliation()
            }
        } catch (e) {
            toast('Error al cerrar conciliación', 'error')
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6 lg:p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <PageHeader
                        title="Conciliador Bancario y Fiscal"
                        description="Asocia movimientos de extractos con tu contabilidad de forma automática."
                    />
                    <div className="flex items-center gap-2">
                        {reconciliation && reconciliation.status === 'OPEN' && (
                            <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar Periodo
                            </Button>
                        )}
                        {reconciliation && reconciliation.status === 'CLOSED' && (
                            <Badge className="bg-blue-100 text-blue-700 h-10 px-4 text-sm font-bold border-blue-200">
                                <Check className="mr-2 h-4 w-4" /> PERIODO CERRADO
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <Card className="lg:col-span-1 shadow-md border-slate-200">
                        <CardContent className="p-6 space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-500">Cuenta de Banco</Label>
                                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                    <SelectTrigger className="h-11 shadow-sm">
                                        <SelectValue placeholder="Seleccione una cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.length === 0 && <div className="p-4 text-center text-xs">No hay cuentas de banco</div>}
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex flex-col items-start">
                                                    <span className="font-bold">{acc.code}</span>
                                                    <span className="text-[10px] text-muted-foreground">{acc.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-500">Periodo a Conciliar</Label>
                                <Input
                                    type="month"
                                    className="h-11 shadow-sm"
                                    value={period}
                                    onChange={e => setPeriod(e.target.value)}
                                />
                            </div>

                            {!reconciliation && (
                                <div className="pt-4 border-t border-slate-100">
                                    <Label className="text-xs font-bold uppercase text-slate-500 block mb-3 text-blue-600">Subir Extracto</Label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-blue-100 rounded-xl p-6 bg-blue-50/30 hover:bg-blue-50 transition-colors cursor-pointer text-center group"
                                    >
                                        <Upload className="mx-auto h-8 w-8 text-blue-400 group-hover:scale-110 transition-transform mb-2" />
                                        <p className="text-xs font-medium text-blue-700">Arrastra o haz clic para subir imagen/PDF</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Soporta PNG, JPG, PDF</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleUpload}
                                    />
                                </div>
                            )}

                            {reconciliation && (
                                <div className="pt-4 space-y-3 border-t">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Bancos:</span>
                                        <span className="font-mono font-bold">{formatCurrency(reconciliation.entries.reduce((acc: number, e: any) => acc + e.amount, 0))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Libros:</span>
                                        <span className="font-mono font-bold text-blue-600">
                                            {formatCurrency(reconciliation.entries.filter((e: any) => e.status === 'MATCHED').reduce((acc: number, e: any) => acc + e.amount, 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t font-bold text-lg">
                                        <span>Dif:</span>
                                        <span className={cn(
                                            Math.abs(reconciliation.entries.filter((e: any) => e.status === 'PENDING').reduce((acc: number, e: any) => acc + e.amount, 0)) < 1
                                                ? "text-green-600" : "text-red-500"
                                        )}>
                                            {formatCurrency(reconciliation.entries.filter((e: any) => e.status === 'PENDING').reduce((acc: number, e: any) => acc + e.amount, 0))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-3 shadow-md border-slate-200 overflow-hidden">
                        {reconciliation ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 h-full min-h-[600px]">
                                {/* BANK ENTRIES PANEL */}
                                <div className="border-r border-slate-100 flex flex-col">
                                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <FileImage className="h-4 w-4 text-blue-600" />
                                            <span className="font-bold text-sm">EXTRACTO BANCARIO</span>
                                        </div>
                                        <Badge className="bg-blue-600">{reconciliation.entries.length}</Badge>
                                    </div>
                                    <ScrollArea className="flex-1 bg-white">
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow>
                                                    <TableHead className="text-[10px] uppercase font-bold">Fecha</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold">Descripción</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold text-right">Monto</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reconciliation.entries.map((entry: any) => (
                                                    <TableRow key={entry.id} className={cn("group transition-colors", entry.status === 'MATCHED' ? "bg-green-50/50" : "hover:bg-slate-50")}>
                                                        <TableCell className="text-[11px] py-3">{new Date(entry.date).toLocaleDateString()}</TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="text-[11px] font-semibold text-slate-700">{entry.description}</div>
                                                            <div className="text-[9px] text-slate-400 font-mono italic">{entry.reference || "S/REF"}</div>
                                                        </TableCell>
                                                        <TableCell className={cn("text-right font-mono text-[11px] font-bold py-3", entry.amount < 0 ? "text-red-600" : "text-green-600")}>
                                                            {formatCurrency(entry.amount)}
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            {entry.status === 'MATCHED' ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600"
                                                                    onClick={() => handleUnmatch(entry.id)}
                                                                    disabled={reconciliation.status === 'CLOSED'}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            ) : (
                                                                <div className="flex h-6 w-6 items-center justify-center">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>

                                {/* BOOK ENTRIES PANEL */}
                                <div className="flex flex-col bg-slate-50/30">
                                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <History className="h-4 w-4 text-indigo-600" />
                                            <span className="font-bold text-sm">LIBROS CONTABLES</span>
                                        </div>
                                        <Badge variant="outline" className="border-indigo-200 text-indigo-700">{bookEntries.length}</Badge>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        {bookEntries.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
                                                <Check className="h-12 w-12 text-slate-400 mb-2" />
                                                <p className="text-sm font-medium">Todo conciliado</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-slate-50/50">
                                                    <TableRow>
                                                        <TableHead className="text-[10px] uppercase font-bold">Fecha</TableHead>
                                                        <TableHead className="text-[10px] uppercase font-bold">Concepto / Tercero</TableHead>
                                                        <TableHead className="text-[10px] uppercase font-bold text-right">Monto</TableHead>
                                                        <TableHead className="w-12"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {bookEntries.map((line: any) => {
                                                        const amount = line.debit - line.credit
                                                        return (
                                                            <TableRow key={line.id} className="hover:bg-indigo-50/50 transition-colors group">
                                                                <TableCell className="text-[11px] py-3">{new Date(line.journalEntry.date).toLocaleDateString()}</TableCell>
                                                                <TableCell className="py-3">
                                                                    <div className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">{line.description || line.journalEntry.description}</div>
                                                                    <div className="text-[9px] text-slate-400 italic">{line.thirdPartyName || "Sin tercero"}</div>
                                                                </TableCell>
                                                                <TableCell className={cn("text-right font-mono text-[11px] font-bold py-3", amount < 0 ? "text-red-500" : "text-green-600")}>
                                                                    {formatCurrency(amount)}
                                                                </TableCell>
                                                                <TableCell className="p-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                                        disabled={reconciliation.status === 'CLOSED'}
                                                                        onClick={() => {
                                                                            const candidate = reconciliation.entries.find((e: any) => e.status === 'PENDING' && Math.round(e.amount) === Math.round(amount))
                                                                            if (candidate) {
                                                                                handleMatch(candidate.id, line.id)
                                                                            } else {
                                                                                toast(`No se encontró un monto exacto de ${formatCurrency(amount)} en el extracto`, 'warning')
                                                                            }
                                                                        }}
                                                                    >
                                                                        <ArrowRightLeft className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 text-center px-4 space-y-6">
                                <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center">
                                    <ArrowRightLeft className="h-10 w-10 text-blue-400" />
                                </div>
                                <div className="max-w-md space-y-2">
                                    <h2 className="text-2xl font-bold text-slate-800">Inicia tu conciliación mensual</h2>
                                    <p className="text-slate-500">Carga el extracto bancario del periodo seleccionado para empezar a cuadrar las cuentas.</p>
                                </div>
                                {!selectedAccount && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                        Pendiente: Selecciona una cuenta bancaria a la izquierda
                                    </Badge>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </MainLayout>
    )
}
