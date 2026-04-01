
import { PUC_TEMPLATE } from './puc-data'

export async function initializePUC(tenantId: string, prismaTx?: any) {
    if (!prismaTx) {
        throw new Error('initializePUC requires a prisma transaction client (prismaTx)')
    }
    const client = prismaTx

    // Check if accounts exist
    const count = await client.accountingAccount.count({
        where: { tenantId }
    })

    if (count > 0) return { initialized: false, message: 'PUC already initialized' }

    const sorted = [...PUC_TEMPLATE].sort((a, b) => a.code.length - b.code.length)
    const codeToIdMap = new Map<string, string>()

    for (const acc of sorted) {
        let parentId: string | null = null
        if (acc.code.length > 1) {
            let parentCode = ''
            if (acc.code.length === 2) parentCode = acc.code.substring(0, 1)
            else if (acc.code.length === 4) parentCode = acc.code.substring(0, 2)
            else if (acc.code.length === 6) parentCode = acc.code.substring(0, 4)
            else if (acc.code.length > 6) parentCode = acc.code.substring(0, 6)

            if (parentCode) {
                if (codeToIdMap.has(parentCode)) {
                    parentId = codeToIdMap.get(parentCode)!
                } else {
                    const parent = await client.accountingAccount.findFirst({
                        where: { tenantId, code: parentCode }
                    })
                    if (parent) {
                        parentId = parent.id
                        codeToIdMap.set(parentCode, parent.id)
                    }
                }
            }
        }

        const createdAcc = await client.accountingAccount.create({
            data: {
                tenantId,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                nature: acc.nature || 'DEBIT',
                level: acc.code.length === 1 ? 1 : acc.code.length === 2 ? 2 : acc.code.length === 4 ? 3 : 4,
                parentId,
                tags: acc.tags || []
            }
        })

        codeToIdMap.set(acc.code, createdAcc.id)
    }

    return { initialized: true, count: sorted.length }
}

export async function updateAccount(tenantId: string, accountId: string, data: any, prismaTx?: any) {
    if (!prismaTx) {
        throw new Error('updateAccount requires a prisma client')
    }
    return await prismaTx.accountingAccount.update({
        where: { id: accountId, tenantId },
        data: {
            name: data.name,
            nature: data.nature,
            requiresThirdParty: data.requiresThirdParty,
            requiresCostCenter: data.requiresCostCenter,
            active: data.active
        }
    })
}

export async function getAccountTree(tenantId: string, prismaTx?: any) {
    if (!prismaTx) {
        throw new Error('getAccountTree requires a prisma client')
    }
    const accounts = await prismaTx.accountingAccount.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' }
    })
    return accounts
}
