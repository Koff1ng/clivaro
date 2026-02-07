
export const PUC_TEMPLATE = [
    // CLASE 1: ACTIVO
    { code: '1', name: 'ACTIVO', type: 'ASSET', nature: 'DEBIT' },
    { code: '11', name: 'DISPONIBLE', type: 'ASSET', nature: 'DEBIT' },
    { code: '1105', name: 'CAJA', type: 'ASSET', tags: ['CASH'], nature: 'DEBIT' },
    { code: '110505', name: 'Caja general', type: 'ASSET', tags: ['CASH'], nature: 'DEBIT' },
    { code: '1110', name: 'BANCOS', type: 'ASSET', tags: ['BANK'], nature: 'DEBIT' },
    { code: '111005', name: 'Moneda nacional', type: 'ASSET', tags: ['BANK'], nature: 'DEBIT' },
    { code: '13', name: 'DEUDORES', type: 'ASSET', nature: 'DEBIT' },
    { code: '1305', name: 'CLIENTES', type: 'ASSET', tags: ['RECEIVABLE'], nature: 'DEBIT' },
    { code: '130505', name: 'Nacionales', type: 'ASSET', tags: ['RECEIVABLE'], nature: 'DEBIT' },
    { code: '14', name: 'INVENTARIOS', type: 'ASSET', nature: 'DEBIT' },
    { code: '1435', name: 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', type: 'ASSET', nature: 'DEBIT' },
    { code: '15', name: 'PROPIEDAD, PLANTA Y EQUIPO', type: 'ASSET', nature: 'DEBIT' },

    // CLASE 2: PASIVO
    { code: '2', name: 'PASIVO', type: 'LIABILITY', nature: 'CREDIT' },
    { code: '22', name: 'PROVEEDORES', type: 'LIABILITY', nature: 'CREDIT' },
    { code: '2205', name: 'Nacionales', type: 'LIABILITY', tags: ['PAYABLE'], nature: 'CREDIT' },
    { code: '23', name: 'CUENTAS POR PAGAR', type: 'LIABILITY', nature: 'CREDIT' },
    { code: '2335', name: 'Costos y gastos por pagar', type: 'LIABILITY', nature: 'CREDIT' },
    { code: '2365', name: 'RETENCIÓN EN LA FUENTE', type: 'LIABILITY', tags: ['RETENTION_SOURCE'], nature: 'CREDIT' },
    { code: '236540', name: 'Compras', type: 'LIABILITY', nature: 'CREDIT' },
    { code: '2367', name: 'IMPUESTO A LAS VENTAS RETENIDO', type: 'LIABILITY', tags: ['RETENTION_IVA'], nature: 'CREDIT' },
    { code: '2368', name: 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', type: 'LIABILITY', tags: ['RETENTION_ICA'], nature: 'CREDIT' },
    { code: '24', name: 'IMPUESTOS, GRAVÁMENES Y TASAS', type: 'LIABILITY', tags: ['TAX'], nature: 'CREDIT' },
    { code: '2408', name: 'IMPUESTO SOBRE LAS VENTAS POR PAGAR', type: 'LIABILITY', tags: ['VAT'], nature: 'CREDIT' },
    { code: '240805', name: 'IVA Generado', type: 'LIABILITY', tags: ['VAT_GENERATED'], nature: 'CREDIT' },
    { code: '240810', name: 'IVA Descontable', type: 'LIABILITY', tags: ['VAT_DEDUCTIBLE'], nature: 'DEBIT' }, // IVA descontable es debito!


    // CLASE 3: PATRIMONIO
    { code: '3', name: 'PATRIMONIO', type: 'EQUITY', nature: 'CREDIT' },
    { code: '31', name: 'CAPITAL SOCIAL', type: 'EQUITY', nature: 'CREDIT' },
    { code: '3115', name: 'Aportes sociales', type: 'EQUITY', nature: 'CREDIT' },
    { code: '36', name: 'RESULTADOS DEL EJERCICIO', type: 'EQUITY', nature: 'CREDIT' },
    { code: '3605', name: 'Utilidad del ejercicio', type: 'EQUITY', nature: 'CREDIT' },

    // CLASE 4: INGRESOS
    { code: '4', name: 'INGRESOS', type: 'INCOME', nature: 'CREDIT' },
    { code: '41', name: 'OPERACIONALES', type: 'INCOME', nature: 'CREDIT' },
    { code: '4135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', type: 'INCOME', nature: 'CREDIT' },

    // CLASE 5: GASTOS
    { code: '5', name: 'GASTOS', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '51', name: 'OPERACIONALES DE ADMINISTRACIÓN', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '5105', name: 'GASTOS DE PERSONAL', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '5115', name: 'IMPUESTOS', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '5135', name: 'SERVICIOS', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '52', name: 'OPERACIONALES DE VENTAS', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '53', name: 'NO OPERACIONALES', type: 'EXPENSE', nature: 'DEBIT' },
    { code: '5305', name: 'FINANCIEROS', type: 'EXPENSE', nature: 'DEBIT' },

    // CLASE 6: COSTOS DE VENTAS
    { code: '6', name: 'COSTOS DE VENTAS', type: 'COST_SALES', nature: 'DEBIT' },
    { code: '61', name: 'COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS', type: 'COST_SALES', nature: 'DEBIT' },
    { code: '6135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', type: 'COST_SALES', nature: 'DEBIT' },
]
