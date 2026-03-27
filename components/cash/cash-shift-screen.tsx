'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Plus,
  Minus,
  Lock,
  Unlock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  FileText,
  CreditCard,
  ArrowLeftRight,
  Printer,
  Download,
  Receipt,
  RefreshCw,
  MoreHorizontal,
  Utensils,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { ShiftReportPrint } from './shift-report-print'
import { ShiftReportPrintLetter } from './shift-report-print-letter'
import { MonthlyReport } from '@/components/dashboard/monthly-report'
import { PageHeader } from '@/components/ui/page-header'
import { useThermalPrint, useLetterPrint } from '@/lib/hooks/use-thermal-print'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

async function fetchActiveShift() {
  const res = await fetch('/api/cash/shifts?active=true')
  if (!res.ok) throw new Error('Failed to fetch shift')
  const data = await res.json()
  return data.shifts?.[0] || null
}

async function fetchShiftMovements(cashShiftId: string) {
  const res = await fetch(`/api/cash/movements?cashShiftId=${cashShiftId}`)
  if (!res.ok) throw new Error('Failed to fetch movements')
  const data = await res.json()
  return data.movements || []
}

async function fetchShiftPayments(cashShiftId: string) {
  const res = await fetch(`/api/cash/shifts/${cashShiftId}/payments`)
  if (!res.ok) throw new Error('Failed to fetch payments')
  const data = await res.json()
  return data
}

async function fetchClosedShifts() {
  const res = await fetch('/api/cash/shifts?status=CLOSED')
  if (!res.ok) throw new Error('Failed to fetch shifts')
  const data = await res.json()
  return data.shifts || []
}

async function openShift(startingCash: number) {
  const payload = {
    action: 'open',
    startingCash: Number(startingCash) || 0
  }

  const res = await fetch('/api/cash/shifts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let errorData
    try {
      errorData = await res.json()
    } catch (e) {
      throw new Error(`Error ${res.status}: ${res.statusText}`)
    }
    throw new Error(errorData.error || 'Failed to open shift')
  }

  try {
    return await res.json()
  } catch (e) {
    throw new Error('Invalid response from server')
  }
}

async function closeShift(countedCash: number, notes?: string) {
  const res = await fetch('/api/cash/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'close', countedCash, notes }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to close shift')
  }
  return res.json()
}

async function createMovement(cashShiftId: string, type: 'IN' | 'OUT', amount: number, reason?: string) {
  const res = await fetch('/api/cash/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cashShiftId, type, amount, reason }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create movement')
  }
  return res.json()
}

export function CashShiftScreen() {
  const { toast } = useToast()
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN')
  const [startingCash, setStartingCash] = useState('0')
  const [countedCash, setCountedCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [closedShiftReport, setClosedShiftReport] = useState<any>(null)
  const [showReportDialog, setShowReportDialog] = useState(false)

  // Live shift duration timer (state declared here, effect runs below after queries)
  const [shiftDuration, setShiftDuration] = useState('')

  // Print hooks for proper print dimensions
  const { print: printThermal } = useThermalPrint({ targetId: 'shift-report-thermal', widthMm: 80 })
  const { print: printLetter } = useLetterPrint({ targetId: 'shift-report-letter' })

  const queryClient = useQueryClient()

  const { data: activeShift, refetch: refetchShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: fetchActiveShift,
  })

  const { data: movements = [], refetch: refetchMovements } = useQuery({
    queryKey: ['cash-movements', activeShift?.id],
    queryFn: () => activeShift ? fetchShiftMovements(activeShift.id) : [],
    enabled: !!activeShift,
  })

  const { data: paymentsData, refetch: refetchPayments } = useQuery({
    queryKey: ['cash-payments', activeShift?.id],
    queryFn: () => activeShift ? fetchShiftPayments(activeShift.id) : { payments: [], totalsByMethod: {}, total: 0 },
    enabled: !!activeShift,
  })

  const payments = paymentsData?.payments || []
  const totalsByMethod = paymentsData?.totalsByMethod || {}
  const totalPayments = paymentsData?.total || 0
  const discountsTotal = paymentsData?.discounts?.total || 0
  const discountsByInvoice = paymentsData?.discounts?.byInvoice || []

  const { data: closedShifts = [], refetch: refetchClosedShifts } = useQuery({
    queryKey: ['closed-shifts'],
    queryFn: fetchClosedShifts,
    enabled: showHistory,
  })

  // Refetch closed shifts when history is shown
  useEffect(() => {
    if (showHistory) {
      refetchClosedShifts()
    }
  }, [showHistory, refetchClosedShifts])

  // Live shift duration timer
  useEffect(() => {
    if (!activeShift?.openedAt) { setShiftDuration(''); return }
    const calcDuration = () => {
      const start = new Date(activeShift.openedAt).getTime()
      const diff = Math.max(0, Date.now() - start)
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setShiftDuration(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    calcDuration()
    const interval = setInterval(calcDuration, 1000)
    return () => clearInterval(interval)
  }, [activeShift?.openedAt])

  const openShiftMutation = useMutation({
    mutationFn: (cash: number) => openShift(cash),
    onSuccess: () => {
      setShowOpenDialog(false)
      setStartingCash('0')
      refetchShift()
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast('Turno abierto exitosamente', 'success')
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Error al abrir el turno'
      toast(errorMessage, 'error')
    },
  })

  const closeShiftMutation = useMutation({
    mutationFn: ({ countedCash, notes }: { countedCash: number; notes?: string }) =>
      closeShift(countedCash, notes),
    onSuccess: async (data) => {
      toast('Turno cerrado exitosamente', 'success')
      setShowCloseDialog(false)
      // Fetch full shift details with payments for report
      const shiftId = data.shift?.id
      if (shiftId) {
        try {
          const paymentsRes = await fetch(`/api/cash/shifts/${shiftId}/payments`)
          const paymentsData = paymentsRes.ok ? await paymentsRes.json() : { payments: [], totalsByMethod: {}, total: 0 }
          const movementsRes = await fetch(`/api/cash/movements?cashShiftId=${shiftId}`)
          const movementsData = movementsRes.ok ? await movementsRes.json() : { movements: [] }

          setClosedShiftReport({
            ...data.shift,
            payments: paymentsData.payments || [],
            totalsByMethod: paymentsData.totalsByMethod || {},
            totalPayments: paymentsData.total || 0,
            discountsTotal: paymentsData.discounts?.total || 0,
            discountsByInvoice: paymentsData.discounts?.byInvoice || [],
            movements: movementsData.movements || [],
          })
          setShowReportDialog(true)
        } catch (error) {
          console.error('Error fetching shift details:', error)
          setClosedShiftReport(data.shift)
          setShowReportDialog(true)
        }
      }
      setCountedCash('')
      setCloseNotes('')
      refetchShift()
      // Always invalidate closed shifts query to update history
      queryClient.invalidateQueries({ queryKey: ['closed-shifts'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Error al cerrar el turno'
      toast(errorMessage, 'error')
    },
  })

  const createMovementMutation = useMutation({
    mutationFn: ({ type, amount, reason }: { type: 'IN' | 'OUT'; amount: number; reason?: string }) =>
      createMovement(activeShift!.id, type, amount, reason),
    onSuccess: () => {
      setShowMovementDialog(false)
      setMovementAmount('')
      setMovementReason('')
      refetchMovements()
      refetchShift()
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast('Movimiento registrado exitosamente', 'success')
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Error al crear el movimiento'
      toast(errorMessage, 'error')
    },
  })

  const handleOpenShift = () => {
    const cash = parseFloat(startingCash) || 0
    if (isNaN(cash) || cash < 0) {
      toast('Ingrese un monto válido', 'warning')
      return
    }
    openShiftMutation.mutate(cash)
  }

  const handleCloseShift = () => {
    if (!countedCash) {
      toast('Ingrese el efectivo contado', 'warning')
      return
    }
    closeShiftMutation.mutate({
      countedCash: parseFloat(countedCash),
      notes: closeNotes || undefined,
    })
  }

  const handleCreateMovement = () => {
    if (!movementAmount) {
      toast('Ingrese el monto', 'warning')
      return
    }
    createMovementMutation.mutate({
      type: movementType,
      amount: parseFloat(movementAmount),
      reason: movementReason || undefined,
    })
  }

  // Calculate totals
  const totalIn = movements
    .filter((m: any) => m.type === 'IN')
    .reduce((sum: number, m: any) => sum + m.amount, 0)
  const totalOut = movements
    .filter((m: any) => m.type === 'OUT')
    .reduce((sum: number, m: any) => sum + m.amount, 0)
  const netMovement = totalIn - totalOut

  // Payment method icon resolver — handles custom method names too
  const getPaymentMethodIcon = (method: string) => {
    const upper = (method || '').toUpperCase()
    if (upper.includes('EFECTIVO') || upper === 'CASH') return DollarSign
    if (upper.includes('TARJETA') || upper === 'CARD' || upper.includes('CREDIT') || upper.includes('DEBIT')) return CreditCard
    if (upper.includes('TRANSFER') || upper.includes('PSE') || upper.includes('NEQUI') || upper.includes('DAVIPLATA')) return ArrowLeftRight
    if (upper.includes('ELECTR') || upper === 'ELECTRONIC') return Receipt
    return DollarSign
  }

  // Cash in drawer = starting + net movements (no sales — sales go to their own methods)
  const cashInDrawer = (activeShift?.startingCash || 0) + netMovement

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Caja"
          description="Controla turnos, registra entradas/salidas y revisa pagos del día con claridad."
          icon={<DollarSign className="h-5 w-5" />}
        />
        <div className="flex gap-2 items-center">
          <MonthlyReport />
          {!activeShift ? (
            <Button onClick={() => setShowOpenDialog(true)} size="lg">
              <Unlock className="h-5 w-5 mr-2" />
              Abrir Turno
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setMovementType('IN')
                  setShowMovementDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Entrada
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMovementType('OUT')
                  setShowMovementDialog(true)
                }}
              >
                <Minus className="h-4 w-4 mr-2" />
                Salida
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setCountedCash(activeShift.expectedCash?.toString() || '0')
                  setShowCloseDialog(true)
                }}
              >
                <Lock className="h-5 w-5 mr-2" />
                Cerrar Turno
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {showHistory ? 'Ocultar' : 'Ver'} Historial
          </Button>
        </div>
      </div>

      {!activeShift ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Lock className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No hay turno de caja abierto</h3>
              <p className="text-gray-600 mb-6 max-w-md">Abre un turno para comenzar a gestionar la caja y registrar transacciones</p>
              <Button onClick={() => setShowOpenDialog(true)} size="lg" className="px-8">
                <Unlock className="h-5 w-5 mr-2" />
                Abrir Turno
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Current Shift Summary - Improved Design */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Summary Card */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Turno Actual</CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        <span>{activeShift.user?.name || 'N/A'}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(activeShift.openedAt)}</span>
                      </div>
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        Abierto
                      </span>
                      {shiftDuration && (
                        <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-semibold animate-pulse">
                          ⏱ {shiftDuration}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { refetchShift(); refetchMovements(); refetchPayments() }} title="Actualizar datos">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Efectivo Inicial</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(activeShift.startingCash || 0)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Total Ventas</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalPayments)}
                    </div>
                  </div>
                  <div className={`bg-gradient-to-br rounded-xl p-4 border ${netMovement >= 0
                    ? 'from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800'
                    : 'from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800'
                    }`}>
                    <div className={`text-xs font-medium mb-1 ${netMovement >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      Movimiento Neto
                    </div>
                    <div className={`text-2xl font-bold ${netMovement >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(netMovement)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Efectivo en Caja</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(cashInDrawer)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-foreground">Entradas</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(totalIn)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-foreground">Salidas</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">{formatCurrency(totalOut)}</span>
                  </div>
                </div>

                {/* Payment Methods Summary - Compact */}
                {activeShift.summaryItems && activeShift.summaryItems.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold mb-3 text-foreground">Ingresos por Método de Pago</div>
                    <div className="space-y-2">
                      {activeShift.summaryItems.map((item: any) => {
                        const Icon = getPaymentMethodIcon(item.paymentMethodName.toUpperCase())
                        return (
                          <div key={item.paymentMethodId} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{item.paymentMethodName}</span>
                            </div>
                            <span className="text-sm font-bold">{formatCurrency(item.expectedAmount)}</span>
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-2 border-primary/20 mt-2">
                        <span className="text-sm font-bold text-foreground">Total Ventas</span>
                        <span className="text-base font-bold text-primary">{formatCurrency(totalPayments)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Total Ventas</div>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalPayments)}</div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="text-xs text-gray-600 mb-2">Movimientos</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Entradas</span>
                        <span className="font-semibold text-green-600">{formatCurrency(totalIn)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Salidas</span>
                        <span className="font-semibold text-red-600">{formatCurrency(totalOut)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="text-xs text-gray-600 mb-1">Pagos Registrados</div>
                    <div className="text-xl font-bold">{payments.length}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Movements and Payments - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Movements List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Movimientos de Efectivo</CardTitle>
              </CardHeader>
              <CardContent>
                {movements.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay movimientos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {movements.map((movement: any) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg border hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded ${movement.type === 'IN'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {movement.type === 'IN' ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {formatCurrency(movement.amount)}
                            </div>
                            <div className="text-xs text-gray-600">
                              {movement.reason || 'Sin razón'} • {formatDate(movement.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payments List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pagos del Turno</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay pagos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment: any) => {
                      const Icon = getPaymentMethodIcon(payment.method)
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded border">
                              <Icon className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {formatCurrency(payment.amount)}
                              </div>
                              <div className="text-xs text-gray-600">
                                {payment.method} • {payment.invoiceNumber || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Turnos Cerrados</CardTitle>
          </CardHeader>
          <CardContent>
            {closedShifts.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No hay turnos cerrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Abierto</TableHead>
                    <TableHead>Cerrado</TableHead>
                    <TableHead>Efectivo Inicial</TableHead>
                    <TableHead>Efectivo Esperado</TableHead>
                    <TableHead>Efectivo Contado</TableHead>
                    <TableHead>Diferencia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedShifts.map((shift: any) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shift.user?.name || 'N/A'}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(shift.openedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {shift.closedAt ? formatDate(shift.closedAt) : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(shift.startingCash || 0)}</TableCell>
                      <TableCell>{formatCurrency(shift.expectedCash || 0)}</TableCell>
                      <TableCell>
                        {shift.countedCash ? formatCurrency(shift.countedCash) : '-'}
                      </TableCell>
                      <TableCell>
                        {shift.difference !== null && shift.difference !== undefined ? (
                          <span
                            className={`font-semibold ${shift.difference === 0
                              ? 'text-green-600'
                              : shift.difference > 0
                                ? 'text-blue-600'
                                : 'text-red-600'
                              }`}
                          >
                            {formatCurrency(shift.difference)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${shift.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-green-100 text-green-700'
                              }`}
                          >
                            {shift.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                          </span>
                          {shift.status === 'CLOSED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const paymentsRes = await fetch(`/api/cash/shifts/${shift.id}/payments`)
                                  const paymentsData = paymentsRes.ok ? await paymentsRes.json() : { payments: [], totalsByMethod: {}, total: 0 }
                                  const movementsRes = await fetch(`/api/cash/movements?cashShiftId=${shift.id}`)
                                  const movementsData = movementsRes.ok ? await movementsRes.json() : { movements: [] }

                                  setClosedShiftReport({
                                    ...shift,
                                    payments: paymentsData.payments || [],
                                    totalsByMethod: paymentsData.totalsByMethod || {},
                                    totalPayments: paymentsData.total || 0,
                                    discountsTotal: paymentsData.discounts?.total || 0,
                                    discountsByInvoice: paymentsData.discounts?.byInvoice || [],
                                    movements: movementsData.movements || [],
                                  })
                                  setShowReportDialog(true)
                                } catch (error) {
                                  console.error('Error fetching shift details:', error)
                                  toast('Error al cargar los detalles del turno', 'error')
                                }
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Ver Detalle
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shift Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
          {closedShiftReport && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">Reporte Detallado del Turno</DialogTitle>
                <DialogDescription className="sr-only">Resumen completo del turno de caja con pagos, movimientos y totales.</DialogDescription>
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-gray-600">
                    {formatDate(closedShiftReport.openedAt)} - {closedShiftReport.closedAt ? formatDate(closedShiftReport.closedAt) : 'En curso'}
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Formato de impresión</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={printThermal}>
                          <Receipt className="h-4 w-4 mr-2" />
                          Tirilla (80mm)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={printLetter}>
                          <FileText className="h-4 w-4 mr-2" />
                          Hoja Carta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const content = document.getElementById('shift-report-letter')
                        if (content) {
                          try {
                            // Extract just the innerHTML of the letter container
                            // and wrap it in a clean document structure
                            const cleanHtml = `
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <meta charset="utf-8">
                                  <title>Reporte de Turno</title>
                                  <script src="https://cdn.tailwindcss.com"></script>
                                  <style>
                                    @page { size: letter; margin: 1cm; }
                                    body { font-family: ui-sans-serif, system-ui, sans-serif; background: white; color: black; }
                                  </style>
                                </head>
                                <body class="p-8">
                                  ${content.innerHTML}
                                </body>
                              </html>
                            `;

                            const res = await fetch('/api/pdf/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ html: cleanHtml, format: 'Letter' })
                            })
                            
                            if (!res.ok) throw new Error('Error al generar PDF')
                              
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `Reporte-Turno-${closedShiftReport.id || 'Caja'}.pdf`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                          } catch (err) {
                            console.error('Download error:', err)
                          }
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Vista para impresión térmica (80mm) - oculta en pantalla */}
              <div id="shift-report-thermal" className="hidden">
                <ShiftReportPrint
                  shift={closedShiftReport}
                  payments={closedShiftReport.payments || []}
                  totalsByMethod={closedShiftReport.totalsByMethod || {}}
                  totalPayments={closedShiftReport.totalPayments || 0}
                  movements={closedShiftReport.movements || []}
                  discountsTotal={closedShiftReport.discountsTotal || 0}
                  discountsByInvoice={closedShiftReport.discountsByInvoice || []}
                />
              </div>

              {/* Vista para impresión carta - oculta en pantalla */}
              <div id="shift-report-letter" className="hidden">
                <ShiftReportPrintLetter
                  shift={closedShiftReport}
                  payments={closedShiftReport.payments || []}
                  totalsByMethod={closedShiftReport.totalsByMethod || {}}
                  totalPayments={closedShiftReport.totalPayments || 0}
                  movements={closedShiftReport.movements || []}
                  discountsTotal={closedShiftReport.discountsTotal || 0}
                  discountsByInvoice={closedShiftReport.discountsByInvoice || []}
                />
              </div>

              {/* Vista normal en pantalla */}
              <div id="shift-report-content" className="space-y-6 print:hidden">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Cajero</div>
                    <div className="font-semibold">{closedShiftReport.user?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Estado</div>
                    <div className="font-semibold">
                      <span className={`px-2 py-1 rounded text-xs ${closedShiftReport.status === 'CLOSED' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                        }`}>
                        {closedShiftReport.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Abierto el</div>
                    <div className="font-semibold">{formatDate(closedShiftReport.openedAt)}</div>
                  </div>
                  {closedShiftReport.closedAt && (
                    <div>
                      <div className="text-sm text-gray-600">Cerrado el</div>
                      <div className="font-semibold">{formatDate(closedShiftReport.closedAt)}</div>
                    </div>
                  )}
                </div>

                {/* Cash Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Efectivo Inicial</div>
                    <div className="text-xl font-bold text-blue-600">{formatCurrency(closedShiftReport.startingCash || 0)}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Efectivo Esperado</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(closedShiftReport.expectedCash || 0)}</div>
                  </div>
                  {closedShiftReport.countedCash !== null && closedShiftReport.countedCash !== undefined && (
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Efectivo Contado</div>
                      <div className="text-xl font-bold">{formatCurrency(closedShiftReport.countedCash)}</div>
                    </div>
                  )}
                  {closedShiftReport.difference !== null && closedShiftReport.difference !== undefined && (
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Diferencia</div>
                      <div className={`text-xl font-bold ${closedShiftReport.difference === 0 ? 'text-green-600' :
                        closedShiftReport.difference > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(closedShiftReport.difference)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cuentas de Restaurante si está activo */}
      <RestaurantAccountsSection />

      {/* Payment Methods Summary */}
                {closedShiftReport.summaryItems && closedShiftReport.summaryItems.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Ingresos por Método de Pago</h3>
                    <div className="space-y-3">
                      {closedShiftReport.summaryItems.map((item: any) => {
                        const Icon = getPaymentMethodIcon(item.paymentMethodName.toUpperCase())
                        return (
                          <div key={item.paymentMethodId} className="p-3 bg-gray-50 rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5 text-gray-600" />
                                <span className="font-semibold">{item.paymentMethodName}</span>
                              </div>
                              <span className="text-sm px-2 py-0.5 bg-gray-200 rounded text-gray-700 font-medium">
                                {item.paymentMethodType || 'ELECTRÓNICO'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t border-gray-100">
                              <div>
                                <div className="text-gray-500 text-xs">Esperado (Ventas)</div>
                                <div className="font-bold">{formatCurrency(item.expectedAmount)}</div>
                              </div>
                              <div>
                                <div className="text-gray-500 text-xs">Real (Cierre)</div>
                                <div className="font-bold">{formatCurrency(item.actualAmount ?? item.expectedAmount)}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded border-2 border-blue-200 mt-2">
                        <span className="font-bold text-lg">Total Ventas Esperado</span>
                        <span className="font-bold text-xl text-blue-600">
                          {formatCurrency(closedShiftReport.summaryItems.reduce((sum: number, i: any) => sum + i.expectedAmount, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Discounts Summary */}
                {closedShiftReport.discountsTotal > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Descuentos aplicados</h3>
                    <div className="p-4 border rounded-lg bg-gray-50 flex items-center justify-between">
                      <div className="text-sm text-gray-600">Total descuentos</div>
                      <div className="text-xl font-bold text-orange-600">{formatCurrency(closedShiftReport.discountsTotal)}</div>
                    </div>
                    {Array.isArray(closedShiftReport.discountsByInvoice) && closedShiftReport.discountsByInvoice.length > 0 && (
                      <div className="mt-3 border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Factura</TableHead>
                              <TableHead className="text-right">Descuento</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closedShiftReport.discountsByInvoice.map((d: any) => (
                              <TableRow key={d.invoiceNumber}>
                                <TableCell className="font-mono text-sm">{d.invoiceNumber}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(d.discountTotal)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {/* Cash Movements */}
                {closedShiftReport.movements && closedShiftReport.movements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Movimientos de Efectivo</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Razón</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closedShiftReport.movements.map((movement: any) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-sm">{formatDate(movement.createdAt)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${movement.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {movement.type === 'IN' ? 'Entrada' : 'Salida'}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(movement.amount)}</TableCell>
                            <TableCell className="text-sm">{movement.reason || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Payments List */}
                {closedShiftReport.payments && closedShiftReport.payments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Pagos del Turno</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Factura</TableHead>
                          <TableHead>Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closedShiftReport.payments.map((payment: any) => {
                          const Icon = getPaymentMethodIcon(payment.method)
                          return (
                            <TableRow key={payment.id}>
                              <TableCell className="text-sm">{formatDate(payment.createdAt)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{payment.method}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{payment.invoiceNumber || '-'}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Notes */}
                {closedShiftReport.notes && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Notas</h3>
                    <div className="p-3 bg-gray-50 rounded text-sm">{closedShiftReport.notes}</div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowReportDialog(false)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Turno de Caja</DialogTitle>
            <DialogDescription className="sr-only">Ingrese el monto inicial de efectivo para abrir un nuevo turno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Efectivo Inicial</label>
              <Input
                type="number"
                step="0.01"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ingrese el monto de efectivo con el que inicia el turno
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleOpenShift}
              disabled={openShiftMutation.isPending}
            >
              {openShiftMutation.isPending ? 'Abriendo...' : 'Abrir Turno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Turno de Caja</DialogTitle>
            <DialogDescription className="sr-only">Ingrese el efectivo contado para cerrar el turno actual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Efectivo Esperado</label>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(activeShift?.expectedCash || 0)}
              </div>
            </div>

            {activeShift?.summaryItems && activeShift.summaryItems.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/50 text-xs space-y-1">
                <div className="font-semibold mb-1 text-foreground">Resumen de ingresos (Ventas):</div>
                {activeShift.summaryItems.map((item: any) => (
                  <div key={item.paymentMethodId} className="flex justify-between">
                    <span className="text-muted-foreground">{item.paymentMethodName}:</span>
                    <span className="font-medium">{formatCurrency(item.expectedAmount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Efectivo Contado *</label>
              <Input
                type="number"
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Input
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Observaciones..."
                className="mt-1"
              />
            </div>
            {countedCash && activeShift && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Diferencia:</div>
                <div
                  className={`text-xl font-bold ${parseFloat(countedCash) - (activeShift.expectedCash || 0) === 0
                    ? 'text-green-600'
                    : parseFloat(countedCash) - (activeShift.expectedCash || 0) > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                    }`}
                >
                  {formatCurrency(
                    parseFloat(countedCash) - (activeShift.expectedCash || 0)
                  )}
                </div>
              </div>
            )}
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleCloseShift}
              disabled={closeShiftMutation.isPending}
            >
              {closeShiftMutation.isPending ? 'Cerrando...' : 'Cerrar Turno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {movementType === 'IN' ? 'Entrada' : 'Salida'} de Efectivo
            </DialogTitle>
            <DialogDescription className="sr-only">Registre un movimiento de efectivo en la caja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Monto *</label>
              <Input
                type="number"
                step="0.01"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Razón (opcional)</label>
              <Input
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Descripción del movimiento..."
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateMovement}
              disabled={createMovementMutation.isPending}
            >
              {createMovementMutation.isPending
                ? 'Registrando...'
                : `Registrar ${movementType === 'IN' ? 'Entrada' : 'Salida'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RestaurantAccountsSection() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['restaurant-open-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/pos/cashier/open-accounts', {
        headers: { 'x-tenant-id': (window as any).__TENANT_ID__ || '' }
      })
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 15000 
  })

  if (!accounts || accounts.length === 0) return null

  return (
    <div className="space-y-4 mb-8 bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50" />
      <div className="flex items-center gap-3 text-xl font-black text-orange-600 relative z-10">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Utensils className="h-6 w-6" />
        </div>
        <span>Cuentas de Restaurante activas</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
        {accounts.map((session: any) => (
          <div key={session.id} className="group p-5 border rounded-2xl bg-gradient-to-br from-orange-50/50 to-white border-orange-200 hover:border-orange-400 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex justify-between items-start mb-3">
              <div className="font-extrabold text-2xl text-gray-800 tracking-tight">Mesa {session.table?.number}</div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] px-2 py-1 bg-orange-500 text-white rounded-full font-black uppercase tracking-widest shadow-sm">
                  {new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[9px] text-orange-400 font-bold mt-1">HACE {Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000)} MIN</span>
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                {session.waiter?.name?.charAt(0) || 'M'}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Atendido por</div>
                <div className="font-bold text-gray-700">{session.waiter?.name || 'Mesero'}</div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-orange-100">
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total</div>
              <div className="text-2xl font-black text-orange-600 group-hover:scale-110 transition-transform">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(session.totalAmount)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

