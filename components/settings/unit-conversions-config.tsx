'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight, Info, Pencil, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface UnitConversion {
  from: string
  fromLabel: string
  to: string
  toLabel: string
  multiplier: number
}

const COMMON_UNITS_MAP: Record<string, string> = {
  'UNIT': 'Unidad', 'SERVICE': 'Servicio', 'PIECE': 'Pieza', 'SET': 'Juego/Set',
  'KIT': 'Kit', 'PAIR': 'Par', 'BOX': 'Caja', 'PACK': 'Paquete',
  'DOZEN': 'Docena', 'ROLL': 'Rollo', 'PALLET': 'Estiba',
  'KILO': 'Kilogramo', 'GRAM': 'Gramo', 'MILLIGRAM': 'Miligramo',
  'TON': 'Tonelada', 'POUND': 'Libra', 'OUNCE': 'Onza',
  'LITER': 'Litro', 'MILLILITER': 'Mililitro', 'GALLON': 'Galón',
  'CUBIC_METER': 'Metro Cúbico',
  'METER': 'Metro', 'CENTIMETER': 'Centímetro', 'MILLIMETER': 'Milímetro',
  'INCH': 'Pulgada', 'FOOT': 'Pie', 'YARD': 'Yarda',
  'SQUARE_METER': 'Metro²', 'SQUARE_FOOT': 'Pie²',
}

export function UnitConversionsConfig() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data, isLoading } = useQuery<{ conversions: UnitConversion[] }>({
    queryKey: ['unit-conversions'],
    queryFn: async () => {
      const res = await fetch('/api/settings/unit-conversions')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const conversions = data?.conversions || []

  const startEdit = (idx: number, currentMultiplier: number) => {
    setEditingIdx(idx)
    setEditValue(String(currentMultiplier))
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setEditValue('')
  }

  const saveEdit = () => {
    const val = parseFloat(editValue)
    if (isNaN(val) || val <= 0) {
      toast('El multiplicador debe ser un número mayor a 0', 'error')
      return
    }
    // For now, show info — hardcoded defaults can be edited in the code
    toast(`Para cambiar el multiplicador, edita DEFAULT_CONVERSIONS en app/api/pos/products/route.ts. En futuras versiones esto será dinámico desde la BD.`, 'info')
    cancelEdit()
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Conversiones de Unidades de Medida
          </CardTitle>
          <CardDescription>
            Estas conversiones permiten venta fraccionada en el POS. Por ejemplo, si un producto se compra por Docena, 
            el cajero puede vender por Unidad individual y el inventario se descuenta proporcionalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-blue-50/50 p-3 mb-4 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Cuando creas un producto con unidad &quot;Docena&quot;, en el POS aparecerá un selector 
              para vender por &quot;Unidad&quot; con el precio dividido automáticamente entre 12.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidad Origen</TableHead>
                <TableHead className="text-center">→</TableHead>
                <TableHead>Unidad Destino</TableHead>
                <TableHead className="text-right">Multiplicador</TableHead>
                <TableHead className="text-right">Ejemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversions.map((conv, idx) => (
                <TableRow key={`${conv.from}-${conv.to}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{conv.from}</Badge>
                      <span className="text-sm font-medium">{conv.fromLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">→</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{conv.to}</Badge>
                      <span className="text-sm font-medium">{conv.toLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-lg">×{conv.multiplier}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    1 {conv.fromLabel} = {conv.multiplier} {conv.toLabel}{conv.multiplier !== 1 ? 's' : ''}
                  </TableCell>
                </TableRow>
              ))}
              {conversions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay conversiones configuradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cómo funciona la venta fraccionada?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4 bg-green-50/50">
              <div className="font-bold text-green-800 mb-1">1. Crea el producto</div>
              <p className="text-sm text-green-700">
                Al crear un producto, selecciona la unidad de medida (ej: &quot;Docena&quot;, &quot;Caja&quot;, &quot;Paquete&quot;).
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <div className="font-bold text-blue-800 mb-1">2. Vende en el POS</div>
              <p className="text-sm text-blue-700">
                En el carrito del POS aparece un selector de unidad. Cambia de &quot;Original&quot; a &quot;Unidad&quot; para vender individualmente.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-purple-50/50">
              <div className="font-bold text-purple-800 mb-1">3. Inventario automático</div>
              <p className="text-sm text-purple-700">
                El sistema ajusta el inventario automáticamente. Vender 1 unidad de una docena descuenta 1/12 del stock.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
