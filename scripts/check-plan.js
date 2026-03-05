const { Client } = require('pg');
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    const res = await client.query(`
        SELECT t.name, t."planId", p.name as plan_name, t."trialEndsAt", t."status", t."subscriptionStatus"
        FROM public."Tenant" t 
        LEFT JOIN public."Plan" p ON t."planId" = p.id 
        WHERE t.slug = 'cafe-singular'
    `);
    console.table(res.rows);

    await client.end();
}
main().catch(console.error);
