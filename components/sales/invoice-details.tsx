'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { FileText, Mail, Phone, MapPin, QrCode, Download, CheckCircle, XCircle, Clock, Printer, Ban, MoreVertical, FileDown, Receipt, Usb, Network, Eye, PackageX, DollarSign, AlertTriangle } from 'lucide-react'
import { InvoicePrint } from './invoice-print'
import { InvoicePrintLetter } from './invoice-print-letter'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useThermalPrint, useLetterPrint } from '@/lib/hooks/use-thermal-print'
import { useEscPosPrint } from '@/lib/hooks/use-escpos-print'
import { PrinterSetupDialog } from '@/components/ui/printer-setup-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'

export function InvoiceDetails({ invoice }: { invoice: any }) {
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch settings for printers
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
    staleTime: 5 * 60 * 1000 // 5 min
  })

  let configuredPrinters: any[] = []
  try {
    configuredPrinters = settingsData?.settings?.customSettings
      ? JSON.parse(settingsData.settings.customSettings)?.printing?.printers || []
      : []
  } catch { configuredPrinters = [] }

  const lanPrinters = Array.isArray(configuredPrinters)
    ? configuredPrinters.filter((p: any) => p.active && (p.interfaceType === 'lan' || p.type === 'thermal'))
    : []
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showPartialReturn, setShowPartialReturn] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [refundMode, setRefundMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE')
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [refundPayments, setRefundPayments] = useState<Array<{ id: string; method: 'CASH' | 'CARD' | 'TRANSFER'; amount: string }>>([
    { id: 'r1', method: 'CASH', amount: '' },
  ])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printType, setPrintType] = useState<'thermal' | 'normal'>('thermal')

  // Abonos / Pagos parciales
  const [showAbonoDialog, setShowAbonoDialog] = useState(false)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoMethod, setAbonoMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [abonoReference, setAbonoReference] = useState('')
  const [abonoNotes, setAbonoNotes] = useState('')

  const [isLoadingPDF, setIsLoadingPDF] = useState(false)

  // (Removed dead sendToAlegraMutation — system uses Factus now)

  // Print hooks for proper dimensions
  const { print: printThermal } = useThermalPrint({ targetId: 'invoice-thermal-print', widthMm: 80 })
  const { print: printLetter } = useLetterPrint({ targetId: 'invoice-letter-print' })

  // ESC/POS direct thermal printing
  const {
    isSupported: escposSupported,
    status: escposStatus,
    printInvoice: printEscPos,
    error: escposError
  } = useEscPosPrint({ openDrawer: true })

  // Company data for ESC/POS printing
  const settings = settingsData?.settings
  let companyRegime = process.env.NEXT_PUBLIC_COMPANY_REGIME || 'Responsable de IVA'
  try {
    if (settings?.customSettings) {
      const custom = typeof settings.customSettings === 'string'
        ? JSON.parse(settings.customSettings)
        : settings.customSettings
      if (custom.identity?.regime) companyRegime = custom.identity.regime
    }
  } catch (e) { }

  const company = {
    name: settings?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA',
    taxId: settings?.companyNit || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1',
    address: settings?.companyAddress || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
    city: settings?.companyCity || process.env.NEXT_PUBLIC_COMPANY_CITY || '',
    phone: settings?.companyPhone || process.env.NEXT_PUBLIC_COMPANY_PHONE || '',
    email: settings?.companyEmail || process.env.NEXT_PUBLIC_COMPANY_EMAIL || '',
    regime: companyRegime,
  }

  // Handle ESC/POS print
  const handlePrintEscPos = async () => {
    if (escposStatus !== 'connected') {
      toast('Conecta una impresora primero usando el botón de configuración', 'warning')
      return
    }

    try {
      const invoiceData = {
        number: invoice.number,
        prefix: invoice.prefix,
        customer: {
          name: invoice.customer?.name || 'CONSUMIDOR FINAL',
          taxId: invoice.customer?.taxId,
          address: invoice.customer?.address,
          phone: invoice.customer?.phone,
          email: invoice.customer?.email,
        },
        items: (invoice.items || []).map((item: any) => ({
          product: {
            name: item.product?.name || 'Producto',
            sku: item.product?.sku,
          },
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          taxRate: item.taxRate || 0,
          subtotal: item.subtotal || 0,
        })),
        subtotal: invoice.subtotal || 0,
        discount: invoice.discount || 0,
        tax: invoice.tax || 0,
        total: invoice.total || 0,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        payments: invoice.payments,
        cufe: invoice.cufe,
        electronicStatus: invoice.electronicStatus,
        notes: invoice.notes,
      }

      const success = await printEscPos(invoiceData, company)
      if (success) {
        toast('Ticket impreso correctamente', 'success')
      } else {
        toast(escposError || 'Error al imprimir', 'error')
      }
    } catch (error: any) {
      toast(error.message || 'Error al imprimir', 'error')
    }
  }

  const handlePrintThermal = () => {
    try {
      printThermal()
    } catch {
      toast('No se pudo iniciar la impresión', 'error')
    }
  }

  const handlePrintLetter = () => {
    try {
      printLetter()
    } catch {
      toast('No se pudo iniciar la impresión', 'error')
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) {
        throw new Error('Error al generar PDF')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Factura-${invoice.number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast('PDF descargado exitosamente', 'success')
    } catch (error: any) {
      toast(error.message || 'Error al descargar PDF', 'error')
    }
  }

  const handlePrintLanWithIp = async (ip: string) => {
    try {
      toast(`Enviando a ${ip}...`, 'info')
      const res = await fetch(`/api/invoices/${invoice.id}/print-lan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerInterface: ip }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al imprimir en LAN')
      }

      toast('Impresión LAN enviada correctamente', 'success')
    } catch (error: any) {
      toast(error.message || 'Error de impresión LAN', 'error')
    }
  }

  const handlePrintLan = async () => {
    const printerIp = localStorage.getItem('printer_lan_ip')
    if (!printerIp) {
      toast('Configura la IP de la impresora LAN primero', 'warning')
      return
    }
    await handlePrintLanWithIp(printerIp)
  }

  const handlePrintOption = (type: 'thermal' | 'normal') => {
    setPrintType(type)
    if (type === 'thermal') {
      handlePrintThermal()
    } else {
      handlePrintLetter()
    }
  }

  // === ALL HOOKS MUST BE ABOVE THIS LINE ===
  // Mutations defined here before any early returns to comply with React hooks rules
  const sendElectronicMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${invoice?.id}/send-electronic`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al enviar factura')
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast(`Factura enviada exitosamente. CUFE: ${result.cufe}${result.note ? ` - ${result.note}` : ''}`, 'success')
      router.push('/dashboard/electronic-invoicing')
    },
  })

  const voidInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${invoice?.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Error al anular la factura')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      toast('Factura anulada y reversada correctamente', 'success')
      setShowVoidDialog(false)
      setVoidReason('')
      window.location.reload()
    },
  })

  const partialReturnMutation = useMutation({
    mutationFn: async () => {
      const invoiceItemsSafe = Array.isArray(invoice?.items) ? invoice.items : []
      const items = invoiceItemsSafe
        .map((it: any) => ({ invoiceItemId: it.id, quantity: Number(returnQty[it.id] || 0) }))
        .filter((x: any) => x.quantity > 0)

      const normalizedRefund = refundPayments
        .map((p) => ({ method: p.method, amount: parseFloat(p.amount || '0') }))
        .filter((p) => !isNaN(p.amount) && p.amount > 0)

      const res = await fetch(`/api/invoices/${invoice?.id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: returnReason,
          warehouseId,
          ...(refundMode === 'SPLIT'
            ? { refundPayments: normalizedRefund }
            : { refundMethod }),
          items,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al crear devolución')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      toast('Devolución parcial registrada', 'success')
      setShowPartialReturn(false)
      setReturnReason('')
      setReturnQty({})
      setRefundMode('SINGLE')
      setRefundMethod('CASH')
      setRefundPayments([{ id: 'r1', method: 'CASH', amount: '' }])
      window.location.reload()
    },
  })

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${invoice?.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(abonoAmount),
          method: abonoMethod,
          reference: abonoReference || null,
          notes: abonoNotes || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al registrar el pago')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice?.id] })
      toast('Pago registrado exitosamente', 'success')
      setShowAbonoDialog(false)
      setAbonoAmount('')
      setAbonoReference('')
      setAbonoNotes('')
      window.location.reload()
    },
    onError: (err: any) => {
      toast(err.message, 'error')
    }
  })

  // Guard: validate invoice data exists (placed AFTER all hooks)
  if (!invoice) {
    return <div className="p-8 text-center text-red-600">Error: No se pudo cargar la factura</div>
  }

  const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : []
  const hasItems = invoiceItems.length > 0
  const issuedDate = invoice?.issuedAt || invoice?.createdAt

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EMITIDA':
      case 'ISSUED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'PAGADA':
      case 'PAID': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'ANULADA':
      case 'VOID': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'EN_COBRANZA':
      case 'PARCIAL':
      case 'PARTIAL': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      EMITIDA: 'Emitida',
      PAGADA: 'Pagada',
      ANULADA: 'Anulada',
      EN_COBRANZA: 'En Cobranza',
      // Compatibilidad con estados antiguos
      ISSUED: 'Emitida',
      PAID: 'Pagada',
      VOID: 'Anulada',
      PARCIAL: 'En Cobranza',
      PARTIAL: 'En Cobranza',
    }
    return labels[status] || status
  }

  const getElectronicStatusInfo = () => {
    if (!invoice.electronicStatus) {
      return { label: 'No enviada', color: 'text-gray-600', icon: Clock }
    }
    switch (invoice.electronicStatus) {
      case 'SENT':
        return { label: 'Enviada a DIAN', color: 'text-blue-600', icon: Clock }
      case 'ACCEPTED':
        return { label: 'Aceptada por DIAN', color: 'text-green-600', icon: CheckCircle }
      case 'REJECTED':
        return { label: 'Rechazada por DIAN', color: 'text-red-600', icon: XCircle }
      default:
        return { label: 'Pendiente', color: 'text-yellow-600', icon: Clock }
    }
  }

  const electronicStatus = getElectronicStatusInfo()
  const StatusIcon = electronicStatus.icon
  const isVoided = invoice.status === 'ANULADA' || invoice.status === 'VOID'
  const blockedByDian = invoice.electronicStatus === 'SENT' || invoice.electronicStatus === 'ACCEPTED'

  const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
  const balance = Math.max(0, invoice.total - totalPaid)

  const partialReturnTotal = invoiceItems.reduce((sum: number, it: any) => {
    const qty = Number(returnQty[it.id] || 0)
    if (!qty) return sum
    const unitNet = it.unitPrice * (1 - (it.discount || 0) / 100)
    const lineSubtotal = unitNet * qty
    const lineTax = lineSubtotal * ((it.taxRate || 0) / 100)
    return sum + (lineSubtotal + lineTax)
  }, 0)

  const refundPaid = refundPayments
    .map((p) => parseFloat(p.amount || '0'))
    .filter((n) => !isNaN(n) && n > 0)
    .reduce((sum, n) => sum + n, 0)

  useEffect(() => {
    if (!showPartialReturn) return
      ; (async () => {
        try {
          const res = await fetch('/api/warehouses')
          const data = res.ok ? await res.json() : []
          const list = Array.isArray(data) ? data : []
          setWarehouses(list)
          if (!warehouseId && list.length) setWarehouseId(list[0].id)
        } catch {
          setWarehouses([])
        }
      })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPartialReturn])

  return (
    <>
      {/* Vista para impresión térmica (80mm) - oculta en pantalla */}
      <div id="invoice-thermal-print" className="hidden">
        <InvoicePrint invoice={invoice} settings={settingsData?.settings} />
      </div>

      {/* Vista para impresión carta - oculta en pantalla */}
      <div id="invoice-letter-print" className="hidden">
        <InvoicePrintLetter invoice={invoice} settings={settingsData?.settings} />
      </div>

      {/* Vista normal en pantalla */}
      <div className="space-y-6 print:hidden">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-900 border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">{invoice.number}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                  {invoice.status === 'PAGADA' || invoice.status === 'PAID'
                    ? <CheckCircle className="h-3.5 w-3.5" />
                    : invoice.status === 'ANULADA' || invoice.status === 'VOID'
                      ? <XCircle className="h-3.5 w-3.5" />
                      : <Clock className="h-3.5 w-3.5" />}
                  {getStatusLabel(invoice.status)}
                </span>
              </div>
              {invoice.electronicStatus && (
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${electronicStatus.color}`} />
                  <span className={`text-sm font-medium ${electronicStatus.color}`}>{electronicStatus.label}</span>
                </div>
              )}
              {invoice.customer?.name && (
                <p className="text-sm text-muted-foreground">Cliente: <span className="font-medium text-foreground">{invoice.customer.name}</span></p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Primary actions */}
              {balance > 0 && !isVoided && (
                <Button
                  onClick={() => {
                    setAbonoAmount(balance.toString())
                    setShowAbonoDialog(true)
                  }}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  Registrar Abono
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-1.5" />
                PDF
              </Button>

              {/* More actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Imprimir</DropdownMenuLabel>
                  {escposSupported && escposStatus === 'connected' && (
                    <DropdownMenuItem onClick={handlePrintEscPos}>
                      <Usb className="h-4 w-4 mr-2" />
                      Ticket POS (USB)
                    </DropdownMenuItem>
                  )}
                  {lanPrinters.length > 0 ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Network className="h-4 w-4 mr-2" />
                        Imprimir LAN
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {lanPrinters.map((p: any) => (
                            <DropdownMenuItem key={p.id} onClick={() => handlePrintLanWithIp(p.interfaceConfig)}>
                              <Printer className="h-4 w-4 mr-2" />
                              {p.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handlePrintLan}>
                            Otra IP (Manual)
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ) : (
                    <DropdownMenuItem onClick={handlePrintLan}>
                      <Network className="h-4 w-4 mr-2" />
                      Imprimir LAN
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handlePrintOption('thermal')}>
                    <Printer className="h-4 w-4 mr-2" />
                    Tirilla (80mm)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintOption('normal')}>
                    <Printer className="h-4 w-4 mr-2" />
                    Hoja A4
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowTicketPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Vista previa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Facturación Electrónica</DropdownMenuLabel>
                  {(!invoice.electronicStatus || invoice.electronicStatus === 'PENDING') && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (!settingsData?.settings?.electronicBillingProvider) {
                          toast('Configura el proveedor de facturación electrónica en Ajustes.', 'error')
                          router.push('/settings?tab=billing')
                          return
                        }
                        if (confirm('¿Enviar esta factura a facturación electrónica DIAN?')) {
                          sendElectronicMutation.mutate()
                        }
                      }}
                      disabled={sendElectronicMutation.isPending}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Enviar a DIAN
                    </DropdownMenuItem>
                  )}
                  {invoice.cufe && (
                    <DropdownMenuItem onClick={() => window.open(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${invoice.cufe}`, '_blank')}>
                      <Download className="h-4 w-4 mr-2" />
                      Verificar en DIAN
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                  {blockedByDian && !isVoided && (
                    <DropdownMenuItem
                      onClick={() => router.push(`/credit-notes?invoiceId=${invoice.id}`)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Crear Nota Crédito
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setShowPartialReturn(true)}
                    disabled={isVoided || blockedByDian}
                  >
                    <PackageX className="h-4 w-4 mr-2" />
                    Devolución parcial
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowVoidDialog(true)}
                    disabled={isVoided || blockedByDian}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Anular factura
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {escposSupported && (
                <PrinterSetupDialog />
              )}
            </div>
          </div>
        </div>

        {/* Vista previa del ticket */}
        <Dialog open={showTicketPreview} onOpenChange={setShowTicketPreview}>
          <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Vista previa (ticket)
              </DialogTitle>
              <DialogDescription className="sr-only">Vista previa del ticket de impresión para la factura</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <div className="bg-white p-2 rounded border">
                <InvoicePrint invoice={invoice} settings={settingsData?.settings} />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Anular / Devolver */}
        <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
          <DialogContent className="w-auto sm:max-w-fit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Anular / Devolver
              </DialogTitle>
              <DialogDescription className="sr-only">Formulario para anular o devolver esta factura</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {blockedByDian ? (
                <div className="text-sm text-red-600">
                  Esta factura está enviada/aceptada por DIAN. Para reversar, debes generar una Nota Crédito (no anulación directa).
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Esta acción marcará la factura como <b>ANULADA</b>, reintegrará stock (si la venta generó movimientos) y,
                  si hubo pago en efectivo, registrará una salida de caja.
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Motivo (obligatorio)</label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Ej: devolución por garantía / error de digitación / cliente canceló…"
                  className="mt-2"
                  disabled={blockedByDian || isVoided}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowVoidDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={blockedByDian || isVoided || voidReason.trim().length < 3 || voidInvoiceMutation.isPending}
                  onClick={() => {
                    if (confirm(`¿Confirmas anular la factura ${invoice.number}?`)) {
                      voidInvoiceMutation.mutate()
                    }
                  }}
                >
                  {voidInvoiceMutation.isPending ? 'Procesando…' : 'Confirmar'}
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                Requiere permisos: <code>void_invoices</code> o <code>manage_returns</code>.
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Devolución parcial */}
        <Dialog open={showPartialReturn} onOpenChange={setShowPartialReturn}>
          <DialogContent className="w-auto sm:max-w-fit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageX className="h-5 w-5" />
                Devolución parcial
              </DialogTitle>
              <DialogDescription className="sr-only">Formulario para registrar una devolución parcial de productos</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {blockedByDian && (
                <div className="text-sm text-red-600">
                  Esta factura está enviada/aceptada por DIAN. Para devoluciones debes emitir Nota Crédito.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Almacén (reingreso stock)</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Método de reembolso</label>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant={refundMode === 'SINGLE' ? 'default' : 'outline'}
                      onClick={() => setRefundMode('SINGLE')}
                      className="flex-1"
                    >
                      Simple
                    </Button>
                    <Button
                      type="button"
                      variant={refundMode === 'SPLIT' ? 'default' : 'outline'}
                      onClick={() => setRefundMode('SPLIT')}
                      className="flex-1"
                    >
                      Mixto
                    </Button>
                  </div>
                  {refundMode === 'SINGLE' ? (
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value as any)}
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                    </select>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {refundPayments.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <select
                            value={p.method}
                            onChange={(e) => {
                              const m = e.target.value as any
                              setRefundPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, method: m } : x)))
                            }}
                            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            value={p.amount}
                            onChange={(e) => {
                              const val = e.target.value
                              setRefundPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, amount: val } : x)))
                            }}
                            placeholder="0.00"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRefundPayments((prev) => [...prev, { id: `r${Date.now()}`, method: 'CARD', amount: '' }])}
                          >
                            +
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setRefundPayments((prev) => prev.filter((x) => x.id !== p.id))}
                            disabled={refundPayments.length <= 1}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Reembolso:</span>
                        <span className={Math.abs(refundPaid - partialReturnTotal) <= 0.01 ? 'text-green-600 font-semibold' : ''}>
                          {formatCurrency(refundPaid)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Motivo (obligatorio)</label>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Ej: producto defectuoso / error de digitación / cambio..."
                  className="mt-2"
                  disabled={blockedByDian || isVoided}
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="w-[120px] text-right">Vendida</TableHead>
                      <TableHead className="w-[160px] text-right">Devolver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((it: any) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="font-medium">{it.product?.name || it.productId}</div>
                          <div className="text-xs text-gray-500">{it.variantId ? `Variante: ${it.variantId}` : ''}</div>
                        </TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">
                          <input
                            type="number"
                            min={0}
                            max={it.quantity}
                            step="1"
                            value={String(returnQty[it.id] ?? 0)}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(Number(it.quantity), Number(e.target.value || 0)))
                              setReturnQty((prev) => ({ ...prev, [it.id]: v }))
                            }}
                            className="h-9 w-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                            disabled={blockedByDian || isVoided}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total devolución: <b>{formatCurrency(partialReturnTotal)}</b>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPartialReturn(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={
                      blockedByDian ||
                      isVoided ||
                      !warehouseId ||
                      returnReason.trim().length < 3 ||
                      partialReturnTotal <= 0 ||
                      (refundMode === 'SPLIT' && Math.abs(refundPaid - partialReturnTotal) > 0.01) ||
                      partialReturnMutation.isPending
                    }
                    onClick={() => {
                      if (confirm(`¿Confirmas la devolución parcial por ${formatCurrency(partialReturnTotal)}?`)) {
                        partialReturnMutation.mutate()
                      }
                    }}
                  >
                    {partialReturnMutation.isPending ? 'Procesando…' : 'Confirmar devolución'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Facturación Electrónica Info */}
        {invoice.cufe && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Facturación Electrónica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">CUFE</span>
                <div className="font-mono text-xs break-all mt-1 bg-white dark:bg-gray-900 p-2 rounded border">{invoice.cufe}</div>
              </div>
              <div className="space-y-2">
                {invoice.electronicSentAt && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Fecha envío</span>
                    <div className="mt-1 font-medium">{formatDate(invoice.electronicSentAt)}</div>
                  </div>
                )}
                {invoice.resolutionNumber && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Resolución DIAN</span>
                    <div className="mt-1 font-medium">{invoice.resolutionNumber}</div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${invoice.cufe}`, '_blank')}
                >
                  <QrCode className="h-4 w-4 mr-1.5" />
                  Verificar en DIAN
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Customer & Document Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900 border rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Cliente</h3>
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-base">{invoice.customer?.name || 'Cliente General'}</div>
              {invoice.customer?.taxId && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>NIT: {invoice.customer.taxId}</span>
                </div>
              )}
              {invoice.customer?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{invoice.customer.email}</span>
                </div>
              )}
              {invoice.customer?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{invoice.customer.phone}</span>
                </div>
              )}
              {invoice.customer?.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{invoice.customer.address}</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Documento</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha Emisión:</span>
                <span className="font-semibold">
                  {issuedDate ? (
                    <>
                      {formatDate(issuedDate)}
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(issuedDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-500">No disponible</span>
                  )}
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimiento:</span>
                  <span>{formatDate(invoice.dueDate)}</span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Pago:</span>
                  <span className="text-green-600 font-medium">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-gray-900 border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Productos ({invoiceItems.length})</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center w-[70px]">Cant.</TableHead>
                <TableHead className="text-right">P. Unit.</TableHead>
                <TableHead className="text-center w-[70px]">Dcto.</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasItems ? (
                invoiceItems.map((item: any, index: number) => {
                  const itemTax = item.lineTaxes && item.lineTaxes.length > 0
                    ? item.lineTaxes.reduce((sum: number, lt: any) => sum + (lt.taxAmount || 0), 0)
                    : (item.subtotal * (item.taxRate || 0) / 100)

                  return (
                    <TableRow key={item.id || `item-${index}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.product?.sku || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.product?.name || 'Producto'}</div>
                        {item.variant?.name && (
                          <div className="text-xs text-muted-foreground">{item.variant.name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-center">{item.discount > 0 ? `${item.discount}%` : '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(itemTax)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay productos en esta factura
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 bg-white dark:bg-gray-900 border rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency((invoice.subtotal || 0) + (invoice.discount || 0))}</span>
            </div>
            {(invoice.discount || 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>(-) Descuento:</span>
                <span>{formatCurrency(invoice.discount)}</span>
              </div>
            )}

            {/* Tax Breakdown */}
            {invoice.taxSummary && invoice.taxSummary.length > 0 ? (
              invoice.taxSummary.map((ts: any) => (
                <div key={ts.id} className="flex justify-between text-muted-foreground text-xs">
                  <span>{ts.name} ({ts.rate}%):</span>
                  <span>{formatCurrency(ts.taxAmount)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impuestos:</span>
                <span>{formatCurrency(invoice.tax || 0)}</span>
              </div>
            )}

            <div className="flex justify-between border-t pt-3 font-bold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(invoice.total || 0)}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between text-orange-600 font-semibold bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2">
                <span>Saldo:</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Pagos ({invoice.payments.length})</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        payment.method === 'CASH' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        payment.method === 'CARD' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        payment.method === 'TRANSFER' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.method === 'CASH' ? 'Efectivo' :
                          payment.method === 'CARD' ? 'Tarjeta' :
                            payment.method === 'TRANSFER' ? 'Transferencia' :
                              payment.method === 'CHECK' ? 'Cheque' : payment.method}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.createdBy?.name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {invoice.notes && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm text-amber-800 dark:text-amber-200">Notas</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Dialogo para registrar abono */}
        <Dialog open={showAbonoDialog} onOpenChange={setShowAbonoDialog}>
          <DialogContent className="w-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Registrar Abono / Pago
              </DialogTitle>
              <DialogDescription className="sr-only">Formulario para registrar un pago parcial o total a esta factura</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">Saldo Pendiente:</span>
                <span className="font-bold text-lg text-orange-600">{formatCurrency(balance)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Monto a abonar</label>
                <input
                  type="number"
                  step="0.01"
                  max={balance}
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right font-bold"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Método de pago</label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Referencia (opcional)</label>
                <input
                  type="text"
                  value={abonoReference}
                  onChange={(e) => setAbonoReference(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Número de comprobante..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notas</label>
                <Textarea
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  placeholder="Detalles adicionales del pago..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAbonoDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!abonoAmount || parseFloat(abonoAmount) <= 0 || parseFloat(abonoAmount) > balance + 0.01 || createPaymentMutation.isPending}
                  onClick={() => createPaymentMutation.mutate()}
                >
                  {createPaymentMutation.isPending ? 'Registrando...' : 'Confirmar Pago'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

