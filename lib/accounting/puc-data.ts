
export const PUC_TEMPLATE = [
    // CLASE 1: ACTIVO
    { code: '1', name: 'ACTIVO', type: 'ASSET' },
    { code: '11', name: 'DISPONIBLE', type: 'ASSET' },
    { code: '1105', name: 'CAJA', type: 'ASSET', tags: ['CASH'] },
    { code: '110505', name: 'Caja general', type: 'ASSET', tags: ['CASH'] },
    { code: '1110', name: 'BANCOS', type: 'ASSET', tags: ['BANK'] },
    { code: '111005', name: 'Moneda nacional', type: 'ASSET', tags: ['BANK'] },
    { code: '13', name: 'DEUDORES', type: 'ASSET' },
    { code: '1305', name: 'CLIENTES', type: 'ASSET', tags: ['RECEIVABLE'] },
    { code: '130505', name: 'Nacionales', type: 'ASSET', tags: ['RECEIVABLE'] },
    { code: '14', name: 'INVENTARIOS', type: 'ASSET' },
    { code: '1435', name: 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', type: 'ASSET' },
    { code: '15', name: 'PROPIEDAD, PLANTA Y EQUIPO', type: 'ASSET' },

    // CLASE 2: PASIVO
    { code: '2', name: 'PASIVO', type: 'LIABILITY' },
    { code: '22', name: 'PROVEEDORES', type: 'LIABILITY' },
    { code: '2205', name: 'Nacionales', type: 'LIABILITY', tags: ['PAYABLE'] },
    { code: '23', name: 'CUENTAS POR PAGAR', type: 'LIABILITY' },
    { code: '2335', name: 'Costos y gastos por pagar', type: 'LIABILITY' },
    { code: '2365', name: 'RETENCIÓN EN LA FUENTE', type: 'LIABILITY', tags: ['RETENTION_SOURCE'] },
    { code: '236540', name: 'Compras', type: 'LIABILITY' },
    { code: '2367', name: 'IMPUESTO A LAS VENTAS RETENIDO', type: 'LIABILITY', tags: ['RETENTION_IVA'] },
    { code: '2368', name: 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', type: 'LIABILITY', tags: ['RETENTION_ICA'] },
    { code: '24', name: 'IMPUESTOS, GRAVÁMENES Y TASAS', type: 'LIABILITY', tags: ['TAX'] },
    { code: '2408', name: 'IMPUESTO SOBRE LAS VENTAS POR PAGAR', type: 'LIABILITY', tags: ['VAT'] },
    { code: '240805', name: 'IVA Generado', type: 'LIABILITY', tags: ['VAT_GENERATED'] },
    { code: '240810', name: 'IVA Descontable', type: 'LIABILITY', tags: ['VAT_DEDUCTIBLE'] },

    // CLASE 3: PATRIMONIO
    { code: '3', name: 'PATRIMONIO', type: 'EQUITY' },
    { code: '31', name: 'CAPITAL SOCIAL', type: 'EQUITY' },
    { code: '3115', name: 'Aportes sociales', type: 'EQUITY' },
    { code: '36', name: 'RESULTADOS DEL EJERCICIO', type: 'EQUITY' },
    { code: '3605', name: 'Utilidad del ejercicio', type: 'EQUITY' },

    // CLASE 4: INGRESOS
    { code: '4', name: 'INGRESOS', type: 'INCOME' },
    { code: '41', name: 'OPERACIONALES', type: 'INCOME' },
    { code: '4135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', type: 'INCOME' },

    // CLASE 5: GASTOS
    { code: '5', name: 'GASTOS', type: 'EXPENSE' },
    { code: '51', name: 'OPERACIONALES DE ADMINISTRACIÓN', type: 'EXPENSE' },
    { code: '5105', name: 'GASTOS DE PERSONAL', type: 'EXPENSE' },
    { code: '5115', name: 'IMPUESTOS', type: 'EXPENSE' },
    { code: '5135', name: 'SERVICIOS', type: 'EXPENSE' },
    { code: '52', name: 'OPERACIONALES DE VENTAS', type: 'EXPENSE' },
    { code: '53', name: 'NO OPERACIONALES', type: 'EXPENSE' },
    { code: '5305', name: 'FINANCIEROS', type: 'EXPENSE' },

    // CLASE 6: COSTOS DE VENTAS
    { code: '6', name: 'COSTOS DE VENTAS', type: 'COST_SALES' },
    { code: '61', name: 'COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS', type: 'COST_SALES' },
    { code: '6135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', type: 'COST_SALES' },
]
