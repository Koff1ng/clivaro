import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const providerConfig = await (prisma as any).electronicInvoiceProviderConfig.findFirst({
        where: { provider: 'ALEGRA' }
    })

    if (!providerConfig) {
        console.error('No Alegra config found')
        return
    }

    const email = providerConfig.alegraEmail
    const token = providerConfig.alegraTokenEncrypted.replace('enc_', '')
    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    const baseUrl = 'https://api.alegra.com/api/v1'

    const request = async (endpoint: string) => {
        const res = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        })
        if (!res.ok) {
            console.error(`Error ${endpoint}: ${res.status} ${await res.text()}`)
            return null
        }
        return res.json()
    }

    console.log('--- ITEMS DIAGNOSTIC ---')
    const products = await request('/items?limit=5')
    if (products) {
        products.forEach((p: any) => {
            console.log(`ID: ${p.id} | Name: ${p.name} | Status: "${p.status}" (Type: ${typeof p.status})`)
        })
    }

    console.log('\n--- CUSTOMER DIAGNOSTIC ---')
    // Try to simulate the payload we are sending
    const testPayload = {
        name: "Test Customer Debug",
        identification: "999999999",
        identificationType: "CC",
        email: "test@debug.com",
        address: { address: "Calle Falsa 123" },
        type: ["client"],
        kindOfPerson: "PERSON",
        regime: "SIMPLIFIED"
    }
    console.log('Test Payload:', JSON.stringify(testPayload, null, 2))

    // NOTE: We won't actually create it to avoid spam, just checking if we can auth and maybe search
    const customers = await request('/contacts?limit=1')
    console.log('Existing Customer Structure:', JSON.stringify(customers[0], null, 2))

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
