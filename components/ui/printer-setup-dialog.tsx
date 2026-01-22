import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEscPosPrint } from '@/lib/hooks/use-escpos-print'
import { Printer, Usb, Wifi, WifiOff, Check, X, Loader2, RefreshCw, AlertTriangle, Network } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface PrinterSetupDialogProps {
    trigger?: React.ReactNode
    onPrinterConnected?: () => void
}

export function PrinterSetupDialog({ trigger, onPrinterConnected }: PrinterSetupDialogProps) {
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('usb')
    const [lanIp, setLanIp] = useState('')
    const { toast } = useToast()

    // Load saved LAN IP
    useEffect(() => {
        const savedIp = localStorage.getItem('printer_lan_ip')
        if (savedIp) setLanIp(savedIp)
    }, [])

    const handleSaveLan = () => {
        if (!lanIp) return
        // Basic validation/formatting - ensure it has protocol if missing, default to tcp://
        let formatted = lanIp
        if (!formatted.includes('://')) {
            formatted = `tcp://${formatted}`
        }
        // If no port, valid but might default to 9100 in backend if handled, 
        // but user usually just types IP. Let's assume user types "192.168.1.50" -> "tcp://192.168.1.50:9100"
        // For now, let's just save what they type but add protocol if missing.

        localStorage.setItem('printer_lan_ip', formatted)
        setLanIp(formatted)
        toast('Configuración LAN guardada', 'success')
        if (onPrinterConnected) onPrinterConnected()
        setOpen(false)
    }

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
                        Configuración de Impresora
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="usb" className="flex items-center gap-2">
                            <Usb className="h-4 w-4" /> USB (Directo)
                        </TabsTrigger>
                        <TabsTrigger value="lan" className="flex items-center gap-2">
                            <Network className="h-4 w-4" /> LAN (Red)
                        </TabsTrigger>
                    </TabsList>

                    {/* === USB CONFIG === */}
                    <TabsContent value="usb" className="space-y-4 py-4">
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
                                                {printerInfo?.name || 'Sin impresora USB'}
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
                                                Imprimir Prueba USB
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
                            </>
                        )}
                    </TabsContent>

                    {/* === LAN CONFIG === */}
                    <TabsContent value="lan" className="space-y-4 py-4">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="lan-ip">Dirección IP de la Impresora</Label>
                                <Input
                                    id="lan-ip"
                                    placeholder="Ej: 192.168.1.50:9100"
                                    value={lanIp}
                                    onChange={(e) => setLanIp(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    Formato: tcp://IP:PUERTO (ej: tcp://192.168.1.50:9100)
                                </p>
                            </div>

                            <Button className="w-full" onClick={handleSaveLan}>
                                <Check className="mr-2 h-4 w-4" /> Guardar Configuración LAN
                            </Button>

                            <div className="bg-blue-50 p-3 rounded-lg text-blue-800 text-xs">
                                <p className="font-semibold mb-1">Nota sobre Impresión LAN:</p>
                                <p>La impresión LAN se realiza desde el servidor. Asegúrate de que el servidor tenga acceso a la red de la impresora.</p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
