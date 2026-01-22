'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEscPosPrint } from '@/lib/hooks/use-escpos-print'
import { Printer, Usb, Wifi, WifiOff, Check, X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

interface PrinterSetupDialogProps {
    trigger?: React.ReactNode
    onPrinterConnected?: () => void
}

export function PrinterSetupDialog({ trigger, onPrinterConnected }: PrinterSetupDialogProps) {
    const [open, setOpen] = useState(false)
    const {
        isSupported,
        status,
        printerInfo,
        savedPrinters,
        error,
        selectPrinter,
        connectToSaved,
        disconnect,
        printTest,
        refreshSavedPrinters,
    } = useEscPosPrint()

    const company = {
        name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA',
        taxId: process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1',
        address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
        phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '',
    }

    const handleSelectPrinter = async () => {
        const success = await selectPrinter()
        if (success && onPrinterConnected) {
            onPrinterConnected()
        }
    }

    const handleConnectSaved = async (printer: any) => {
        const success = await connectToSaved(printer)
        if (success && onPrinterConnected) {
            onPrinterConnected()
        }
    }

    const handlePrintTest = async () => {
        await printTest(company)
    }

    const StatusIcon = () => {
        switch (status) {
            case 'connected':
                return <Check className="h-4 w-4 text-green-500" />
            case 'connecting':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            case 'printing':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            case 'error':
                return <X className="h-4 w-4 text-red-500" />
            default:
                return <WifiOff className="h-4 w-4 text-gray-400" />
        }
    }

    const statusText = {
        disconnected: 'Desconectada',
        connecting: 'Conectando...',
        connected: 'Conectada',
        printing: 'Imprimiendo...',
        error: 'Error',
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Printer className="h-4 w-4" />
                        <span className="hidden sm:inline">Configurar Impresora</span>
                        <StatusIcon />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Configuración de Impresora Térmica
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Browser Support Check */}
                    {!isSupported && (
                        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium">Navegador no compatible</p>
                                <p className="text-amber-700 mt-1">
                                    WebSerial API no está disponible. Usa Chrome o Edge para conectar impresoras USB.
                                </p>
                            </div>
                        </div>
                    )}

                    {isSupported && (
                        <>
                            {/* Current Status */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${status === 'connected' ? 'bg-green-100' :
                                            status === 'connecting' || status === 'printing' ? 'bg-blue-100' :
                                                status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                                        }`}>
                                        <Printer className="h-5 w-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {printerInfo?.name || 'Sin impresora'}
                                        </p>
                                        <p className={`text-xs ${status === 'connected' ? 'text-green-600' :
                                                status === 'error' ? 'text-red-600' : 'text-gray-500'
                                            }`}>
                                            {statusText[status]}
                                        </p>
                                    </div>
                                </div>
                                <StatusIcon />
                            </div>

                            {/* Error Display */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                                {status === 'connected' ? (
                                    <>
                                        <Button
                                            onClick={handlePrintTest}
                                            variant="outline"
                                            className="w-full justify-start gap-2"
                                        >
                                            <Printer className="h-4 w-4" />
                                            Imprimir Prueba
                                        </Button>
                                        <Button
                                            onClick={disconnect}
                                            variant="outline"
                                            className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                                        >
                                            <WifiOff className="h-4 w-4" />
                                            Desconectar
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={handleSelectPrinter}
                                        className="w-full justify-start gap-2"
                                        disabled={status === 'connecting'}
                                    >
                                        {status === 'connecting' ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Usb className="h-4 w-4" />
                                        )}
                                        {status === 'connecting' ? 'Conectando...' : 'Seleccionar Impresora USB'}
                                    </Button>
                                )}
                            </div>

                            {/* Saved Printers */}
                            {savedPrinters.length > 0 && status !== 'connected' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-700">Impresoras guardadas</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={refreshSavedPrinters}
                                            className="h-8 w-8 p-0"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="space-y-1">
                                        {savedPrinters.map((printer, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleConnectSaved(printer)}
                                                className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                            >
                                                <Usb className="h-4 w-4 text-gray-400" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate">
                                                        {printer.name}
                                                    </p>
                                                    {printer.vendorId && (
                                                        <p className="text-xs text-gray-500">
                                                            ID: {printer.vendorId.toString(16).toUpperCase()}
                                                        </p>
                                                    )}
                                                </div>
                                                <Wifi className="h-4 w-4 text-gray-300" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Help Text */}
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Conecta tu impresora térmica vía USB</p>
                                <p>• Compatible con Epson, Star, Bixolon y genéricas</p>
                                <p>• El navegador recordará la impresora para futuras sesiones</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end">
                    <DialogClose asChild>
                        <Button variant="outline">Cerrar</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    )
}
