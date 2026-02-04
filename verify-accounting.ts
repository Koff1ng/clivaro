
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting Accounting Verification...')

    // 1. Setup Tenant (Find existing or pick first)
    // In this system, tenants seem to be crucial. Let's pick the first one.
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) {
        console.error('No tenant found. Cannot run accounting verification.')
        return
    }
    console.log(`Using Tenant: ${tenant.name} (${tenant.id})`)

    // 2. Setup Admin User (Find default admin)
    const admin = await prisma.user.findFirst({ where: { email: 'admin@local' } })
    if (!admin) {
        console.error('No admin user found.')
        return
    }
    console.log(`Using User: ${admin.name} (${admin.id})`)

    // 3. Initialize PUC (Simulate Service Logic)
    console.log('Verifying/Initializing PUC...')
    let account = await prisma.accountingAccount.findFirst({
        where: { tenantId: tenant.id, code: '110505' } // Caja General
    })

    if (!account) {
        console.log('Creating Test Account 110505...')
        account = await prisma.accountingAccount.create({
            data: {
                tenantId: tenant.id,
                code: '110505',
                name: 'Caja General',
                type: 'ASSET',
                level: 1, // Simplified for test
                tags: ['CASH']
            }
        })
    } else {
        console.log('Account 110505 already exists.')
    }

    // 4. Create Journal Entry (Asiento Manual)
    console.log('Creating Test Journal Entry...')
    const entry = await prisma.journalEntry.create({
        data: {
            tenantId: tenant.id,
            number: `TEST-${Date.now()}`,
            date: new Date(),
            period: '2025-02',
            type: 'JOURNAL',
            description: 'Test Entry Verification',
            status: 'DRAFT',
            totalDebit: 1000,
            totalCredit: 1000,
            createdById: admin.id,
            lines: {
                create: [
                    {
                        accountId: account.id,
                        description: 'Debit Line',
                        debit: 1000,
                        credit: 0,
                    },
                    {
                        accountId: account.id, // Using same account for simplicity, usually different
                        description: 'Credit Line',
                        debit: 0,
                        credit: 1000,
                    }
                ]
            }
        },
        include: { lines: true }
    })
    console.log(`Journal Entry Created: ${entry.number} (ID: ${entry.id})`)
    console.log(`Lines: ${entry.lines.length}`)

    // 5. Verify Relations (Tenant connection)
    const fetchedEntry = await prisma.journalEntry.findUnique({
        where: { id: entry.id },
        include: { tenant: true }
    })
    if (fetchedEntry?.tenant.id === tenant.id) {
        console.log('SUCCESS: Entry correctly linked to Tenant.')
    } else {
        console.error('FAILURE: Entry NOT linked to correct Tenant.')
    }

    // 6. Test Query (GetJournalLines equivalent)
    const lines = await prisma.journalEntryLine.findMany({
        where: { journalEntry: { tenantId: tenant.id, id: entry.id } },
        include: { account: true }
    })
    console.log(`Query Test: Found ${lines.length} lines for report.`)

    // 7. Cleanup (Optional, but good for repetitive testing)
    // await prisma.journalEntry.delete({ where: { id: entry.id } })
    // console.log('Cleanup: Test entry deleted.')

    console.log('Verification Complete. No errors thrown.')
}

main()
    .catch((e) => {
        console.error('VERIFICATION FAILED:', e)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
