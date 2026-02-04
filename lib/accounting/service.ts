
import { prisma } from '@/lib/prisma'
import { PUC_TEMPLATE } from './puc-data'

export async function initializePUC(tenantId: string) {
    // Check if accounts exist
    const count = await prisma.account.count({
        where: { tenantId }
    })

    if (count > 0) return { initialized: false, message: 'PUC already initialized' }

    // Create accounts in order (to ensure hierarchy if strictly enforced, though here we use code matching)
    // We'll create them all, then fix parents? Or just relies on code structure?
    // Our schema has `parentId`. We need to resolve it.

    // Strategy: Sort by code length. 
    // 1-digit parent is null.
    // 2-digit parent is 1-digit.
    // 4-digit parent is 2-digit.
    // 6-digit parent is 4-digit.

    const sorted = [...PUC_TEMPLATE].sort((a, b) => a.code.length - b.code.length)
    const created = []

    for (const acc of sorted) {
        let parentId = null
        if (acc.code.length > 1) {
            // Determine parent code
            let parentCode = ''
            if (acc.code.length === 2) parentCode = acc.code.substring(0, 1)
            else if (acc.code.length === 4) parentCode = acc.code.substring(0, 2)
            else if (acc.code.length === 6) parentCode = acc.code.substring(0, 4)
            else if (acc.code.length > 6) parentCode = acc.code.substring(0, 6) // generic rule

            if (parentCode) {
                // Find parent in recently created or DB
                // Optimization: Cache map of code -> id
                const parent = await prisma.account.findUnique({
                    where: { tenantId_code: { tenantId, code: parentCode } }
                })
                if (parent) parentId = parent.id
            }
        }

        await prisma.account.create({
            data: {
                tenantId,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                level: acc.code.length === 1 ? 1 : acc.code.length === 2 ? 2 : acc.code.length === 4 ? 3 : 4,
                parentId,
                tags: acc.tags || []
            }
        })
    }

    return { initialized: true, count: sorted.length }
}

export async function getAccountTree(tenantId: string) {
    const accounts = await prisma.account.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' }
    })
    return accounts
}
