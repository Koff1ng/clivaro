import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- DIAGNOSTIC START ---')

    const configs = await (prisma as any).electronicInvoiceProviderConfig.findMany({
        where: { provider: 'ALEGRA' }
    })

    console.log(`Found ${configs.length} Alegra configurations.`)

    for (const config of configs) {
        console.log(`Checking config ID: ${config.id} | Email: ${config.alegraEmail}`)

        // Try both raw (if it doesn't have enc_) and cleaned
        const rawToken = config.alegraTokenEncrypted
        const cleanedToken = rawToken.replace('enc_', '')

        // Try Auth
        const success = await tryAuth(config.alegraEmail, cleanedToken)
        if (!success && cleanedToken !== rawToken) {
            console.log('Retrying with raw token...')
            await tryAuth(config.alegraEmail, rawToken)
        }
    }
}

async function tryAuth(email: string, token: string) {
    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    const baseUrl = 'https://api.alegra.com/api/v1'

    try {
        const res = await fetch(`${baseUrl}/items?limit=3`, {
            headers: { 'Authorization': authHeader }
        })

        // Start creation tests only for success auth
        if (res.ok) {
            console.log('✅ AUTH SUCCESS')

            // 1. Get Numbering Templates
            console.log('--- NUMBERING TEMPLATES ---')
            const resTemplates = await fetch(`${baseUrl}/number-templates`, {
                headers: { 'Authorization': authHeader }
            })
            if (resTemplates.ok) {
                const templates = await resTemplates.json()
                console.log(JSON.stringify(templates, null, 2))
            } else {
                console.error('❌ TEMPLATES FAILED:', await resTemplates.text())
            }

            return true // Stop here for now
            // 1. Tes Create Customer
            type: ["client"],
                kindOfPerson: "PERSON",
                    regime: "SIMPLIFIED"
        }

        const resCust = await fetch(`${baseUrl}/contacts`, {
            method: 'POST',
            body: JSON.stringify(customerPayload),
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        })

        if (resCust.ok) {
            console.log('✅ CUSTOMER CREATED:', await resCust.json())
        } else {
            console.error('❌ CUSTOMER FAILED:', await resCust.text())
        }

        // 1. Tes Create Customer - VARIATION 1 (identificationObject)
        console.log('--- ATTEMPTING CREATE CUSTOMER VARIATION 1 ---')
        const customerPayloadV1 = {
            name: "Customer Debug V1 " + Date.now(),
            identificationObject: { type: "CC", number: "999" + Math.floor(Math.random() * 10000) },
            email: "debugv1@test.com",
            address: { address: "Calle Test" },
            type: ["client"],
            kindOfPerson: "PERSON",
            regime: "SIMPLIFIED"
        }

        const resCustV1 = await fetch(`${baseUrl}/contacts`, {
            method: 'POST',
            body: JSON.stringify(customerPayloadV1),
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        })

        if (resCustV1.ok) {
            console.log('✅ CUSTOMER CREATED V1:', await resCustV1.json())
        } else {
            console.error('❌ CUSTOMER FAILED V1:', await resCustV1.text())
        }

        // 1. Tes Create Customer - VARIATION 2 (identificationObject with Code)
        console.log('--- ATTEMPTING CREATE CUSTOMER VARIATION 2 ---')
        const customerPayloadV2 = {
            name: "Customer Debug V2 " + Date.now(),
            identificationObject: { type: "13", number: "999" + Math.floor(Math.random() * 10000) },
            email: "debugv2@test.com",
            address: { address: "Calle Test" },
            type: ["client"],
            kindOfPerson: "PERSON",
            regime: "SIMPLIFIED"
        }

        const resCustV2 = await fetch(`${baseUrl}/contacts`, {
            method: 'POST',
            body: JSON.stringify(customerPayloadV2),
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        })

        if (resCustV2.ok) {
            console.log('✅ CUSTOMER CREATED V2:', await resCustV2.json())
        } else {
            console.error('❌ CUSTOMER FAILED V2:', await resCustV2.text())
        }

        // Check contact types
        const res2 = await fetch(`${baseUrl}/identification-types`, {
            headers: { 'Authorization': authHeader }
        })
        if (res2.ok) {
            const types = await res2.json()
            console.log('--- ID TYPES SAMPLE ---')
            console.log(JSON.stringify(types, null, 2))
        } else {
            console.error('❌ ID TYPES FAILED:', await res2.text())
        }

        // 2. Test Create Item
        console.log('--- ATTEMPTING CREATE ITEM ---')
        const itemPayload = {
            name: "Item Debug " + Date.now(),
            price: 100,
            inventory: { unit: "unit" } // minimal
        }
        const resItem = await fetch(`${baseUrl}/items`, {
            method: 'POST',
            body: JSON.stringify(itemPayload),
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        })

        if (resItem.ok) {
            console.log('✅ ITEM CREATED:', await resItem.json())
        } else {
            console.error('❌ ITEM FAILED:', await resItem.text())
        }

        return true
    } else {
        console.error(`❌ AUTH FAILED: ${res.status} ${res.statusText}`)
        return false
    }
} catch (e: any) {
    console.error(`❌ EXCEPTION: ${e.message}`)
    return false
}
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
