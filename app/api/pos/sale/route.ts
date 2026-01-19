import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel, checkStock } from '@/lib/inventory'
import jwt from 'jsonwebtoken'

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
    taxRate: z.number().min(0).max(100),
  })),
  // Compat: flujo antiguo (un solo método)
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  discount: z.number().min(0).default(0),
  cashReceived: z.number().optional(), // For cash payments
  // Nuevo: pagos múltiples (split)
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER']),
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

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createPOSSaleSchema.parse(body)
    
    // Validación de forma de pago (paymentMethod vs payments)
    if (!data.payments?.length && !data.paymentMethod) {
      return NextResponse.json(
        { error: 'Debe indicar paymentMethod o payments', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    // Enforce discounts permission (or override token)
    const hasAnyDiscount = data.items.some((it) => (it.discount || 0) > 0)
    if (hasAnyDiscount) {
      const user = session.user as any
      const isSuperAdmin = !!user.isSuperAdmin
      const perms = await getUserPermissions(prisma, user.id)
      const canDiscount = isSuperAdmin || perms.has(PERMISSIONS.APPLY_DISCOUNTS)
      if (!canDiscount) {
        const token = data.discountOverrideToken
        if (!token) {
          return NextResponse.json(
            { error: 'No tienes permiso para aplicar descuentos', code: 'PERMISSION_DENIED', permission: 'apply_discounts' },
            { status: 403 }
          )
        }
        const secret = process.env.NEXTAUTH_SECRET
        if (!secret) {
          return NextResponse.json({ error: 'Server misconfigured (NEXTAUTH_SECRET)', code: 'SERVER_ERROR' }, { status: 500 })
        }
        try {
          const payload: any = jwt.verify(token, secret, { issuer: 'clivaro' })
          if (payload?.aud !== 'pos-discount-override' || payload?.perm !== PERMISSIONS.APPLY_DISCOUNTS) {
            return NextResponse.json({ error: 'Token de autorización inválido', code: 'DISCOUNT_OVERRIDE_INVALID' }, { status: 403 })
          }
          if (payload?.issuedForUserId !== user.id) {
            return NextResponse.json({ error: 'Token no válido para este usuario', code: 'DISCOUNT_OVERRIDE_WRONG_USER' }, { status: 403 })
          }
        } catch {
          return NextResponse.json({ error: 'Token de autorización expirado o inválido', code: 'DISCOUNT_OVERRIDE_EXPIRED' }, { status: 403 })
        }
      }
    }

    // Check stock availability
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found`, code: 'PRODUCT_NOT_FOUND', productId: item.productId },
          { status: 400 }
        )
      }

      if (product.trackStock) {
        // Verificar si existe registro de stock
        const stockLevel = await prisma.stockLevel.findFirst({
          where: {
            warehouseId: data.warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        })

        if (stockLevel) {
          // Hay registro de stock, verificar disponibilidad
          const hasStock = stockLevel.quantity >= item.quantity
          if (!hasStock) {
            return NextResponse.json(
              {
                error: `Stock insuficiente para ${product.name}. Disponible: ${stockLevel.quantity}, Solicitado: ${item.quantity}`,
                code: 'STOCK_INSUFFICIENT',
                conflicts: [
                  {
                    type: 'STOCK',
                    productId: item.productId,
                    variantId: item.variantId || null,
                    productName: product.name,
                    available: stockLevel.quantity,
                    requested: item.quantity,
                  },
                ],
              },
              { status: 400 }
            )
          }
        }
        // Si no hay registro de stock, permitir la venta
        // El stock se actualizará en la transacción (creará el registro con cantidad negativa)
      }
    }

    // Use transaction
    logger.debug('[POS Sale] Starting sale transaction')
    const result = await prisma.$transaction(async (tx) => {
      logger.debug('[POS Sale] Transaction started')
      // Calculate totals
      let subtotal = 0
      const items = []

      for (const item of data.items) {
        const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
        const itemTax = itemSubtotal * (item.taxRate / 100)
        const itemTotal = itemSubtotal + itemTax

        subtotal += itemSubtotal
        items.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          subtotal: itemSubtotal, // Subtotal sin impuesto
        })
      }

      const discount = data.discount || 0
      const subtotalAfterDiscount = subtotal - discount
      const tax = items.reduce((sum, item) => {
        const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
        return sum + (itemSubtotal * item.taxRate / 100)
      }, 0)
      const total = subtotalAfterDiscount + tax
      
      // Validar pagos (si vienen en el request) contra el total calculado
      const tenderedTotal = data.payments?.reduce((sum, p) => sum + p.amount, 0)
      if (data.payments?.length) {
        if (!tenderedTotal || tenderedTotal < total) {
          throw new Error(`El total pagado (${tenderedTotal || 0}) debe ser mayor o igual al total (${total})`)
        }
      } else if (data.paymentMethod === 'CASH') {
        // Flujo antiguo en efectivo: exige cashReceived >= total
        if (typeof data.cashReceived !== 'number' || data.cashReceived < total) {
          throw new Error(`El efectivo recibido (${data.cashReceived || 0}) debe ser mayor o igual al total (${total})`)
        }
      }

      // Create customer if not provided (walk-in customer)
      let customerId = data.customerId
      if (!customerId) {
        const walkInCustomer = await tx.customer.findFirst({
          where: { name: 'Cliente General' },
        })
        if (walkInCustomer) {
          customerId = walkInCustomer.id
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              name: 'Cliente General',
              createdById: (session.user as any).id,
            },
          })
          customerId = newCustomer.id
        }
      }

      // Create invoice directly (no sales order needed)
      const invoiceCount = await tx.invoice.count()
      const prefix = process.env.BILLING_RESOLUTION_PREFIX || 'FV'
      const consecutive = String(invoiceCount + 1).padStart(6, '0')
      const invoiceNumber = `${prefix}-${consecutive}`

      // Crear factura con items
      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          prefix: prefix,
          consecutive: consecutive,
          customerId,
          status: 'PAGADA', // Estado en español
          subtotal: subtotalAfterDiscount,
          discount,
          tax,
          total,
          issuedAt: new Date(),
          paidAt: new Date(),
          electronicStatus: 'PENDING',
          createdById: (session.user as any).id,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              subtotal: item.subtotal,
            })),
          },
        },
      })

      // Crear pagos (soporta split payments)
      const paymentsToCreate: Array<{ method: 'CASH' | 'CARD' | 'TRANSFER'; amount: number; reference?: string | null; notes?: string | null }> = []
      let change = 0
      let cashApplied = 0

      if (data.payments?.length) {
        const byMethod = data.payments.reduce((acc, p) => {
          acc[p.method] = (acc[p.method] || 0) + p.amount
          return acc
        }, {} as Record<string, number>)

        const cashTendered = byMethod['CASH'] || 0
        const nonCashTendered = (byMethod['CARD'] || 0) + (byMethod['TRANSFER'] || 0)
        change = Math.max(0, (tenderedTotal || 0) - total)

        // El cambio solo puede venir de efectivo
        if (change > 0 && cashTendered <= 0) {
          throw new Error('El cambio solo es posible cuando hay efectivo en la forma de pago')
        }
        if (change > cashTendered + 0.0001) {
          throw new Error('El cambio no puede ser mayor al efectivo recibido')
        }

        cashApplied = Math.max(0, cashTendered - change)

        if (byMethod['CARD']) {
          paymentsToCreate.push({ method: 'CARD', amount: byMethod['CARD'] })
        }
        if (byMethod['TRANSFER']) {
          paymentsToCreate.push({ method: 'TRANSFER', amount: byMethod['TRANSFER'] })
        }
        if (cashApplied > 0) {
          paymentsToCreate.push({
            method: 'CASH',
            amount: cashApplied,
            notes: change > 0 ? `Efectivo recibido: ${cashTendered}. Cambio: ${change}.` : null,
          })
        }

        // Validación final de aplicado vs total (puede haber cashApplied=0 si todo es no-cash)
        const applied = paymentsToCreate.reduce((sum, p) => sum + p.amount, 0)
        if (Math.abs(applied - total) > 0.01) {
          throw new Error(`Error al aplicar pagos. Aplicado: ${applied}, Total: ${total}`)
        }
      } else {
        // Flujo antiguo
        const method = (data.paymentMethod as any) as 'CASH' | 'CARD' | 'TRANSFER'
        change = method === 'CASH' && typeof data.cashReceived === 'number'
          ? Math.max(0, data.cashReceived - total)
          : 0
        cashApplied = method === 'CASH' ? total : 0
        paymentsToCreate.push({ method, amount: total })
      }

      for (const p of paymentsToCreate) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: p.amount,
            method: p.method,
            reference: p.reference || null,
            notes: p.notes || null,
            createdById: (session.user as any).id,
          },
        })
      }

      // Update cash shift for all payment methods (track all sales)
      const openShift = await tx.cashShift.findFirst({
        where: {
          userId: (session.user as any).id,
          status: 'OPEN',
        },
      })

      if (openShift) {
        // For CASH payments, create cash movement and update expected cash
        if (cashApplied > 0) {
          // Create cash movement IN
          await tx.cashMovement.create({
            data: {
              cashShiftId: openShift.id,
              type: 'IN',
              amount: cashApplied,
              reason: `Venta POS - ${invoiceNumber}${change > 0 ? ` (cambio ${change})` : ''}`,
              createdById: (session.user as any).id,
            },
          })

          // Update expected cash
          await tx.cashShift.update({
            where: { id: openShift.id },
            data: {
              expectedCash: openShift.expectedCash + cashApplied,
            },
          })
        }
        // Note: CARD and TRANSFER payments are tracked via Payment model
        // and will be shown in the cash shift payments list
      }

      // Create stock movements for tracked products
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (product?.trackStock) {
          logger.debug('[POS Sale] Processing stock', { productId: item.productId, quantity: item.quantity })
          
          // Create OUT movement
          const movement = await tx.stockMovement.create({
            data: {
              warehouseId: data.warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              type: 'OUT',
              quantity: toDecimal(item.quantity),
              reason: 'POS Sale',
              createdById: (session.user as any).id,
              reference: invoiceNumber,
            },
          })
          logger.debug('[POS Sale] Stock movement created', { movementId: movement.id })

          // Update stock level directly in transaction (more reliable)
          const whereClause: any = {
            warehouseId: data.warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          }

          const existingStock = await tx.stockLevel.findFirst({
            where: whereClause,
          })

          if (existingStock) {
            const newQuantity = existingStock.quantity - item.quantity
            logger.debug('[POS Sale] Updating existing stock', { from: existingStock.quantity, delta: -item.quantity, to: newQuantity })
            await tx.stockLevel.update({
              where: { id: existingStock.id },
              data: { quantity: newQuantity },
            })
            logger.debug('[POS Sale] Stock updated')
          } else {
            // No existe registro, crear uno con cantidad negativa
            logger.debug('[POS Sale] Creating new stock record', { quantity: -item.quantity })
            await tx.stockLevel.create({
              data: {
                warehouseId: data.warehouseId,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: -item.quantity,
                minStock: 0,
              },
            })
            logger.debug('[POS Sale] Stock record created')
          }
          
          // Verificar que el stock se actualizó correctamente
          const updatedStock = await tx.stockLevel.findFirst({
            where: whereClause,
          })
          
          if (!updatedStock) {
            logger.error('[POS Sale] Critical: could not verify updated stock', undefined, { productId: item.productId })
            throw new Error(`Error al actualizar stock para producto ${product.name}. La transacción será revertida.`)
          }
          
          // Verificar que el stock se actualizó correctamente
          const expectedQuantity = existingStock 
            ? existingStock.quantity - item.quantity 
            : -item.quantity
            
          if (Math.abs(updatedStock.quantity - expectedQuantity) > 0.01) {
            logger.error('[POS Sale] Critical: stock mismatch', undefined, {
              productId: item.productId,
              expectedQuantity,
              actualQuantity: updatedStock.quantity,
            })
            throw new Error(`Error: El stock no se actualizó correctamente para ${product.name}. Esperado: ${expectedQuantity}, Actual: ${updatedStock.quantity}`)
          }
          
          logger.debug('[POS Sale] Stock verified', { productId: item.productId, quantity: updatedStock.quantity })
        }
      }

      logger.debug('[POS Sale] Transaction completed')
      return {
        invoiceId: invoice.id,
        invoiceNumber,
        total: total,
        change,
      }
    }, {
      timeout: 30000, // 30 segundos de timeout
    })
    logger.debug('[POS Sale] Transaction result', { invoiceNumber: result.invoiceNumber })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('POS sale validation error', { errors: error.errors })
      return NextResponse.json(
        { 
          error: 'Error de validación', 
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      )
    }
    logger.error('Error creating POS sale', error, { endpoint: '/api/pos/sale', method: 'POST' })
    return NextResponse.json(
      { 
        error: error.message || 'Error al procesar la venta',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

