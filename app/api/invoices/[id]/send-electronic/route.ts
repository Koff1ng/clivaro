import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import {
  ElectronicBillingConfig,
  sendToElectronicBilling,
  validateInvoiceData,
  calculateCUFE,
  InvoiceData
} from '@/lib/electronic-billing'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  try {
    const tenantId = getTenantIdFromSession(session)

    const result = await withTenantTx(tenantId, async (tx) => {
      // 1. Fetch invoice with all granular tax details
      const invoice = await tx.invoice.findUnique({
        where: { id: params.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              lineTaxes: true,
            },
          },
          taxSummary: true,
        },
      })

      if (!invoice) {
        throw new Error('Factura no encontrada')
      }

      if (invoice.electronicStatus === 'SENT' || invoice.electronicStatus === 'ACCEPTED') {
        throw new Error('La factura ya fue enviada o aceptada por la DIAN')
      }

      // 2. Fetch Tenant Settings for config
      const settings = await tx.tenantSettings.findUnique({
        where: { tenantId },
      })

      if (!settings?.electronicBillingProvider) {
        throw new Error('La configuración de facturación electrónica está incompleta. Por favor, ve a Configuración > Facturación Electrónica y selecciona un proveedor.')
      }

      // 3. Fetch specialized provider config if needed (e.g. Alegra)
      let providerConfig: any = null
      if (settings.electronicBillingProvider === 'ALEGRA') {
        providerConfig = await (tx as any).electronicInvoiceProviderConfig.findUnique({
          where: {
            tenantId_provider: {
              tenantId,
              provider: 'ALEGRA'
            }
          }
        })
      }

      const config: ElectronicBillingConfig = {
        provider: (settings.electronicBillingProvider as any) || 'FEG',
        apiUrl: settings.electronicBillingApiUrl || undefined,
        apiKey: providerConfig?.alegraTokenEncrypted
          ? providerConfig.alegraTokenEncrypted.replace('enc_', '')
          : settings.electronicBillingApiKey || undefined,
        companyNit: settings.companyNit || '900000000-1',
        companyName: settings.companyName || 'Mi Empresa',
        companyAddress: settings.companyAddress || '',
        companyPhone: settings.companyPhone || '',
        companyEmail: providerConfig?.alegraEmail || settings.companyEmail || '',
        resolutionNumber: settings.billingResolutionNumber || '',
        resolutionPrefix: settings.billingResolutionPrefix || 'FV',
        resolutionFrom: settings.billingResolutionFrom || '1',
        resolutionTo: settings.billingResolutionTo || '999999',
        resolutionValidFrom: settings.billingResolutionValidFrom?.toISOString() || new Date().toISOString(),
        resolutionValidTo: settings.billingResolutionValidTo?.toISOString() || new Date().toISOString(),
        environment: (process.env.DIAN_ENVIRONMENT as any) || '2',
        technicalKey: process.env.DIAN_TECHNICAL_KEY, // Should ideally be in settings too
      }

      // 3. Prepare data in the new format
      const invoiceData: InvoiceData = {
        id: invoice.id,
        number: invoice.number,
        prefix: invoice.prefix || 'FV',
        consecutive: invoice.consecutive || invoice.number.split('-')[1] || '',
        issueDate: invoice.issuedAt || invoice.createdAt,
        issueTime: new Date(invoice.createdAt).toLocaleTimeString('es-CO', { hour12: false }) + '-05:00',
        customer: {
          nit: invoice.customer.taxId || '',
          name: invoice.customer.name,
          address: invoice.customer.address || '',
          phone: invoice.customer.phone || '',
          email: invoice.customer.email || '',
        },
        items: invoice.items.map(item => ({
          code: item.product?.sku || '',
          description: item.product?.name || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: item.subtotal,
          taxes: item.lineTaxes.map(lt => ({
            name: lt.name,
            rate: lt.rate,
            baseAmount: lt.baseAmount,
            taxAmount: lt.taxAmount
          }))
        })),
        taxSummary: invoice.taxSummary.map(ts => ({
          name: ts.name,
          rate: ts.rate,
          baseAmount: ts.baseAmount,
          taxAmount: ts.taxAmount
        })),
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
      }

      // 4. Calculate CUFE
      const cufe = calculateCUFE(invoiceData, config)

      // 5. Validar datos
      const validation = validateInvoiceData(invoiceData)
      if (!validation.valid) {
        throw new Error(`Datos de factura inválidos: ${validation.errors.join(', ')}`)
      }

      // 6. Enviar a facturación electrónica
      const submissionResult = await sendToElectronicBilling(invoiceData, config)

      if (submissionResult.success) {
        await tx.invoice.update({
          where: { id: params.id },
          data: {
            cufe: submissionResult.cufe || cufe,
            qrCode: submissionResult.qrCode || null,
            electronicStatus: submissionResult.status?.toUpperCase() || 'SENT',
            electronicSentAt: new Date(),
            electronicResponse: JSON.stringify(submissionResult.response || submissionResult),
          },
        })
        return submissionResult
      } else {
        await tx.invoice.update({
          where: { id: params.id },
          data: {
            electronicStatus: 'REJECTED',
            electronicSentAt: new Date(),
            electronicResponse: JSON.stringify({
              errors: submissionResult.errors,
              message: submissionResult.message,
            }),
          },
        })
        throw new Error(submissionResult.message || 'La DIAN rechazó la factura')
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error sending invoice to electronic billing:', error)
    return NextResponse.json(
      { error: error.message || 'Error al enviar factura' },
      { status: 500 }
    )
  }
}

