/**
 * Test script for Factus Sandbox API
 */
import * as fs from 'fs'

const FACTUS_SANDBOX = {
  baseUrl: 'https://api-sandbox.factus.com.co',
  clientId: 'a1628f7a-4247-42ea-a898-11dfe3b71490',
  clientSecret: '2P2t1k4PF0KDCwU7gGdtiX9smhkcvTWLHeddzpNa',
  username: 'sandbox@factus.com.co',
  password: 'sandbox2024%',
}

const log: string[] = []
function out(msg: string) { log.push(msg); console.log(msg) }

async function main() {
  out('=== FACTUS SANDBOX TEST v2 ===\n')

  // Auth
  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('client_id', FACTUS_SANDBOX.clientId)
  formData.append('client_secret', FACTUS_SANDBOX.clientSecret)
  formData.append('username', FACTUS_SANDBOX.username)
  formData.append('password', FACTUS_SANDBOX.password)

  const authRes = await fetch(`${FACTUS_SANDBOX.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
  const authData = await authRes.json()
  out(`Auth: ${authRes.status} - ${authData.token_type} (${authData.expires_in}s)`)
  const token = authData.access_token

  // Create invoice - Using range ID 8 (Factura de Venta, prefix SETP)
  // Fix: reference_code is required, use 'identification' instead of 'identification_number'
  const invoicePayload = {
    document: '01',
    numbering_range_id: 8,
    reference_code: 'CLV-TEST-001',
    observation: 'Factura de prueba Clivaro ERP',
    payment_form: 1,
    payment_method_code: '10',
    customer: {
      identification_document_id: 1,
      identification: '123456789',
      names: 'Cliente de Prueba Clivaro',
      address: 'Calle 123 45-67 Cali',
      email: 'prueba@clivaro.app',
      phone: '3001234567',
      legal_organization_id: 2,
      tribute_id: 21,
      municipality_id: 1,
    },
    items: [
      {
        code_reference: 'PROD-001',
        name: 'Producto de Prueba',
        quantity: 2,
        discount_rate: 0,
        price: 50000,
        tax_rate: 19,
        unit_measure_id: 70,
        standard_code_id: 1,
        is_excluded: 0,
        tribute_id: 1,
      },
    ],
    send_email: false,
  }

  out('\nCreating invoice...')
  const invoiceRes = await fetch(`${FACTUS_SANDBOX.baseUrl}/v1/bills/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(invoicePayload),
  })

  const invoiceData = await invoiceRes.json()
  out(`Invoice status: ${invoiceRes.status}`)
  out(`Response: ${JSON.stringify(invoiceData, null, 2)}`)

  fs.writeFileSync('C:/tmp/factus-test-v2.txt', log.join('\n'), 'utf-8')
}

main().catch(e => {
  out(`ERROR: ${e.message}`)
  fs.writeFileSync('C:/tmp/factus-test-v2.txt', log.join('\n'), 'utf-8')
})
