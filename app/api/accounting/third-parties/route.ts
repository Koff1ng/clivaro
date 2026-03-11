import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const unified = await withTenantRead(tenantId, async (prisma) => {
            // Fetch from 3 sources
            const [customers, suppliers, others] = await Promise.all([
                prisma.customer.findMany({
                    where: { active: true },
                    select: { id: true, name: true, taxId: true, idType: true }
                }),
                prisma.supplier.findMany({
                    where: { active: true },
                    select: { id: true, name: true, taxId: true }
                }),
                prisma.accountingThirdParty.findMany({
                    where: { tenantId, active: true }
                })
            ])

            // Unified format
            return [
                ...customers.map((c) => ({
                    id: c.id,
                    name: c.name,
                    taxId: c.taxId,
                    type: 'CUSTOMER',
                    idType: c.idType || 'CC'
                })),
                ...suppliers.map((s) => ({
                    id: s.id,
                    name: s.name,
                    taxId: s.taxId,
                    type: 'SUPPLIER',
                    idType: 'NIT' // Default for suppliers
                })),
                ...others.map((o) => ({
                    id: o.id,
                    name: o.name,
                    taxId: o.documentNumber,
                    type: o.type,
                    idType: o.documentType
                }))
            ]
        })

        return NextResponse.json(unified)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    try {
        const result = await withTenantTx(tenantId, async (prisma) => {
            return await prisma.accountingThirdParty.create({
                data: {
                    tenantId,
                    name: body.name,
                    type: body.type || 'OTHER',
                    documentType: body.documentType || 'NIT',
                    documentNumber: body.documentNumber,
                    email: body.email,
                    phone: body.phone,
                    address: body.address
                }
            })
        })

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
