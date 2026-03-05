const { Client } = require('pg');

const CAFE_SCHEMA = 'tenant_cml5qyzi90004qihnrbt57g6l';
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    await client.query(`SET search_path TO "${CAFE_SCHEMA}"`);

    // What columns does the GET endpoint filter by default?
    // It filters by active=true. Are our products active? Yes, checked that.
    // Next, the query returns variants and recipes. Are there any constraint issues?

    // Let's manually run the exact query that Prisma runs to see if it fails at the DB level,
    // or if there is a missing field that causes Prisma to drop the rows in JS land.
    try {
        const res = await client.query('SELECT * FROM "Product" MAX LIMIT 1');
        console.log("Columns present in Product:", Object.keys(res.rows[0]));
    } catch (e) {
        console.log(e.message);
    }

    // Check if any product has a null required field according to schema.prisma
    const res2 = await client.query(`
    SELECT id, name, sku, price, cost, "taxRate", "unitOfMeasure", active, "createdById"
    FROM "Product"
    WHERE sku IS NULL OR name IS NULL OR price IS NULL OR cost IS NULL OR "taxRate" IS NULL OR "unitOfMeasure" IS NULL OR active IS NULL OR "createdById" IS NULL
  `);

    console.log(`Products with null required fields: ${res2.rows.length}`);
    if (res2.rows.length > 0) {
        console.log(JSON.stringify(res2.rows));
    }

    await client.end();
}
main().catch(console.error);
