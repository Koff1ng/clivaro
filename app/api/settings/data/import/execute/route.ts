import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await requirePermission(req as any, 'manage_settings' as any)
        if (session instanceof NextResponse) return session

        const tenantId = getTenantIdFromSession(session)
        const { entityType, data } = await req.json() // data is valid array from preflight

        let results = { success: 0, failed: 0, errors: [] as string[] }

        await withTenantTx(tenantId, async (tenantPrisma: any) => {
            if (entityType === 'clients') {
                for (const row of data) {
                    try {
                        const email = row['email']
                        const name = row['name']

                        if (!name) {
                            results.failed++
                            results.errors.push(`Row skipped: No name found`)
                            continue
                        }

                        let existingCustomer: any = null
                        if (email) {
                            existingCustomer = await tenantPrisma.customer.findFirst({
                                where: { email }
                            })
                        }

                        if (existingCustomer) {
                            await tenantPrisma.customer.update({
                                where: { id: existingCustomer.id },
                                data: {
                                    name: row['name'],
                                    phone: row['phone'] || null,
                                    address: row['address'] || null,
                                    taxId: row['taxId'] || row['nit'] || null,
                                    tags: row['tags'] || null,
                                    notes: row['notes'] || null
                                }
                            })
                        } else {
                            await tenantPrisma.customer.create({
                                data: {
                                    name: row['name'],
                                    email: row['email'] || null,
                                    phone: row['phone'] || null,
                                    address: row['address'] || null,
                                    taxId: row['taxId'] || row['nit'] || null,
                                    tags: row['tags'] || null,
                                    notes: row['notes'] || null
                                }
                            })
                        }
                        results.success++
                    } catch (e: any) {
                        results.failed++
                        results.errors.push(e.message)
                    }
                }
            } else if (entityType === 'products') {
                for (const row of data) {
                    try {
                        const sku = row['sku'] || row['code']
                        if (!sku) {
                            results.failed++
                            results.errors.push(`Row skipped: No SKU/code found for ${row['name'] || 'unknown'}`)
                            continue
                        }

                        await tenantPrisma.product.upsert({
                            where: { sku: String(sku) },
                            update: {
                                name: row['name'],
                                price: parseFloat(row['price'] || 0),
                                cost: parseFloat(row['cost'] || 0),
                                description: row['description'] || null,
                                brand: row['brand'] || null,
                                category: row['category'] || null,
                                barcode: row['barcode'] || null,
                                taxRate: parseFloat(row['taxRate'] || 0),
                                productType: row['productType'] || 'RETAIL',
                                enableRecipeConsumption: Boolean(row['enableRecipeConsumption'])
                            },
                            create: {
                                sku: String(sku),
                                name: row['name'],
                                price: parseFloat(row['price'] || 0),
                                cost: parseFloat(row['cost'] || 0),
                                description: row['description'] || null,
                                brand: row['brand'] || null,
                                category: row['category'] || null,
                                barcode: row['barcode'] || null,
                                taxRate: parseFloat(row['taxRate'] || 0),
                                productType: row['productType'] || 'RETAIL',
                                enableRecipeConsumption: Boolean(row['enableRecipeConsumption'])
                            }
                        })
                        results.success++
                    } catch (e: any) {
                        results.failed++
                        results.errors.push(`Error on ${row['name']}: ${e.message}`)
                    }
                }
            } else if (entityType === 'settings') {
                const row = data[0]
                if (row) {
                    try {
                        const { prisma: masterPrisma } = await import('@/lib/db')
                        const { id, tenantId: tId, createdAt, updatedAt, ...settingsData } = row
                        await masterPrisma.tenantSettings.upsert({
                            where: { tenantId },
                            update: settingsData,
                            create: {
                                tenantId,
                                ...settingsData
                            }
                        })
                        results.success = 1
                    } catch (e: any) {
                        results.failed = 1
                        results.errors.push(`Error updating settings: ${e.message}`)
                    }
                }
            } else if (entityType === 'sales') {
                const invoicesMap = new Map<string, any[]>()
                for (const row of data) {
                    const num = String(row['invoiceNumber'])
                    if (!invoicesMap.has(num)) invoicesMap.set(num, [])
                    invoicesMap.get(num)!.push(row)
                }

                for (const [number, rows] of invoicesMap.entries()) {
                    try {
                        const firstRow = rows[0]
                        if (!firstRow) continue

                        const issueDate = firstRow['date'] ? new Date(firstRow['date']) : new Date()
                        const status = firstRow['status'] || 'PAID'
                        const total = parseFloat(firstRow['total'] || 0)

                        let customerId: string | null = null
                        if (firstRow['customerTaxId']) {
                            const c = await tenantPrisma.customer.findFirst({ where: { taxId: String(firstRow['customerTaxId']) } })
                            if (c) customerId = c.id
                        }
                        if (!customerId && (firstRow['customerName'] || firstRow['customer'])) {
                            const name = String(firstRow['customerName'] || firstRow['customer'])
                            const c = await tenantPrisma.customer.findFirst({ where: { name } })
                            if (c) customerId = (c as any).id
                            else {
                                const newC = await tenantPrisma.customer.create({
                                    data: {
                                        name,
                                        taxId: firstRow['customerTaxId'] ? String(firstRow['customerTaxId']) : null,
                                        email: firstRow['customerEmail'] ? String(firstRow['customerEmail']) : null,
                                    }
                                })
                                customerId = (newC as any).id
                            }
                        }

                        if (!customerId) {
                            results.failed++
                            results.errors.push(`Skipped Invoice ${number}: No customer found/created`)
                            continue
                        }

                        const existingInv = await tenantPrisma.invoice.findUnique({ where: { number: String(number) } })
                        if (existingInv) {
                            results.failed++
                            continue
                        }

                        // Use any to bypass strict Prisma item types for this dynamic import
                        await (tenantPrisma as any).invoice.create({
                            data: {
                                number: String(number),
                                customerId,
                                issuedAt: issueDate,
                                status: status,
                                total: total,
                                subtotal: total,
                                tax: 0,
                                items: {
                                    create: await Promise.all(rows.map(async (row: any) => {
                                        let productId: string | null = null
                                        if (row['sku']) {
                                            const p = await tenantPrisma.product.findUnique({ where: { sku: String(row['sku']) } })
                                            if (p) productId = p.id
                                        }
                                        if (!productId && (row['productName'] || row['product'])) {
                                            const pName = String(row['productName'] || row['product'])
                                            const p = await tenantPrisma.product.findFirst({ where: { name: pName } })
                                            if (p) productId = (p as any).id
                                        }

                                        if (!productId) {
                                            let generic = await tenantPrisma.product.findFirst({ where: { sku: 'GEN-IMPORT' } })
                                            if (!generic) {
                                                generic = await tenantPrisma.product.create({
                                                    data: {
                                                        name: 'Producto Importado Genérico',
                                                        sku: 'GEN-IMPORT',
                                                        price: 0,
                                                        productType: 'SERVICE'
                                                    }
                                                })
                                            }
                                            productId = (generic as any).id
                                        }

                                        return {
                                            productId,
                                            quantity: parseFloat(row['quantity'] || 1),
                                            unitPrice: parseFloat(row['price'] || 0),
                                            subtotal: parseFloat(row['subtotal'] || row['price'] || 0),
                                            taxRate: 0,
                                            unitCost: 0
                                        }
                                    }))
                                }
                            }
                        })
                        results.success++
                    } catch (e: any) {
                        results.failed++
                        results.errors.push(`Error creating Invoice ${number}: ${e.message}`)
                    }
                }
            }
        })

        return NextResponse.json(results)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
