import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma as masterPrisma } from '@/lib/db'
import { updateStockLevel, checkStock } from '@/lib/inventory'
import { resolveAllIngredients } from '@/lib/recipes'

export const dynamic = 'force-dynamic'

const paymentEntrySchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  amount: z.number().positive(),
  reference: z.string().optional().nullable(),
})

const closeSessionSchema = z.object({
  customerId: z.string().optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  payments: z.array(paymentEntrySchema).optional(),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
}

async function resolveFallbackCustomerId(tx: any, createdById?: string) {
  const existing = await tx.customer.findFirst({
    where: {
      OR: [{ name: 'Cliente General' }, { taxId: '222222222222' }],
    },
    select: { id: true },
  })

  if (existing?.id) return existing.id

  const created = await tx.customer.create({
    data: {
      name: 'Cliente General',
      taxId: '222222222222',
      idType: 'CC',
      isCompany: false,
      taxRegime: 'SIMPLIFIED',
      createdById: createdById || null,
    },
    select: { id: true },
  })

  return created.id
}

/** Resuelve PaymentMethod para cierre restaurante (alineado con POS legacy). */
async function resolvePaymentMethodForClose(
  tx: any,
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
) {
  const byExactName = await tx.paymentMethod.findFirst({
    where: { active: true, name: method },
  })
  if (byExactName) return byExactName

  if (method === 'CASH') {
    const cash = await tx.paymentMethod.findFirst({
      where: { active: true, type: 'CASH' },
    })
    if (cash) return cash
    return tx.paymentMethod.create({
      data: { name: 'CASH', type: 'CASH', active: true },
    })
  }

  if (method === 'CARD') {
    const card = await tx.paymentMethod.findFirst({
      where: {
        active: true,
        OR: [
          { type: 'CARD' },
          { name: { contains: 'Tarjeta', mode: 'insensitive' as const } },
          { name: { contains: 'CARD', mode: 'insensitive' as const } },
        ],
      },
    })
    if (card) return card
    return tx.paymentMethod.create({
      data: { name: 'CARD', type: 'ELECTRONIC', active: true },
    })
  }

  if (method === 'TRANSFER') {
    const tr = await tx.paymentMethod.findFirst({
      where: {
        active: true,
        OR: [
          { name: { contains: 'Transfer', mode: 'insensitive' as const } },
          { name: { contains: 'TRANSFER', mode: 'insensitive' as const } },
        ],
      },
    })
    if (tr) return tr
    return tx.paymentMethod.create({
      data: { name: 'TRANSFER', type: 'ELECTRONIC', active: true },
    })
  }

  const anyPm = await tx.paymentMethod.findFirst({
    where: { active: true, type: 'ELECTRONIC' },
  })
  if (anyPm) return anyPm
  return tx.paymentMethod.create({
    data: { name: 'OTHER', type: 'ELECTRONIC', active: true },
  })
}

type LineCalc = {
  productId: string
  variantId: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  base: number
  lineTax: number
  gross: number
}

function buildLineCalcs(activeItems: any[]): { lines: LineCalc[]; sumBase: number; sumTax: number; grossTotal: number } {
  const lines: LineCalc[] = []
  let sumBase = 0
  let sumTax = 0
  let grossTotal = 0

  for (const i of activeItems) {
    const gross = i.unitPrice * i.quantity
    const rate = i.product?.taxRate ?? 0
    const base = rate > 0 ? gross / (1 + rate / 100) : gross
    const lineTax = gross - base
    lines.push({
      productId: i.productId,
      variantId: i.variantId ?? null,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: rate,
      base,
      lineTax,
      gross,
    })
    sumBase += base
    sumTax += lineTax
    grossTotal += gross
  }

  return { lines, sumBase, sumTax, grossTotal }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAnyPermission(req as any, [
      PERMISSIONS.MANAGE_SALES,
      PERMISSIONS.MANAGE_CASH,
      PERMISSIONS.MANAGE_RESTAURANT,
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const sessionId = params.id
    const userId = (session.user as any)?.id as string | undefined

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = closeSessionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const prisma = await getTenantPrismaClient(tenantId)

    const tableSession = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orders: {
          include: { items: { include: { product: true } } },
        },
      },
    })

    if (!tableSession || tableSession.status !== 'OPEN') {
      return apiError(404, 'Session not found or already closed')
    }

    const hasPending = tableSession.orders.some(
      (o: any) =>
        o.status === 'PENDING' ||
        o.items.some((i: any) => i.status !== 'SERVED' && i.status !== 'CANCELLED')
    )

    const allItems = tableSession.orders.flatMap((o: any) => o.items)
    const activeItems = allItems.filter((i: any) => i.status !== 'CANCELLED')

    if (activeItems.length === 0) {
      return apiError(400, 'No hay productos activos en la cuenta para facturar')
    }

    const discountAmount = parsed.data.discountAmount ?? 0
    const tipAmt = (tableSession as any).tipAmount ?? 0
    const { lines: lineCalcs, sumBase, sumTax, grossTotal } = buildLineCalcs(activeItems)

    const factor = grossTotal > 0 ? Math.max(0, (grossTotal - discountAmount) / grossTotal) : 1
    const invoiceDiscountExTax = sumBase * (1 - factor)
    const invoiceTax = Math.round(sumTax * factor * 100) / 100
    const invoiceSubtotalExTax = Math.round(sumBase * 100) / 100
    const invoiceTotal = Math.round((sumBase * factor + sumTax * factor + tipAmt) * 100) / 100

    const paymentsData =
      parsed.data.payments && parsed.data.payments.length > 0 ? parsed.data.payments : null
    const paidSum = paymentsData?.reduce((s, p) => s + p.amount, 0) ?? 0

    const tenantSettings = await masterPrisma.tenantSettings.findUnique({
      where: { tenantId },
    })
    const enableRestaurantMode = !!tenantSettings?.enableRestaurantMode

    const warnings: string[] = []
    if (hasPending) warnings.push('Session was closed with pending items')

    const result = await prisma.$transaction(async (tx) => {
      const customerId =
        parsed.data.customerId || (await resolveFallbackCustomerId(tx, userId))

      const invoiceCount = await tx.invoice.count()
      const prefix = tenantSettings?.invoicePrefix || 'FV'
      const format = tenantSettings?.invoiceNumberFormat || '000000'
      const consecutive = String(invoiceCount + 1).padStart(format.length || 6, '0')
      const invoiceNumber = `${prefix}-${consecutive}`

      // Resumen de IVA por tasa (snapshot)
      const taxByRate = new Map<number, { base: number; tax: number }>()
      for (const lc of lineCalcs) {
        const b = lc.base * factor
        const t = lc.lineTax * factor
        const key = Math.round(lc.taxRate * 1000) / 1000
        const cur = taxByRate.get(key) || { base: 0, tax: 0 }
        cur.base += b
        cur.tax += t
        taxByRate.set(key, cur)
      }

      const itemsCreate = lineCalcs.map((lc) => {
        const lineSub = Math.round(lc.base * factor * 100) / 100
        const lineDisc = Math.round(lc.base * (1 - factor) * 100) / 100
        return {
          product: { connect: { id: lc.productId } },
          ...(lc.variantId ? { variant: { connect: { id: lc.variantId } } } : {}),
          quantity: lc.quantity,
          unitPrice: lc.unitPrice,
          discount: lineDisc,
          taxRate: lc.taxRate,
          subtotal: lineSub,
        }
      })

      const taxSummaryCreate = Array.from(taxByRate.entries()).map(([rate, agg]) => ({
        name: rate > 0 ? `IVA ${rate}%` : 'Sin IVA',
        rate,
        baseAmount: Math.round(agg.base * 100) / 100,
        taxAmount: Math.round(agg.tax * 100) / 100,
      }))

      let status: string
      let paidAt: Date | null = null
      let balance = 0

      if (!paymentsData || paidSum < 0.01) {
        status = 'EN_COBRANZA'
        balance = Math.round(invoiceTotal * 100) / 100
      } else if (paidSum >= invoiceTotal - 0.02) {
        status = 'PAGADA'
        paidAt = new Date()
        balance = 0
      } else {
        status = 'PARCIAL'
        balance = Math.round((invoiceTotal - paidSum) * 100) / 100
      }

      const invoiceCreateData: any = {
        number: invoiceNumber,
        prefix,
        consecutive,
        customerId,
        status,
        subtotal: invoiceSubtotalExTax,
        discount: Math.round(invoiceDiscountExTax * 100) / 100,
        tax: invoiceTax,
        total: invoiceTotal,
        balance,
        issuedAt: new Date(),
        paidAt,
        createdById: userId || null,
        items: { create: itemsCreate },
        taxSummary: { create: taxSummaryCreate },
      }

      if (tipAmt > 0) {
        invoiceCreateData.tipAmount = tipAmt
      }

      const invoice = await tx.invoice.create({ data: invoiceCreateData }).catch(async (err: any) => {
        if (err?.code === 'P2022' && err?.message?.includes('tipAmount')) {
          delete invoiceCreateData.tipAmount
          return tx.invoice.create({ data: invoiceCreateData })
        }
        throw err
      })

      const openShift =
        userId &&
        (await tx.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
        }))

      if (paymentsData) {
        let changeRemaining = Math.max(0, paidSum - invoiceTotal)

        for (const p of paymentsData) {
          const pm = await resolvePaymentMethodForClose(tx, p.method)
          const isCash = pm.type === 'CASH'
          let amountToApply = p.amount
          if (isCash && changeRemaining > 0) {
            const absorb = Math.min(changeRemaining, p.amount)
            amountToApply = p.amount - absorb
            changeRemaining -= absorb
          }

          if (amountToApply > 0) {
            await tx.payment.create({
              data: {
                invoiceId: invoice.id,
                amount: amountToApply,
                method: p.method,
                paymentMethodId: pm.id,
                reference: p.reference || null,
                notes:
                  isCash && p.amount > amountToApply
                    ? `Efectivo recibido: ${p.amount}, aplicado a factura: ${amountToApply}`
                    : undefined,
                createdById: userId || null,
              },
            })

            if (openShift && amountToApply > 0) {
              await tx.shiftSummary.upsert({
                where: {
                  shiftId_paymentMethodId: {
                    shiftId: openShift.id,
                    paymentMethodId: pm.id,
                  },
                },
                update: { expectedAmount: { increment: amountToApply } },
                create: {
                  shiftId: openShift.id,
                  paymentMethodId: pm.id,
                  expectedAmount: amountToApply,
                },
              })

              if (isCash) {
                await tx.cashShift.update({
                  where: { id: openShift.id },
                  data: { expectedCash: { increment: amountToApply } },
                })
                await tx.cashMovement.create({
                  data: {
                    cashShiftId: openShift.id,
                    type: 'IN',
                    amount: amountToApply,
                    reason: `Restaurante - ${invoiceNumber}`,
                    createdById: userId!,
                  },
                })
              }
            }
          }
        }
      }

      if (!openShift && paymentsData?.some((p) => p.method === 'CASH')) {
        warnings.push('Pagos en efectivo registrados sin turno de caja abierto para este usuario')
      }

      // Inventario / recetas (mismo criterio que POS)
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { active: true },
        orderBy: { name: 'asc' },
      })

      if (defaultWarehouse && enableRestaurantMode) {
        for (let idx = 0; idx < lineCalcs.length; idx++) {
          const lc = lineCalcs[idx]
          const item = activeItems[idx]
          const product = item?.product
          if (!product?.trackStock) continue

          const qty = lc.quantity

          if (product.enableRecipeConsumption) {
            const ingredients = await resolveAllIngredients(
              tx,
              lc.productId,
              qty,
              lc.variantId
            )
            for (const ing of ingredients) {
              const enough = await checkStock(
                defaultWarehouse.id,
                ing.ingredientId,
                null,
                ing.quantity,
                tx as any
              )
              if (!enough) {
                throw new Error(
                  `Stock insuficiente para ingrediente en receta de ${product.name}`
                )
              }
              await updateStockLevel(
                defaultWarehouse.id,
                ing.ingredientId,
                null,
                -ing.quantity,
                tx,
                {
                  type: 'OUT',
                  reason: `Receta (restaurante): ${product.name}`,
                  reasonCode: 'RECIPE',
                  reference: invoiceNumber,
                  createdById: userId,
                }
              )
            }
          } else {
            const enough = await checkStock(
              defaultWarehouse.id,
              lc.productId,
              lc.variantId,
              qty,
              tx as any
            )
            if (!enough) {
              throw new Error(`Stock insuficiente para ${product.name}`)
            }
            await updateStockLevel(
              defaultWarehouse.id,
              lc.productId,
              lc.variantId,
              -qty,
              tx,
              {
                type: 'OUT',
                reason: 'Venta restaurante',
                reasonCode: 'SALE',
                reference: invoiceNumber,
                createdById: userId,
              }
            )
          }
        }
      } else if (enableRestaurantMode && lineCalcs.some((l) => activeItems.find((a: any) => a.productId === l.productId)?.product?.trackStock)) {
        warnings.push('No hay almacén activo: no se descontó inventario')
      }

      // Contabilidad solo si quedó pagada (como POS)
      if (status === 'PAGADA') {
        try {
          const { createJournalEntryFromInvoice } = await import(
            '@/lib/accounting/invoice-integration'
          )
          const { createCostOfSalesEntry } = await import(
            '@/lib/accounting/inventory-integration'
          )
          await createJournalEntryFromInvoice(invoice.id, tenantId, userId || '', tx)
          await createCostOfSalesEntry(invoice.id, tenantId, userId || '', tx)
        } catch (accErr: any) {
          warnings.push(
            accErr?.message
              ? `Contabilidad: ${accErr.message}`
              : 'No se generó asiento contable (revisar configuración)'
          )
        }
      }

      const closedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      })

      await tx.restaurantTable.update({
        where: { id: tableSession.tableId },
        data: { status: 'AVAILABLE' },
      })

      return { closedSession, invoice }
    })

    emitRestaurantEvent(tenantId, 'TABLE_UPDATED', {
      tableId: tableSession.tableId,
      status: 'AVAILABLE',
    })

    emitRestaurantEvent(tenantId, 'SESSION_CLOSED', {
      sessionId: tableSession.id,
      totalAmount: tableSession.totalAmount,
    })

    return NextResponse.json({
      ...result,
      warnings,
    })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to close table session')
  }
}
