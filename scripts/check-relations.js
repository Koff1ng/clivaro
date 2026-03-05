const { Client } = require('pg');

const CAFE_SCHEMA = 'tenant_cml5qyzi90004qihnrbt57g6l';
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    await client.query(`SET search_path TO "${CAFE_SCHEMA}"`);

    // Try imitating Prisma's join to see if a foreign key is broken
    // If Prisma tries to include Recipe and its items, but the data is corrupt, it might fail.
    let res = await client.query(`
    SELECT p.id, p.name, 
           (SELECT COUNT(*) FROM "ProductVariant" WHERE "productId" = p.id) as variants,
           (SELECT COUNT(*) FROM "StockLevel" WHERE "productId" = p.id) as stocks,
           (SELECT COUNT(*) FROM "Recipe" WHERE "productId" = p.id) as recipes
    FROM "Product" p
    WHERE p.active = true
    LIMIT 10
  `);

    console.log("Products overview:", JSON.parse(JSON.stringify(res.rows)));

    // Is it possible the API is filtering by tenantId but the rows have null tenantId? 
    // No, the withTenantTx uses search_path, it doesn't filter by tenantId in multi-schema.

    // Check the full Product schema again to see if ANY required field for Prisma object mapping is null or wrong type.
    res = await client.query('SELECT * FROM "Product" MAX LIMIT 1');
    console.log("Single product raw:", res.rows[0]);

    // Are there any records in Product table that somehow have `deletedAt` set? (assuming logical deletion)
    try {
        let dr = await client.query('SELECT COUNT(*) FROM "Product" WHERE "deletedAt" IS NOT NULL');
        console.log("Deleted products:", dr.rows[0].count);
    } catch (e) {
        console.log("No deletedAt column");
    }

    await client.end();
}
main().catch(console.error);
