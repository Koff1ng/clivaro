import { create } from 'xmlbuilder2'
import { InvoiceData, ElectronicBillingConfig, calculateCUFE } from '@/lib/electronic-billing'
import { format } from 'date-fns'

// Namespaces required by DIAN UBL 2.1
const NAMESPACES = {
    'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
    'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
    'xmlns:xades': 'http://uri.etsi.org/01903/v1.3.2#',
    'xmlns:xades141': 'http://uri.etsi.org/01903/v1.4.1#',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd'
}

export function generateInvoiceXML(invoice: InvoiceData, config: ElectronicBillingConfig): string {
    const cufe = calculateCUFE(invoice, config)
    const issueDateStr = format(invoice.issueDate, 'yyyy-MM-dd')
    const issueTimeStr = invoice.issueTime || '00:00:00-05:00'

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', NAMESPACES)

        // 1. Extension Content (For Signature and DIAN extensions)
        .ele('ext:UBLExtensions')
        .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent')
        .ele('sts:DianExtensions')
        .ele('sts:InvoiceControl')
        .ele('sts:InvoiceAuthorization').txt(config.resolutionNumber).up()
        .ele('sts:AuthorizationPeriod')
        .ele('cbc:StartDate').txt(config.resolutionValidFrom).up()
        .ele('cbc:EndDate').txt(config.resolutionValidTo).up()
        .up()
        .ele('sts:AuthorizedInvoices')
        .ele('sts:Prefix').txt(config.resolutionPrefix).up()
        .ele('sts:From').txt(config.resolutionFrom).up()
        .ele('sts:To').txt(config.resolutionTo).up()
        .up()
        .up()
        .ele('sts:InvoiceSource')
        .ele('cbc:IdentificationCode', { listAgencyID: '6', listAgencyName: 'United Nations Economic Commission for Europe', listSchemeURI: 'urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1' }).txt('CO').up()
        .up()
        .ele('sts:SoftwareProvider')
        .ele('sts:ProviderID', { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)', schemeID: '4', schemeName: '31' }).txt(config.companyNit.split('-')[0]).up()
        .ele('sts:SoftwareID', { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)' }).txt(config.softwareId || '').up()
        .up()
        .ele('sts:SoftwareSecurityCode', { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)' })
        .txt(calculateSoftwareSecurityCode(config.softwareId || '', config.softwarePin || '', invoice.number))
        .up()
        .up()
        .up()
        .up()
        // Placeholder for Digital Signature
        .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent').up()
        .up()
        .up()

        // 2. Formato y Version
        .ele('cbc:UBLVersionID').txt('UBL 2.1').up()
        .ele('cbc:CustomizationID').txt('10').up() // 10 = Factura, 11 = Factura Contingencia
        .ele('cbc:ProfileID').txt('DIAN 2.1: Factura Electrónica de Venta').up()
        .ele('cbc:ID').txt(invoice.number).up()
        .ele('cbc:UUID', { schemeID: config.environment === '1' ? '1' : '2', schemeName: 'CUFE-SHA384' }).txt(cufe).up()
        .ele('cbc:IssueDate').txt(issueDateStr).up()
        .ele('cbc:IssueTime').txt(issueTimeStr).up()
        .ele('cbc:InvoiceTypeCode').txt(invoice.typeCode || '01').up()
        .ele('cbc:Note').txt('Factura generada por Ferretería App / Clivaro').up()
        .ele('cbc:DocumentCurrencyCode', { listAgencyID: '6', listAgencyName: 'United Nations Economic Commission for Europe', listID: 'ISO 4217 Alpha' }).txt('COP').up()

        // 3. Emisor (AccountingSupplierParty)
        .ele('cac:AccountingSupplierParty')
        .ele('cbc:AdditionalAccountID').txt('1').up() // 1 = Juridica, 2 = Natural
        .ele('cac:Party')
        .ele('cac:PartyName').ele('cbc:Name').txt(config.companyName).up().up()
        .ele('cac:PhysicalLocation').ele('cac:Address').ele('cbc:CityName').txt('Bogotá').up().up().up() // TODO: Parametrize City
        .ele('cac:PartyTaxScheme')
        .ele('cbc:RegistrationName').txt(config.companyName).up()
        .ele('cbc:CompanyID', { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)', schemeID: getCheckDigit(config.companyNit), schemeName: '31' }).txt(config.companyNit.split('-')[0]).up()
        .ele('cac:TaxScheme').ele('cbc:ID').txt('01').up().ele('cbc:Name').txt('IVA').up().up()
        .up()
        .up()
        .up()

        // 4. Receptor (AccountingCustomerParty)
        .ele('cac:AccountingCustomerParty')
        .ele('cbc:AdditionalAccountID').txt(invoice.customer.isCompany ? '1' : '2').up()
        .ele('cac:Party')
        .ele('cac:PartyTaxScheme')
        .ele('cbc:RegistrationName').txt(invoice.customer.name).up()
        .ele('cbc:CompanyID', { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)', schemeID: getCheckDigit(invoice.customer.nit), schemeName: '31' }).txt(invoice.customer.nit.split('-')[0]).up()
        .ele('cac:TaxScheme').ele('cbc:ID').txt('01').up().ele('cbc:Name').txt('IVA').up().up()
        .up()
        .up()
        .up()

        // 5. Totales (LegalMonetaryTotal)
        .ele('cac:LegalMonetaryTotal')
        .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(invoice.subtotal.toFixed(2)).up()
        .ele('cbc:TaxExclusiveAmount', { currencyID: 'COP' }).txt(invoice.subtotal.toFixed(2)).up()
        .ele('cbc:TaxInclusiveAmount', { currencyID: 'COP' }).txt(invoice.total.toFixed(2)).up()
        .ele('cbc:PayableAmount', { currencyID: 'COP' }).txt(invoice.total.toFixed(2)).up()
        .up()

    // 6. Items

    invoice.items.forEach((item, index) => {
        const line = doc.ele('cac:InvoiceLine')
            .ele('cbc:ID').txt((index + 1).toString()).up()
            .ele('cbc:InvoicedQuantity', { unitCode: 'EA' }).txt(item.quantity.toFixed(6)).up()
            .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(item.subtotal.toFixed(2)).up()
            .ele('cac:Item')
            .ele('cbc:Description').txt(item.description).up()
            .up()
            .ele('cac:Price')
            .ele('cbc:PriceAmount', { currencyID: 'COP' }).txt(item.unitPrice.toFixed(2)).up()
            .up()
            .up()
    })

    return doc.end({ prettyPrint: true })
}

function calculateSoftwareSecurityCode(id: string, pin: string, invoiceNum: string) {
    // SHA384(SoftwareID + PIN + Number)
    const crypto = require('crypto')
    return crypto.createHash('sha384').update(id + pin + invoiceNum).digest('hex')
}

function getCheckDigit(nit: string): string {
    const parts = nit.split('-')
    if (parts.length > 1) return parts[1]

    // Fallback calc if not provided
    return '0'
}
