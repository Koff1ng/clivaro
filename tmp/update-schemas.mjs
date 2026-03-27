import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Use DIRECT_URL for DDL operations to avoid PgBouncer issues if possible
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL not found in .env');
  process.exit(1);
}

async function run() {
  console.log('Starting global schema update...');
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    // Get all tenant schemas + public
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'");
    const schemas = res.rows.map(r => r.schema_name);
    
    console.log(`Found ${schemas.length} schemas to update.`);
    
    for (const schema of schemas) {
      process.stdout.write(`Updating schema: ${schema}... `);
      try {
        // We use explicit schema qualification to be super safe
        
        // Update Product table
        await client.query(`
          ALTER TABLE "${schema}"."Product" 
          ADD COLUMN IF NOT EXISTS "isCompound" BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS "baseUnitSymbol" TEXT NOT NULL DEFAULT 'UND'
        `);
        
        // Update Unit table
        await client.query(`
          ALTER TABLE "${schema}"."Unit" 
          ADD COLUMN IF NOT EXISTS "isCompound" BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS "baseUnitSymbol" TEXT NOT NULL DEFAULT 'UND'
        `);
        
        console.log(`✓ DONE`);
      } catch (e) {
        console.log(`✗ ERROR: ${e.message}`);
      }
    }
    console.log('Global update completed.');
  } catch (err) {
    console.error('Fatal error during migration:', err.message);
  } finally {
    await client.end();
  }
}

run();
