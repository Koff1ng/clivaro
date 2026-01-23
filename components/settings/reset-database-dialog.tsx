'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useMutation } from '@tanstack/react-query'

export function ResetDatabaseDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const { toast } = useToast()

    const EXPECTED_TEXT = 'confirmar reset'

    const resetMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/data/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al resetear la base de datos')
            }

            return res.json()
        },
        onSuccess: () => {
            toast('Base de datos reseteada exitosamente', 'success')
            setIsOpen(false)
            setConfirmText('')
            // Reload page to reflect empty state if necessary or just show toast
            window.location.reload()
        },
        onError: (error: any) => {
            toast(error.message || 'No se pudo resetear la base de datos', 'error')
        }
    })

    const handleConfirm = () => {
        if (confirmText.toLowerCase() !== EXPECTED_TEXT) return
        resetMutation.mutate()
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive">
                    Resetear Base de Datos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        ¿Estás absolutamente seguro?
                    </DialogTitle>
                    <DialogDescription className="space-y-3 pt-2">
                        <p>
                            Esta acción <strong>no se puede deshacer</strong>. Esto eliminará permanentemente:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            <li>Todos los productos e inventario</li>
                            <li>Todas las ventas, facturas y cotizaciones</li>
                            <li>Todos los clientes y proveedores</li>
                            <li>Todos los movimientos de caja</li>
                        </ul>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                            Los usuarios y la configuración de la empresa se conservarán.
                        </p>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="confirm-reset" className="text-red-600 font-medium">
                            Escribe "{EXPECTED_TEXT}" para confirmar
                        </Label>
                        <Input
                            id="confirm-reset"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={EXPECTED_TEXT}
                            className="border-red-200 focus-visible:ring-red-500"
                        />
                    </div>
                </div>

                <DialogFooter className="sm:justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        disabled={resetMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={confirmText.toLowerCase() !== EXPECTED_TEXT || resetMutation.isPending}
                    >
                        {resetMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reseteando...</>
                        ) : (
                            'Confirmar Reset'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
