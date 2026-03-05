/**
 * Restores cafe-singular demo data using raw pg.Client SQL inserts
 * to avoid Prisma schema mismatch errors (newer Prisma schema vs older tenant schema).
 */
const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const CAFE_SCHEMA = 'tenant_cml5qyzi90004qihnrbt57g6l';
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

function genId() {
    // Generate a cuid-like id
    return 'c' + crypto.randomBytes(12).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24);
}

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    // Set search path to cafe-singular schema
    await client.query(`SET search_path TO "${CAFE_SCHEMA}"`);
    console.log(`✅ Connected to schema: ${CAFE_SCHEMA}\n`);

    // Get admin user
    let res = await client.query('SELECT id, username FROM "User" WHERE active = true LIMIT 1');
    if (res.rows.length === 0) {
        throw new Error('No active user found in cafe-singular schema');
    }
    const adminUser = res.rows[0];
    console.log(`✅ Admin user: ${adminUser.username} (${adminUser.id})`);

    // Get or create warehouses
    async function upsertWarehouse(name, address) {
        let r = await client.query('SELECT id FROM "Warehouse" WHERE name = $1', [name]);
        if (r.rows.length > 0) return r.rows[0].id;
        const id = genId();
        await client.query(
            'INSERT INTO "Warehouse" (id, name, address, active, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, NOW(), NOW())',
            [id, name, address]
        );
        return id;
    }

    const wh1Id = await upsertWarehouse('Almacén Principal', 'Calle Industrial 123');
    const wh2Id = await upsertWarehouse('Almacén Sucursal Centro', 'Avenida Principal 456');
    console.log(`✅ Warehouses: ${wh1Id}, ${wh2Id}`);

    // Get existing product columns to avoid inserting non-existent columns
    res = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = 'Product'
    ORDER BY ordinal_position
  `, [CAFE_SCHEMA]);
    const productColumns = new Set(res.rows.map(r => r.column_name));
    console.log(`Product table has ${productColumns.size} columns`);

    // Products to seed
    const productsData = [
        { sku: 'MART-001', barcode: '7701234567890', name: 'Martillo de Acero 16oz', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 15.50, price: 28.00, taxRate: 19, trackStock: true },
        { sku: 'DEST-002', barcode: '7701234567891', name: 'Destornillador Phillips #2', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 5.00, price: 9.50, taxRate: 19, trackStock: true },
        { sku: 'ALIC-003', barcode: '7701234567892', name: 'Alicates Universales 8"', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
        { sku: 'LLAV-004', barcode: '7701234567893', name: 'Juego de Llaves Mixtas 10pcs', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'SET', cost: 35.00, price: 65.00, taxRate: 19, trackStock: true },
        { sku: 'TALAD-005', barcode: '7701234567894', name: 'Taladro Eléctrico 750W', brand: 'PowerTool', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 85.00, price: 150.00, taxRate: 19, trackStock: true },
        { sku: 'CLAV-006', barcode: '7701234567895', name: 'Clavos 2.5" x 1kg', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'KILO', cost: 3.50, price: 6.50, taxRate: 19, trackStock: true },
        { sku: 'TORN-007', barcode: '7701234567896', name: 'Tornillos 3/8" x 1kg', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'KILO', cost: 4.50, price: 8.50, taxRate: 19, trackStock: true },
        { sku: 'TUER-008', barcode: '7701234567897', name: 'Tuercas y Arandelas Juego', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'BOX', cost: 8.00, price: 15.00, taxRate: 19, trackStock: true },
        { sku: 'TUBO-009', barcode: '7701234567898', name: 'Tubo PVC 1/2" x 6m', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'METER', cost: 2.00, price: 4.00, taxRate: 19, trackStock: true },
        { sku: 'CODO-010', barcode: '7701234567899', name: 'Codo PVC 1/2" 90°', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'UNIT', cost: 0.80, price: 1.50, taxRate: 19, trackStock: true },
        { sku: 'VALV-011', barcode: '7701234567900', name: 'Válvula de Compuerta 1/2"', brand: 'Plomería Plus', category: 'Plomería', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
        { sku: 'PINT-012', barcode: '7701234567901', name: 'Pintura Blanca Mate 1L', brand: 'Color Plus', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 12.00, price: 22.00, taxRate: 19, trackStock: true },
        { sku: 'PINT-013', barcode: '7701234567902', name: 'Pintura Blanca Mate 4L', brand: 'Color Plus', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 45.00, price: 80.00, taxRate: 19, trackStock: true },
        { sku: 'BROC-014', barcode: '7701234567903', name: 'Brocha 4" Profesional', brand: 'Pinturas', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 4.00, price: 8.00, taxRate: 19, trackStock: true },
        { sku: 'RODL-015', barcode: '7701234567904', name: 'Rodillo 9" con Mango', brand: 'Pinturas', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 6.00, price: 12.00, taxRate: 19, trackStock: true },
        { sku: 'CABL-016', barcode: '7701234567905', name: 'Cable Eléctrico 2.5mm x 100m', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 1.50, price: 3.00, taxRate: 19, trackStock: true },
        { sku: 'LAMP-017', barcode: '7701234567906', name: 'Lámpara LED 12W E27', brand: 'Iluminación LED', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 8.00, price: 15.00, taxRate: 19, trackStock: true },
        { sku: 'TOMA-018', barcode: '7701234567907', name: 'Tomacorriente Simple', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 3.50, price: 7.00, taxRate: 19, trackStock: true },
        { sku: 'BREAK-019', barcode: '7701234567908', name: 'Breaker 20A Monopolar', brand: 'Electric Pro', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 15.00, price: 28.00, taxRate: 19, trackStock: true },
        { sku: 'CEM-020', barcode: '7701234567909', name: 'Cemento Gris 50kg', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'BAG', cost: 18.00, price: 32.00, taxRate: 19, trackStock: true },
        { sku: 'AREN-021', barcode: '7701234567910', name: 'Arena Fina x m³', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'CUBIC_METER', cost: 25.00, price: 45.00, taxRate: 19, trackStock: true },
        { sku: 'LAD-022', barcode: '7701234567911', name: 'Ladrillo Común x 1000', brand: 'Construcción', category: 'Construcción', unitOfMeasure: 'THOUSAND', cost: 120.00, price: 220.00, taxRate: 19, trackStock: true },
    ];

    const createdProducts = [];
    for (const p of productsData) {
        let r = await client.query('SELECT id FROM "Product" WHERE sku = $1', [p.sku]);
        if (r.rows.length > 0) {
            createdProducts.push({ id: r.rows[0].id, ...p });
            continue;
        }
        const id = genId();
        // Build INSERT with only existing columns
        const cols = ['id', 'sku', 'name', 'cost', 'price', '"taxRate"', '"trackStock"', '"active"', '"createdAt"', '"updatedAt"', '"createdById"'];
        const vals = [id, p.sku, p.name, p.cost, p.price, p.taxRate, p.trackStock, true, 'NOW()', 'NOW()', adminUser.id];

        const optionalCols = { barcode: p.barcode, brand: p.brand, category: p.category, '"unitOfMeasure"': p.unitOfMeasure };
        for (const [col, val] of Object.entries(optionalCols)) {
            const colName = col.replace(/"/g, '');
            if (productColumns.has(colName)) { cols.push(col); vals.push(val); }
        }

        // Build query
        const colStr = cols.join(', ');
        const paramStr = vals.map((v, i) => v === 'NOW()' ? 'NOW()' : `$${i + 1 - (vals.filter((x, j) => x === 'NOW()' && j < i).length)}`).join(', ');
        const filteredVals = vals.filter(v => v !== 'NOW()');

        try {
            // Simpler approach: just insert with known safe columns
            await client.query(
                `INSERT INTO "Product" (id, sku, name, cost, price, "taxRate", "trackStock", active, "createdAt", "updatedAt", "createdById", barcode, brand, category, "unitOfMeasure")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), $8, $9, $10, $11, $12)
         ON CONFLICT (sku) DO NOTHING`,
                [id, p.sku, p.name, p.cost, p.price, p.taxRate, p.trackStock, adminUser.id, p.barcode, p.brand, p.category, p.unitOfMeasure]
            );
            createdProducts.push({ id, ...p });
        } catch (e) {
            // Retry without optional columns if there's a column error
            try {
                await client.query(
                    `INSERT INTO "Product" (id, sku, name, cost, price, "taxRate", "trackStock", active, "createdAt", "updatedAt", "createdById")
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), $8)
           ON CONFLICT (sku) DO NOTHING`,
                    [id, p.sku, p.name, p.cost, p.price, p.taxRate, p.trackStock, adminUser.id]
                );
                createdProducts.push({ id, ...p });
            } catch (e2) {
                console.warn(`  ~ Skipped ${p.sku}: ${e2.message.slice(0, 80)}`);
            }
        }
    }
    console.log(`✅ ${createdProducts.length} products seeded`);

    // Stock levels — StockLevel has: id, warehouseId, productId, quantity, minStock, maxStock, updatedAt (NO createdAt)
    for (const p of createdProducts) {
        const r = await client.query('SELECT id FROM "StockLevel" WHERE "warehouseId" = $1 AND "productId" = $2', [wh1Id, p.id]);
        if (r.rows.length === 0) {
            const qty = Math.floor(Math.random() * 200) + 50;
            const slId = genId();
            await client.query(
                `INSERT INTO "StockLevel" (id, "warehouseId", "productId", quantity, "minStock", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW())`,
                [slId, wh1Id, p.id, qty, Math.floor(qty * 0.2)]
            );
            // StockMovement has: id, warehouseId, productId, type, quantity, cost, reference, reason, createdAt, createdById (NO updatedAt)
            const smId = genId();
            await client.query(
                `INSERT INTO "StockMovement" (id, "warehouseId", "productId", type, quantity, cost, reason, "createdById", reference, "createdAt")
         VALUES ($1, $2, $3, 'IN', $4, $5, 'Stock inicial restaurado', $6, 'RESTORE-001', NOW())`,
                [smId, wh1Id, p.id, qty, p.cost, adminUser.id]
            );
        }
    }
    console.log('✅ Stock levels seeded');


    // Customers
    const customersData = [
        { name: 'Constructora ABC S.A.S.', phone: '+57 300 123 4567', email: 'compras@constructoraabc.com', address: 'Calle 100 #50-30, Bogotá', taxId: '900123456-1' },
        { name: 'Juan Pérez', phone: '+57 310 234 5678', email: 'juan.perez@email.com', address: 'Carrera 15 #45-20, Medellín', taxId: '1234567890' },
        { name: 'María García', phone: '+57 320 345 6789', email: 'maria.garcia@email.com', address: 'Avenida 68 #12-45, Cali', taxId: '9876543210' },
        { name: 'Pedro López', phone: '+57 315 456 7890', email: 'pedro.lopez@email.com', address: 'Calle 72 #10-15, Barranquilla', taxId: '1122334455' },
        { name: 'Ana Martínez', phone: '+57 300 567 8901', email: 'ana.martinez@email.com', address: 'Carrera 30 #25-10, Bucaramanga', taxId: '5566778899' },
        { name: 'Carlos Ruiz', phone: '+57 310 678 9012', email: 'carlos.ruiz@email.com', address: 'Avenida 19 #80-50, Bogotá', taxId: '9988776655' },
        { name: 'Inmobiliaria XYZ Ltda.', phone: '+57 1 234 5678', email: 'contacto@inmobiliariaxyz.com', address: 'Calle 93 #11-20, Bogotá', taxId: '800987654-1' },
        { name: 'Laura Sánchez', phone: '+57 320 789 0123', email: 'laura.sanchez@email.com', address: 'Carrera 50 #40-30, Medellín', taxId: '4433221100' },
        { name: 'Roberto Torres', phone: '+57 315 890 1234', email: 'roberto.torres@email.com', address: 'Avenida 6N #28-15, Cali', taxId: '6677889900' },
        { name: 'Diseños y Construcciones S.A.', phone: '+57 1 345 6789', email: 'ventas@disenyosconstrucciones.com', address: 'Calle 127 #7-30, Bogotá', taxId: '900456789-1' },
    ];

    const createdCustomers = [];
    for (const c of customersData) {
        let r = await client.query('SELECT id FROM "Customer" WHERE "taxId" = $1', [c.taxId]);
        if (r.rows.length > 0) { createdCustomers.push({ id: r.rows[0].id }); continue; }
        const id = genId();
        try {
            await client.query(
                `INSERT INTO "Customer" (id, name, phone, email, address, "taxId", "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                [id, c.name, c.phone, c.email, c.address, c.taxId, adminUser.id]
            );
            createdCustomers.push({ id });
        } catch (e) { console.warn(`  ~ Customer ${c.name}: ${e.message.slice(0, 60)}`); }
    }
    console.log(`✅ ${createdCustomers.length} customers seeded`);

    // Invoices (6)
    for (let i = 0; i < 6; i++) {
        const custId = createdCustomers[i % createdCustomers.length]?.id;
        if (!custId) continue;
        const invNum = `FV-${String(1000 + i).padStart(4, '0')}`;
        const r = await client.query('SELECT id FROM "Invoice" WHERE number = $1', [invNum]);
        if (r.rows.length > 0) continue;

        const statuses = ['EMITIDA', 'PAGADA', 'PARCIAL'];
        const status = statuses[i % statuses.length];
        const invId = genId();
        let subtotal = 0;
        const product = createdProducts[i % createdProducts.length];
        const qty = 5;
        subtotal = qty * product.price;
        const tax = subtotal * 0.19;
        const total = subtotal + tax;

        try {
            await client.query(
                `INSERT INTO "Invoice" (id, number, prefix, consecutive, "customerId", status, "issuedAt", "dueDate", subtotal, discount, tax, total, "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'FV', $3, $4, $5, NOW(), NOW() + INTERVAL '30 days', $6, 0, $7, $8, $9, NOW(), NOW())`,
                [invId, invNum, String(1000 + i), custId, status, subtotal, tax, total, adminUser.id]
            );
            await client.query(
                `INSERT INTO "InvoiceItem" (id, "invoiceId", "productId", quantity, "unitPrice", discount, "taxRate", subtotal, "createdAt")
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7, NOW())`,
                [genId(), invId, product.id, qty, product.price, product.taxRate, subtotal]
            );
            if (status === 'PAGADA') {
                await client.query(
                    `INSERT INTO "Payment" (id, "invoiceId", amount, method, reference, "createdById", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'CASH', $4, $5, NOW(), NOW())`,
                    [genId(), invId, total, `PAGO-${invNum}`, adminUser.id]
                );
            }
        } catch (e) { console.warn(`  ~ Invoice ${invNum}: ${e.message.slice(0, 80)}`); }
    }
    console.log('✅ 6 invoices seeded');

    // Final verification
    const prodCount = (await client.query('SELECT COUNT(*) FROM "Product"')).rows[0].count;
    const custCount = (await client.query('SELECT COUNT(*) FROM "Customer"')).rows[0].count;
    const invCount = (await client.query('SELECT COUNT(*) FROM "Invoice"')).rows[0].count;
    const slCount = (await client.query('SELECT COUNT(*) FROM "StockLevel"')).rows[0].count;

    console.log(`\n✅ RESTORED — cafe-singular schema now has:`);
    console.log(`   Products:    ${prodCount}`);
    console.log(`   Customers:   ${custCount}`);
    console.log(`   Invoices:    ${invCount}`);
    console.log(`   StockLevels: ${slCount}`);

    await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
