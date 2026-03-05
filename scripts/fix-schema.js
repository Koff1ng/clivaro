const { Client } = require('pg');

const CAFE_SCHEMA = 'tenant_cml5qyzi90004qihnrbt57g6l';
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    await client.query(`SET search_path TO "${CAFE_SCHEMA}"`);

    // We saw earlier that preferredZoneId is missing in Product. 
    // Let's add it, and also check if we missed any other ones like 'preparationTime' or similar.
    try {
        console.log("Adding preferredZoneId to Product...");
        await client.query(`ALTER TABLE "Product" ADD COLUMN "preferredZoneId" TEXT`);
        console.log("✅ Added preferredZoneId");
    } catch (e) {
        console.log("preferredZoneId error:", e.message);
    }

    // Does InvoiceItem miss anything since earlier we removed updatedAt? Yes, prisma will need it!
    try {
        console.log("Adding updatedAt to InvoiceItem...");
        await client.query(`ALTER TABLE "InvoiceItem" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()`);
        console.log("✅ Added updatedAt");
    } catch (e) { console.log(e.message); }

    // Earlier we removed balance from Invoice, Prisma might need it
    try {
        console.log("Adding balance to Invoice...");
        await client.query(`ALTER TABLE "Invoice" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0`);
        console.log("✅ Added balance");
    } catch (e) { console.log(e.message); }

    // StockLevel createdAt
    try {
        console.log("Adding createdAt to StockLevel...");
        await client.query(`ALTER TABLE "StockLevel" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()`);
        console.log("✅ Added StockLevel createdAt");
    } catch (e) { }

    // StockMovement updatedAt
    try {
        console.log("Adding updatedAt to StockMovement...");
        await client.query(`ALTER TABLE "StockMovement" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()`);
        console.log("✅ Added StockMovement updatedAt");
    } catch (e) { }

    await client.end();
}
main().catch(console.error);
