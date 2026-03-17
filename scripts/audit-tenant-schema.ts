import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface SchemaAudit {
    table: string;
    columns: string[];
}

const CRITICAL_SCHEMA: SchemaAudit[] = [
    {
        table: 'Product',
        columns: [
            'barcode', 'brand', 'category', 'unitOfMeasure', 'productType', 
            'enableRecipeConsumption', 'cost', 'lastCost', 'averageCost', 
            'percentageMerma', 'stockAlertEnabled', 'trackStock', 'active', 
            'description', 'preferredZoneId'
        ]
    },
    {
        table: 'User',
        columns: ['legalAccepted', 'legalAcceptedAt', 'legalVersion', 'marketingAccepted', 'acceptanceIp']
    },
    {
        table: 'QuotationItem',
        columns: ['zoneId']
    },
    {
        table: 'SalesOrderItem',
        columns: ['zoneId']
    },
    {
        table: 'InvoiceItem',
        columns: ['zoneId']
    },
    {
        table: 'PurchaseOrderItem',
        columns: ['zoneId']
    },
    {
        table: 'GoodsReceiptItem',
        columns: ['zoneId']
    },
    {
        table: 'ReturnItem',
        columns: ['zoneId']
    },
    {
        table: 'CreditNoteItem',
        columns: ['zoneId']
    },
    {
        table: 'StockLevel',
        columns: ['zoneId']
    },
    {
        table: 'StockMovement',
        columns: ['zoneId']
    },
    {
        table: 'PhysicalInventoryItem',
        columns: ['zoneId']
    }
]

let logContent = ''
function log(msg: string) {
    console.log(msg)
    logContent += msg + '\n'
}

async function auditTenant(tenant: any) {
    if (!tenant.databaseUrl) {
        log(`⚠️  Skipping ${tenant.name}: No database URL`)
        return
    }

    log(`\n🔍 Auditing Tenant: ${tenant.name} (${tenant.slug})`)
    const client = new Client({ connectionString: tenant.databaseUrl })
    
    try {
        await client.connect()
        
        let schemaName = 'public'
        try {
            const url = new URL(tenant.databaseUrl)
            schemaName = url.searchParams.get('schema') || 'public'
        } catch (e) {}

        log(`   Schema: ${schemaName}`)

        for (const audit of CRITICAL_SCHEMA) {
            const tableCheck = await client.query(`
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name = $2
            `, [schemaName, audit.table])

            if (tableCheck.rowCount === 0) {
                log(`   ❌ Table MISSING: ${audit.table}`)
                continue
            }

            const columnCheck = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = $2
            `, [schemaName, audit.table])

            const existingColumns = columnCheck.rows.map(r => r.column_name)
            const missing = audit.columns.filter(c => !existingColumns.includes(c))

            if (missing.length > 0) {
                log(`   ❌ Table ${audit.table} is missing columns: ${missing.join(', ')}`)
                
                for (const col of missing) {
                    try {
                        let type = 'TEXT'
                        if (col.includes('Cost') || col.includes('Amount') || col.includes('Price') || col.includes('Merma') || col.includes('Rate')) {
                            type = 'DOUBLE PRECISION DEFAULT 0'
                        } else if (col.includes('Accepted') && !col.includes('At')) {
                            type = 'BOOLEAN NOT NULL DEFAULT false'
                        } else if (col.includes('At')) {
                            type = 'TIMESTAMP(3)'
                        } else if (col === 'active' || col === 'trackStock' || col === 'stockAlertEnabled' || col === 'enableRecipeConsumption') {
                            type = 'BOOLEAN NOT NULL DEFAULT true'
                        }
                        
                        if (col === 'unitOfMeasure') type = "TEXT NOT NULL DEFAULT 'UNIT'"
                        if (col === 'productType') type = "TEXT NOT NULL DEFAULT 'RETAIL'"
                        if (col === 'legalVersion') type = "TEXT"

                        await client.query(`ALTER TABLE "${schemaName}"."${audit.table}" ADD COLUMN "${col}" ${type}`)
                        log(`      ✅ Fixed: Added ${col} to ${audit.table}`)
                    } catch (fixErr: any) {
                        log(`      ⚠️  Failed to fix ${col}: ${fixErr.message}`)
                    }
                }
            } else {
                log(`   ✅ Table ${audit.table} is up to date`)
            }
        }

    } catch (err: any) {
        log(`   ❌ Connection Error: ${err.message}`)
    } finally {
        await client.end()
    }
}

async function main() {
    log('🚀 Starting Deep Schema Audit...\n')
    const tenants = await prisma.tenant.findMany({
        where: { active: true }
    })

    log(`📊 Found ${tenants.length} active tenants to audit.\n`)

    for (const tenant of tenants) {
        await auditTenant(tenant)
    }

    log('\n🏁 Audit complete.')
    fs.writeFileSync('audit_report.log', logContent)
    await prisma.$disconnect()
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
