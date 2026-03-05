/**
 * Batch-fixes all dashboard API routes that use the deprecated getPrismaForRequest
 * by replacing it with withTenantTx for correct tenant schema isolation.
 */
const fs = require('fs')
const path = require('path')

const filesToFix = [
    'app/api/dashboard/stats/route.ts',
    'app/api/dashboard/top-clients/route.ts',
    'app/api/dashboard/top-products/route.ts',
    'app/api/dashboard/product-categories/route.ts',
    'app/api/dashboard/monthly-report/route.ts',
    'app/api/dashboard/inventory-value/route.ts',
]

const root = path.join(__dirname, '..')

for (const relPath of filesToFix) {
    const filePath = path.join(root, relPath)
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${relPath}`)
        continue
    }

    let content = fs.readFileSync(filePath, 'utf8')

    // Replace the import
    const hasPrismaImport = content.includes("getPrismaForRequest")
    if (!hasPrismaImport) {
        console.log(`SKIP (no getPrismaForRequest): ${relPath}`)
        continue
    }

    // Replace import
    content = content.replace(
        /import \{ getPrismaForRequest \} from '@\/lib\/get-tenant-prisma'/g,
        "import { withTenantTx } from '@/lib/tenancy'"
    )
    content = content.replace(
        /import \{ getPrismaForRequest \} from "@\/lib\/get-tenant-prisma"/g,
        'import { withTenantTx } from "@/lib/tenancy"'
    )

    // Replace const prisma = await getPrismaForRequest(...)
    content = content.replace(
        /\s*const prisma = await getPrismaForRequest\(request,\s*session\)\s*/g,
        `
  const tenantId = (session.user as any).tenantId
  const isSuperAdmin = (session.user as any).isSuperAdmin
`
    )

    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`FIXED: ${relPath}`)
}

console.log('Done. Remember to manually wrap prisma.X queries with withTenantTx(tenantId, tx => ...) in each file.')
