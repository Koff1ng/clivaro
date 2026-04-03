const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, 'run.log');
fs.writeFileSync(LOG, '');
const log = m => fs.appendFileSync(LOG, m + '\n');

const MISSING = ['MetaAdsCampaign','MetaAdsConfig','OpportunityActivity','PipelineStage','PurchaseOrderAttachment','RestaurantConfig','RestaurantTable','RestaurantZone','TableOrder','TableOrderLine','TableSession','TenantEmailConfig','WaiterProfile'];

async function main() {
  const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  
  // Single query - all columns for all missing tables
  const allCols = await p.$queryRawUnsafe(`
    SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'tenant_prueba' AND table_name = ANY($1)
    ORDER BY table_name, ordinal_position
  `, MISSING);
  log('cols:' + allCols.length);
  
  // Single query - all PKs
  const allPKs = await p.$queryRawUnsafe(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'tenant_prueba' AND tc.table_name = ANY($1) AND tc.constraint_type = 'PRIMARY KEY'
  `, MISSING);
  log('pks:' + allPKs.length);
  
  // Single query - all indexes
  const allIdx = await p.$queryRawUnsafe(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'tenant_prueba' AND tablename = ANY($1) AND indexname NOT LIKE '%_pkey'
  `, MISSING);
  log('idx:' + allIdx.length);
  
  // Single query - all FKs
  const allFKs = await p.$queryRawUnsafe(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name,
           ccu.table_name AS ftable, ccu.column_name AS fcol,
           rc.delete_rule, rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'tenant_prueba' AND tc.table_name = ANY($1) AND tc.constraint_type = 'FOREIGN KEY'
  `, MISSING);
  log('fks:' + allFKs.length);
  
  // Build SQL statements
  const stmts = [];
  
  for (const tn of MISSING) {
    const cols = allCols.filter(c => c.table_name === tn);
    if (cols.length === 0) { log('SKIP:' + tn); continue; }
    
    const pks = allPKs.filter(p => p.table_name === tn);
    let defs = [];
    
    for (const col of cols) {
      const u = col.udt_name;
      let dt = u === 'text' ? 'TEXT' : u === 'bool' ? 'BOOLEAN' : u === 'int4' ? 'INTEGER' :
               u === 'float8' ? 'DOUBLE PRECISION' : u === 'timestamp' || u === 'timestamptz' ? 'TIMESTAMP(3)' :
               u === 'jsonb' ? 'JSONB' : u === '_text' ? "TEXT[] DEFAULT ARRAY[]::TEXT[]" : 'TEXT';
      
      let d = '    "' + col.column_name + '" ' + dt;
      if (col.is_nullable === 'NO') d += ' NOT NULL';
      if (col.column_default) d += ' DEFAULT ' + col.column_default.replace(/::text$/,'').replace(/::character varying$/,'');
      defs.push(d);
    }
    
    if (pks.length > 0) {
      defs.push('\n    CONSTRAINT "' + pks[0].constraint_name + '" PRIMARY KEY (' + pks.map(p=>'"'+p.column_name+'"').join(', ') + ')');
    }
    
    stmts.push('CREATE TABLE "' + tn + '" (\\n' + defs.join(',\\n') + '\\n)');
  }
  
  // Indexes
  for (const idx of allIdx) {
    stmts.push(idx.indexdef.replace(/tenant_prueba\./g, ''));
  }
  
  // FKs
  for (const fk of allFKs) {
    stmts.push('ALTER TABLE "'+fk.table_name+'" ADD CONSTRAINT "'+fk.constraint_name+'" FOREIGN KEY ("'+fk.column_name+'") REFERENCES "'+fk.ftable+'"("'+fk.fcol+'") ON DELETE '+fk.delete_rule+' ON UPDATE '+fk.update_rule);
  }
  
  fs.writeFileSync(path.join(__dirname, 'missing-stmts.json'), JSON.stringify(stmts, null, 2));
  log('DONE:' + stmts.length + ' statements');
  
  await p.$disconnect();
}

main().catch(e => { log('ERR:' + e.message); process.exit(1); });
