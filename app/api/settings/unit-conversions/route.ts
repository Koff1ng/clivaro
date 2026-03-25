import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

// Default conversions that match COMMON_UNITS IDs from components/products/unit-select.tsx
const DEFAULT_CONVERSIONS = [
  { from: 'DOZEN', fromLabel: 'Docena', to: 'UNIT', toLabel: 'Unidad', multiplier: 12 },
  { from: 'BOX', fromLabel: 'Caja', to: 'UNIT', toLabel: 'Unidad', multiplier: 12 },
  { from: 'PACK', fromLabel: 'Paquete', to: 'UNIT', toLabel: 'Unidad', multiplier: 10 },
  { from: 'PAIR', fromLabel: 'Par', to: 'UNIT', toLabel: 'Unidad', multiplier: 2 },
  { from: 'KILO', fromLabel: 'Kilogramo', to: 'GRAM', toLabel: 'Gramo', multiplier: 1000 },
  { from: 'POUND', fromLabel: 'Libra', to: 'GRAM', toLabel: 'Gramo', multiplier: 453.592 },
  { from: 'LITER', fromLabel: 'Litro', to: 'MILLILITER', toLabel: 'Mililitro', multiplier: 1000 },
  { from: 'GALLON', fromLabel: 'Galón', to: 'LITER', toLabel: 'Litro', multiplier: 3.785 },
  { from: 'METER', fromLabel: 'Metro', to: 'CENTIMETER', toLabel: 'Centímetro', multiplier: 100 },
  { from: 'FOOT', fromLabel: 'Pie', to: 'INCH', toLabel: 'Pulgada', multiplier: 12 },
  { from: 'YARD', fromLabel: 'Yarda', to: 'FOOT', toLabel: 'Pie', multiplier: 3 },
  { from: 'TON', fromLabel: 'Tonelada', to: 'KILO', toLabel: 'Kilogramo', multiplier: 1000 },
]

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  return NextResponse.json({ conversions: DEFAULT_CONVERSIONS })
}
