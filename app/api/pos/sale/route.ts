import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel, checkStock } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'
import { resolveAllIngredients } from '@/lib/recipes'
import { enqueueJob } from '@/lib/jobs/queue'
import jwt from 'jsonwebtoken'
import { prisma as masterPrisma } from '@/lib/db'
import { withTenantTx } from '@/lib/tenancy'
import { calculateGranularTaxes, TaxRateInfo } from '@/lib/taxes'
import { handleError } from '@/lib/error-handler'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)

      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
          logger.warn(`[POS Sale] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }

      // Si no es error de conexión, lanzar inmediatamente
      throw error
    }
  }
  throw lastError
}

const createPOSSaleSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(100).optional(), // Solo para compatibilidad
    appliedTaxes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      rate: z.number(),
      type: z.string(),
    })).optional(),
  })),
  // Compat: flujo antiguo (un solo método)
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  discount: z.number().min(0).default(0),
  cashReceived: z.number().optional(), // For cash payments
  // Nuevo: pagos múltiples (split) con métodos dinámicos
  payments: z.array(z.object({
    paymentMethodId: z.string(),
    amount: z.number().min(0.01),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1).optional(),
  // Override temporal para descuentos (manager override)
  discountOverrideToken: z.string().optional(),
})

async function getUserPermissions(prisma: any, userId: string) {
  const userRoles = await executeWithRetry(() => prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  })) as any[]
  const perms = new Set<string>()
  userRoles.forEach((ur: any) => {
    ur.role.rolePermissions.forEach((rp: any) => perms.add(rp.permission.name))
  })
  return perms
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  try {
    const body = await request.json()
    const data = createPOSSaleSchema.parse(body)

    // Validación de forma de pago
    if (!data.payments?.length && !data.paymentMethod) {
      return NextResponse.json(
        { error: 'Debe indicar paymentMethod o payments', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Use withTenantTx for strict isolation and the core logic
    return await withTenantTx(session.user.tenantId, async (tx: any) => {
      // 1. Permissions check (Discounts)
      const hasAnyDiscount = data.items.some((it) => (it.discount || 0) > 0)
      if (hasAnyDiscount) {
        const user = session.user as any
        const isSuperAdmin = !!user.isSuperAdmin
        const perms = await getUserPermissions(tx, user.id)
        const canDiscount = isSuperAdmin || perms.has(PERMISSIONS.APPLY_DISCOUNTS)
        if (!canDiscount) {
          const token = data.discountOverrideToken
          if (!token) {
            throw new Error('No tienes permiso para aplicar descuentos')
          }
          const secret = process.env.NEXTAUTH_SECRET
          if (!secret) throw new Error('Server misconfigured (NEXTAUTH_SECRET)')
          try {
            const payload: any = jwt.verify(token, secret, { issuer: 'clivaro' })
            if (payload?.aud !== 'pos-discount-override' || payload?.perm !== PERMISSIONS.APPLY_DISCOUNTS) {
              throw new Error('Token de autorización inválido')
            }
          } catch {
            throw new Error('Token de autorización expirado o inválido')
          }
        }
      }

      // 2. Shift check
      const openShift = await tx.cashShift.findFirst({
        where: {
          userId: (session.user as any).id,
          status: 'OPEN',
        },
      })
      if (!openShift) {
        throw new Error('No hay un turno de caja abierto.')
      }

      // 3. Totals and Items Calculation
      let totalSubtotal = 0
      let totalTaxAmount = 0
      const processedItems = []
      const taxSummariesByRate = new Map<string, { taxRateId: string, name: string, rate: number, base: number, amount: number }>()

      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) throw new Error(`Producto ${item.productId} no encontrado`)

        const itemSubtotal = Math.round(item.quantity * item.unitPrice * (1 - item.discount / 100) * 100) / 100

        // Granular Taxes
        const rates: TaxRateInfo[] = item.appliedTaxes || (item.taxRate ? [
          { id: 'legacy', name: 'IVA', rate: item.taxRate, type: 'IVA' }
        ] : [])

        const taxResult = calculateGranularTaxes(itemSubtotal, rates)

        totalSubtotal += itemSubtotal
        totalTaxAmount += taxResult.totalTax

        // Update summaries
        taxResult.taxes.forEach(t => {
          const existing = taxSummariesByRate.get(t.taxRateId)
          if (existing) {
            existing.base += itemSubtotal
            existing.amount += t.amount
          } else {
            taxSummariesByRate.set(t.taxRateId, {
              taxRateId: t.taxRateId,
              name: t.name,
              rate: t.rate,
              base: itemSubtotal,
              amount: t.amount
            })
          }
        })

        processedItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate || 0, // Legacy
          baseAmount: itemSubtotal,
          subtotal: itemSubtotal,
          taxes: taxResult.taxes
        })
      }

      const globalDiscount = data.discount || 0
      const finalSubtotal = totalSubtotal - globalDiscount
      const finalTotal = finalSubtotal + totalTaxAmount

      // 4. Payment validation
      const tenderedTotal = data.payments?.reduce((sum, p) => sum + p.amount, 0) || data.cashReceived || 0
      if (tenderedTotal < finalTotal - 0.01) {
        throw new Error(`Monto insuficiente. Total: ${finalTotal}, Recibido: ${tenderedTotal}`)
      }

      // 5. Customer resolution
      let customerId = data.customerId
      if (!customerId) {
        const walkIn = await tx.customer.findFirst({
          where: {
            OR: [
              { name: 'Cliente General' },
              { taxId: '222222222222' }
            ]
          }
        })
        customerId = walkIn ? walkIn.id : (await tx.customer.create({
          data: {
            name: 'Cliente General',
            taxId: '222222222222',
            idType: 'CC',
            isCompany: false,
            taxRegime: 'SIMPLIFIED',
            createdById: (session.user as any).id
          }
        })).id
      }

      // 6. Persistence
      const tenantSettings = await masterPrisma.tenantSettings.findUnique({ where: { tenantId: (session.user as any).tenantId } })
      const invoiceCount = await tx.invoice.count()
      const prefix = tenantSettings?.invoicePrefix || 'FV'
      const format = tenantSettings?.invoiceNumberFormat || '000000'
      const consecutive = String(invoiceCount + 1).padStart(format.length || 6, '0')
      const invoiceNumber = `${prefix}-${consecutive}`

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          prefix,
          consecutive,
          customerId,
          status: 'PAGADA',
          subtotal: finalSubtotal,
          discount: globalDiscount,
          tax: totalTaxAmount,
          total: finalTotal,
          issuedAt: new Date(),
          paidAt: new Date(),
          createdById: (session.user as any).id,
          items: {
            create: processedItems.map(pi => ({
              product: { connect: { id: pi.productId } },
              ...(pi.variantId ? { variant: { connect: { id: pi.variantId } } } : {}),
              quantity: pi.quantity,
              unitPrice: pi.unitPrice,
              discount: pi.discount,
              taxRate: pi.taxRate,
              subtotal: pi.subtotal,
              lineTaxes: {
                create: pi.taxes.map(t => ({
                  ...(t.taxRateId !== 'legacy' ? { taxRate: { connect: { id: t.taxRateId } } } : {}),
                  name: t.name,
                  rate: t.rate,
                  taxAmount: t.amount,
                  baseAmount: pi.subtotal
                })) as any
              }
            })) as any
          },
          taxSummary: {
            create: Array.from(taxSummariesByRate.values()).map(ts => ({
              ...(ts.taxRateId !== 'legacy' ? { taxRate: { connect: { id: ts.taxRateId } } } : {}),
              name: ts.name,
              rate: ts.rate,
              baseAmount: ts.base,
              taxAmount: ts.amount
            })) as any
          }
        }
      })

      // 7. Payments & Change
      let change = 0
      let isCreditSale = false
      let isPaid = true

      // Check if this is a pure Credit sale
      if (data.payments?.length === 1) {
        const p = data.payments[0]
        const methodInfo = await tx.paymentMethod.findUnique({ where: { id: p.paymentMethodId } })
        if (methodInfo && methodInfo.type === 'CREDIT') {
          isCreditSale = true
          isPaid = false
        }
      }

      // Logic for Credit Sale
      if (isCreditSale) {
        // Validate Customer
        const customer = await tx.customer.findUnique({ where: { id: customerId } })
        if (!customer) throw new Error('Cliente no encontrado para venta a crédito')
        if (customer.name === 'Cliente General') throw new Error('No se puede vender a crédito a Cliente General')

        // Check Credit Limit if set
        if (customer.creditLimit > 0) {
          if (customer.currentBalance + finalTotal > customer.creditLimit) {
            throw new Error(`Crédito insuficiente. Disponible: ${customer.creditLimit - customer.currentBalance}`)
          }
        }

        // Update Invoice status and balance
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'EN_COBRANZA',
            balance: finalTotal,
            paidAt: null
          }
        })

        // Update Customer Balance
        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: { increment: finalTotal } }
        })

        // No Payment record created yet, and no cash movement
      } else {
        // Normal Payment Logic (PAID)
        if (data.payments?.length) {
          change = tenderedTotal - finalTotal
          for (const p of data.payments) {
            const methodInfo = await tx.paymentMethod.findUnique({ where: { id: p.paymentMethodId } })
            if (!methodInfo) throw new Error(`Método de pago ${p.paymentMethodId} no encontrado`)

            // Skip if it were mixed with credit (future feature), for now assume split is only immediate payments
            if (methodInfo.type === 'CREDIT') continue;

            const amountToApply = methodInfo.type === 'CASH' ? Math.max(0, p.amount - change) : p.amount

            if (amountToApply > 0) {
              await tx.payment.create({
                data: {
                  invoice: { connect: { id: invoice.id } },
                  amount: amountToApply,
                  method: methodInfo.name,
                  paymentMethod: { connect: { id: p.paymentMethodId } },
                  reference: p.reference ?? undefined,
                  notes: methodInfo.type === 'CASH' && change > 0 ? `Efectivo: ${p.amount}, Cambio: ${change}` : (p.notes ?? undefined),
                  createdBy: { connect: { id: (session.user as any).id } },
                }
              })

              // Update Shift Summary
              await tx.shiftSummary.upsert({
                where: {
                  shiftId_paymentMethodId: {
                    shiftId: openShift.id,
                    paymentMethodId: p.paymentMethodId
                  }
                },
                update: {
                  expectedAmount: { increment: amountToApply }
                },
                create: {
                  shiftId: openShift.id,
                  paymentMethodId: p.paymentMethodId,
                  expectedAmount: amountToApply
                }
              })

              // If it's CASH, also update the main expectedCash field for legacy support
              if (methodInfo.type === 'CASH') {
                await tx.cashShift.update({
                  where: { id: openShift.id },
                  data: { expectedCash: { increment: amountToApply } }
                })

                await tx.cashMovement.create({
                  data: {
                    cashShiftId: openShift.id,
                    type: 'IN',
                    amount: amountToApply,
                    reason: `Venta POS - ${invoiceNumber}`,
                    createdById: (session.user as any).id,
                  }
                })
              }
            }
          }
        } else {
          // Fallback for legacy clients
          const method = data.paymentMethod || 'CASH'
          change = method === 'CASH' ? (data.cashReceived || finalTotal) - finalTotal : 0

          let pm = await tx.paymentMethod.findFirst({ where: { name: method } })
          if (!pm) {
            pm = await tx.paymentMethod.create({
              data: { name: method, type: method === 'CASH' ? 'CASH' : 'ELECTRONIC' }
            })
          }

          await tx.payment.create({
            data: {
              invoice: { connect: { id: invoice.id } },
              amount: finalTotal,
              method: method,
              paymentMethod: { connect: { id: pm.id } },
              createdBy: { connect: { id: (session.user as any).id } },
            }
          })

          await tx.shiftSummary.upsert({
            where: { shiftId_paymentMethodId: { shiftId: openShift.id, paymentMethodId: pm.id } },
            update: { expectedAmount: { increment: finalTotal } },
            create: { shiftId: openShift.id, paymentMethodId: pm.id, expectedAmount: finalTotal }
          })

          if (method === 'CASH') {
            await tx.cashShift.update({
              where: { id: openShift.id },
              data: { expectedCash: { increment: finalTotal } }
            })
            await tx.cashMovement.create({
              data: {
                cashShiftId: openShift.id,
                type: 'IN',
                amount: finalTotal,
                reason: `Venta POS - ${invoiceNumber}`,
                createdById: (session.user as any).id,
              }
            })
          }
        }
      }

      // 9. Stock & Recipes
      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product?.trackStock) continue

        const isRestaurant = tenantSettings?.enableRestaurantMode
        if (isRestaurant && (product as any).enableRecipeConsumption) {
          const ingredients = await resolveAllIngredients(tx, item.productId, item.quantity)
          for (const ing of ingredients) {
            await updateStockLevel(data.warehouseId, ing.ingredientId, null, -ing.quantity, tx, {
              type: 'OUT',
              reason: `Receta: ${product.name}`,
              reasonCode: 'RECIPE',
              reference: invoiceNumber,
              createdById: (session.user as any).id
            })
          }
        } else {
          await updateStockLevel(data.warehouseId, item.productId, item.variantId || null, -item.quantity, tx, {
            type: 'OUT',
            reason: 'POS Sale',
            reasonCode: 'SALE',
            reference: invoiceNumber,
            createdById: (session.user as any).id
          })
        }
      }

      // 10. Accounting Integration (Non-blocking)
      // Fire-and-forget to avoid blocking sales if accounting config is incomplete
      if (isPaid) {
        // Import at runtime to avoid circular dependencies
        import('@/lib/accounting/invoice-integration').then(async ({ createJournalEntryFromInvoice }) => {
          try {
            await createJournalEntryFromInvoice(invoice.id, (session.user as any).tenantId, (session.user as any).id)
          } catch (error) {
            console.error('[Accounting] Failed to create journal entry from invoice:', error)
            // Don't throw - sale should succeed even if accounting fails
          }
        }).catch(e => console.error('[Accounting] Import failed:', e))

        import('@/lib/accounting/inventory-integration').then(async ({ createCostOfSalesEntry }) => {
          try {
            await createCostOfSalesEntry(invoice.id, (session.user as any).tenantId, (session.user as any).id)
          } catch (error) {
            console.error('[Accounting] Failed to create cost of sales entry:', error)
            // Don't throw - sale should succeed even if accounting fails
          }
        }).catch(e => console.error('[Accounting] Import failed:', e))
      }

      return NextResponse.json({
        invoiceId: invoice.id,
        invoiceNumber,
        total: finalTotal,
        change
      }, { status: 201 })
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error?.message || String(error),
        stack: error?.stack
      },
      { status: 500 }
    )
  }
}

