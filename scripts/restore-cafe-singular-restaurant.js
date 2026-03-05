/**
 * Runs the restaurant demo seed for cafe-singular using raw SQL
 * to bypass Prisma schema mismatches with older tenant schemas.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const CAFE_SCHEMA = 'tenant_cml5qyzi90004qihnrbt57g6l';
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

function genId() {
    return 'c' + crypto.randomBytes(12).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24);
}

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();
    await client.query(`SET search_path TO "${CAFE_SCHEMA}"`);
    console.log(`✅ Connected to schema: ${CAFE_SCHEMA}\n`);

    // First, carefully clean up the wrong hardware products we just inserted
    console.log('🧹 Cleaning up hardware products previously inserted by mistake...');
    const res = await client.query(`SELECT id FROM "Product" WHERE sku LIKE 'MART-%' OR sku LIKE 'DEST-%' OR sku LIKE 'ALIC-%' OR sku LIKE 'LLAV-%' OR sku LIKE 'TALAD-%' OR sku LIKE 'CLAV-%' OR sku LIKE 'TORN-%' OR sku LIKE 'TUER-%' OR sku LIKE 'TUBO-%' OR sku LIKE 'CODO-%' OR sku LIKE 'VALV-%' OR sku LIKE 'PINT-%' OR sku LIKE 'BROC-%' OR sku LIKE 'RODL-%' OR sku LIKE 'CABL-%' OR sku LIKE 'LAMP-%' OR sku LIKE 'TOMA-%' OR sku LIKE 'BREAK-%' OR sku LIKE 'CEM-%' OR sku LIKE 'AREN-%' OR sku LIKE 'LAD-%'`);
    if (res.rows.length > 0) {
        const ids = res.rows.map(r => r.id);
        const inIds = ids.map((_, i) => `$${i + 1}`).join(',');
        await client.query(`DELETE FROM "InvoiceItem" WHERE "productId" IN (${inIds})`, ids);
        await client.query(`DELETE FROM "StockMovement" WHERE "productId" IN (${inIds})`, ids);
        await client.query(`DELETE FROM "StockLevel" WHERE "productId" IN (${inIds})`, ids);
        // Finally delete the hardware products themselves
        await client.query(`DELETE FROM "Product" WHERE id IN (${inIds})`, ids);
        console.log(`✅ Deleted ${ids.length} hardware products successfully`);
    }

    // Admin user
    let ures = await client.query('SELECT id FROM "User" WHERE active = true LIMIT 1');
    const adminId = ures.rows[0].id;

    // Turn on restaurant mode
    try {
        const tsr = await client.query(`SELECT id FROM "TenantSettings" WHERE "tenantId" = 'cml5qyzi90004qihnrbt57g6l'`);
        if (tsr.rows.length === 0) {
            await client.query(`INSERT INTO "TenantSettings" (id, "tenantId", "enableRestaurantMode", "createdAt", "updatedAt") VALUES ($1, 'cml5qyzi90004qihnrbt57g6l', true, NOW(), NOW())`, [genId()]);
        } else {
            await client.query(`UPDATE "TenantSettings" SET "enableRestaurantMode" = true WHERE "tenantId" = 'cml5qyzi90004qihnrbt57g6l'`);
        }
    } catch (e) { console.log('Notice: TenantSettings table missing or error (safe to ignore if old schema)'); }

    // Units
    console.log('📏 Creating Units...');
    const units = [
        { name: 'Unidad', symbol: 'und' }, { name: 'Kilogramo', symbol: 'kg' }, { name: 'Gramo', symbol: 'g' },
        { name: 'Litro', symbol: 'l' }, { name: 'Mililitro', symbol: 'ml' }
    ];
    const unitMap = new Map();
    for (const u of units) {
        let ur = await client.query('SELECT id FROM "Unit" WHERE symbol = $1', [u.symbol]);
        if (ur.rows.length > 0) {
            unitMap.set(u.symbol, ur.rows[0].id);
        } else {
            const id = genId();
            await client.query(`INSERT INTO "Unit" (id, name, symbol, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`, [id, u.name, u.symbol]);
            unitMap.set(u.symbol, id);
        }
    }

    // Conversions
    if (unitMap.has('kg') && unitMap.has('g')) {
        let cr = await client.query('SELECT id FROM "UnitConversion" WHERE "fromUnitId" = $1 AND "toUnitId" = $2', [unitMap.get('kg'), unitMap.get('g')]);
        if (cr.rows.length === 0) {
            await client.query(`INSERT INTO "UnitConversion" (id, "fromUnitId", "toUnitId", multiplier, "createdAt", "updatedAt") VALUES ($1, $2, $3, 1000, NOW(), NOW())`, [genId(), unitMap.get('kg'), unitMap.get('g')]);
        }
    }

    // Ingredients Data
    console.log('🥩 Creating Ingredients...');
    const ingredientsData = [
        { name: 'Carne de Res Molida', cost: 15000, unit: 'kg', category: 'Carnes' },
        { name: 'Pechuga de Pollo', cost: 12000, unit: 'kg', category: 'Carnes' },
        { name: 'Pan Hamburguesa', cost: 800, unit: 'und', category: 'Panadería' },
        { name: 'Pan Perro Caliente', cost: 700, unit: 'und', category: 'Panadería' },
        { name: 'Salchicha Americana', cost: 1500, unit: 'und', category: 'Carnes' },
        { name: 'Queso Cheddar', cost: 40000, unit: 'kg', category: 'Lácteos' },
        { name: 'Papa Criolla (Para Francesa)', cost: 3000, unit: 'kg', category: 'Verduras' },
        { name: 'Aceite Vegetal', cost: 8000, unit: 'l', category: 'Despensa' },
        { name: 'Salsa Tomate', cost: 10000, unit: 'kg', category: 'Salsas' },
        { name: 'Mayonesa', cost: 12000, unit: 'kg', category: 'Salsas' }
    ];

    const ingredientMap = new Map();
    for (const ing of ingredientsData) {
        let pr = await client.query('SELECT id FROM "Product" WHERE name = $1', [ing.name]);
        let pid;
        if (pr.rows.length === 0) {
            pid = genId();
            const uom = ing.unit === 'und' ? 'UNIT' : (ing.unit === 'kg' ? 'KILO' : 'LITER');
            // "productType" column check
            let pcols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${CAFE_SCHEMA}' AND table_name = 'Product' AND column_name = 'productType'`);
            const hasProdType = pcols.rows.length > 0;

            const cols = ['id', 'sku', 'name', 'cost', 'price', '"unitOfMeasure"', '"trackStock"', '"createdById"', 'category', '"createdAt"', '"updatedAt"', 'active', '"taxRate"'];
            const vals = [pid, `ING-${Math.floor(Math.random() * 100000)}`, ing.name, ing.cost, ing.cost * 1.2, uom, true, adminId, ing.category, 'NOW()', 'NOW()', true, 19];

            if (hasProdType) {
                cols.push('"productType"');
                vals.push('RAW');
            }

            const paramStr = vals.map((v, i) => v === 'NOW()' ? 'NOW()' : `$${i + 1 - (vals.filter((x, j) => x === 'NOW()' && j < i).length)}`).join(', ');
            const filteredVals = vals.filter(v => v !== 'NOW()');

            await client.query(`INSERT INTO "Product" (${cols.join(',')}) VALUES (${paramStr})`, filteredVals);

        } else {
            pid = pr.rows[0].id;
            await client.query(`UPDATE "Product" SET category = $1 WHERE id = $2`, [ing.category, pid]);
        }
        ingredientMap.set(ing.name, pid);
    }

    // Recipes
    console.log('🍽️ Creating Menu Items & Recipes...');
    async function createRecipeProduct(name, price, category, recipeItems) {
        let pr = await client.query('SELECT id FROM "Product" WHERE name = $1', [name]);
        let pid;
        if (pr.rows.length === 0) {
            pid = genId();

            let pcols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${CAFE_SCHEMA}' AND table_name = 'Product' AND column_name IN ('productType', 'enableRecipeConsumption')`);
            const cset = new Set(pcols.rows.map(r => r.column_name));

            const cols = ['id', 'sku', 'name', 'price', 'cost', '"taxRate"', 'category', '"createdById"', '"createdAt"', '"updatedAt"', 'active'];
            const vals = [pid, `MENU-${Math.floor(Math.random() * 100000)}`, name, price, 0, 8, category, adminId, 'NOW()', 'NOW()', true];

            if (cset.has('productType')) { cols.push('"productType"'); vals.push('SELLABLE'); }
            if (cset.has('enableRecipeConsumption')) { cols.push('"enableRecipeConsumption"'); vals.push(true); }

            const paramStr = vals.map((v, i) => v === 'NOW()' ? 'NOW()' : `$${i + 1 - (vals.filter((x, j) => x === 'NOW()' && j < i).length)}`).join(', ');
            const filteredVals = vals.filter(v => v !== 'NOW()');

            await client.query(`INSERT INTO "Product" (${cols.join(',')}) VALUES (${paramStr})`, filteredVals);

            const rid = genId();
            await client.query(`INSERT INTO "Recipe" (id, "productId", yield, active, "createdAt", "updatedAt") VALUES ($1, $2, 1, true, NOW(), NOW())`, [rid, pid]);

            for (const item of recipeItems) {
                const ingId = ingredientMap.get(item.name);
                const uId = unitMap.get(item.unit);
                if (ingId && uId) {
                    await client.query(`INSERT INTO "RecipeItem" (id, "recipeId", "ingredientId", quantity, "unitId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, [genId(), rid, ingId, item.qty, uId]);
                }
            }
        } else {
            pid = pr.rows[0].id;
        }
        return pid;
    }

    await createRecipeProduct('Hamburguesa Clásica', 25000, 'Hamburguesas', [
        { name: 'Carne de Res Molida', qty: 0.150, unit: 'kg' },
        { name: 'Pan Hamburguesa', qty: 1, unit: 'und' },
        { name: 'Queso Cheddar', qty: 0.020, unit: 'kg' },
        { name: 'Salsa Tomate', qty: 0.010, unit: 'kg' },
        { name: 'Mayonesa', qty: 0.010, unit: 'kg' }
    ]);

    await createRecipeProduct('Perro Caliente Especial', 18000, 'Perros Calientes', [
        { name: 'Salchicha Americana', qty: 1, unit: 'und' },
        { name: 'Pan Perro Caliente', qty: 1, unit: 'und' },
        { name: 'Queso Cheddar', qty: 0.015, unit: 'kg' },
        { name: 'Papa Criolla (Para Francesa)', qty: 0.020, unit: 'kg' },
        { name: 'Salsa Tomate', qty: 0.015, unit: 'kg' }
    ]);

    await createRecipeProduct('Papas a la Francesa', 8000, 'Acompañamientos', [
        { name: 'Papa Criolla (Para Francesa)', qty: 0.200, unit: 'kg' },
        { name: 'Aceite Vegetal', qty: 0.010, unit: 'l' }
    ]);

    // Drinks (Retail)
    console.log('🥤 Creating Drinks (Retail)...');
    const drinks = [
        { name: 'Coca Cola 400ml', price: 5000, cost: 2500, category: 'Bebidas' },
        { name: 'Agua Manantial 500ml', price: 4000, cost: 1800, category: 'Bebidas' },
        { name: 'Cerveza Club Colombia', price: 7000, cost: 3500, category: 'Bebidas' }
    ];
    for (const drink of drinks) {
        let pr = await client.query('SELECT id FROM "Product" WHERE name = $1', [drink.name]);
        if (pr.rows.length === 0) {
            let pcols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${CAFE_SCHEMA}' AND table_name = 'Product' AND column_name = 'productType'`);
            const cols = ['id', 'sku', 'name', 'price', 'cost', '"taxRate"', 'category', '"createdById"', '"trackStock"', '"createdAt"', '"updatedAt"', 'active'];
            const vals = [genId(), `DRINK-${Math.floor(Math.random() * 10000)}`, drink.name, drink.price, drink.cost, 19, drink.category, adminId, true, 'NOW()', 'NOW()', true];
            if (pcols.rows.length > 0) { cols.push('"productType"'); vals.push('RETAIL'); }
            const paramStr = vals.map((v, i) => v === 'NOW()' ? 'NOW()' : `$${i + 1 - (vals.filter((x, j) => x === 'NOW()' && j < i).length)}`).join(', ');
            const filteredVals = vals.filter(v => v !== 'NOW()');
            await client.query(`INSERT INTO "Product" (${cols.join(',')}) VALUES (${paramStr})`, filteredVals);
        }
    }

    const pcount = await client.query('SELECT count(*) FROM "Product"');
    console.log(`\n✅ RESTORED. Products count now: ${pcount.rows[0].count}`);

    await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
