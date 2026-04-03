const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

async function main() {
  // Get CREATE TABLE statements
  const tables = await p['$queryRawUnsafe'](`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'tenant_prueba' AND table_type = 'BASE TABLE' 
    ORDER BY table_name
  `);
  
  let sql = '-- AUTO-GENERATED from tenant_prueba schema\n-- Generated: ' + new Date().toISOString() + '\n\n';
  
  for (const t of tables) {
    const tn = t.table_name;
    // Get columns
    const cols = await p['$queryRawUnsafe'](`
      SELECT column_name, data_type, udt_name, is_nullable, column_default,
             character_maximum_length, numeric_precision
      FROM information_schema.columns 
      WHERE table_schema = 'tenant_prueba' AND table_name = '${tn}'
      ORDER BY ordinal_position
    `);
    
    // Get primary key
    const pk = await p['$queryRawUnsafe'](`
      SELECT kcu.column_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'tenant_prueba' AND tc.table_name = '${tn}' AND tc.constraint_type = 'PRIMARY KEY'
    `);
    
    let createSql = 'CREATE TABLE "' + tn + '" (\n';
    const colDefs = [];
    
    for (const col of cols) {
      let dtype = '';
      const udt = col.udt_name;
      
      if (udt === 'text') dtype = 'TEXT';
      else if (udt === 'bool') dtype = 'BOOLEAN';
      else if (udt === 'int4') dtype = 'INTEGER';
      else if (udt === 'int2') dtype = 'SMALLINT';
      else if (udt === 'float8') dtype = 'DOUBLE PRECISION';
      else if (udt === 'timestamp') dtype = 'TIMESTAMP(3)';
      else if (udt === 'timestamptz') dtype = 'TIMESTAMP(3)';
      else if (udt === 'jsonb') dtype = 'JSONB';
      else if (udt === 'json') dtype = 'JSON';
      else if (udt === '_text') dtype = 'TEXT[]';
      else dtype = col.data_type.toUpperCase();
      
      let def = '    "' + col.column_name + '" ' + dtype;
      if (col.is_nullable === 'NO') def += ' NOT NULL';
      if (col.column_default) {
        let d = col.column_default;
        // Clean up defaults
        d = d.replace(/::text$/, '').replace(/::character varying$/, '');
        def += ' DEFAULT ' + d;
      }
      colDefs.push(def);
    }
    
    // Add PK constraint
    if (pk.length > 0) {
      const pkCols = pk.map(p => '"' + p.column_name + '"').join(', ');
      colDefs.push('\n    CONSTRAINT "' + pk[0].constraint_name + '" PRIMARY KEY (' + pkCols + ')');
    }
    
    createSql += colDefs.join(',\n') + '\n);\n';
    sql += createSql + '\n';
  }
  
  // Get indexes
  const indexes = await p['$queryRawUnsafe'](`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'tenant_prueba' AND indexname NOT LIKE '%_pkey'
    ORDER BY indexname
  `);
  
  sql += '\n-- Indexes\n';
  for (const idx of indexes) {
    // Replace schema-qualified references
    let def = idx.indexdef.replace(/tenant_prueba\./g, '');
    sql += def + ';\n';
  }
  
  // Get foreign keys
  const fks = await p['$queryRawUnsafe'](`
    SELECT 
      tc.constraint_name, tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule, rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'tenant_prueba' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, tc.constraint_name
  `);
  
  sql += '\n-- Foreign Keys\n';
  for (const fk of fks) {
    sql += 'ALTER TABLE "' + fk.table_name + '" ADD CONSTRAINT "' + fk.constraint_name + '" FOREIGN KEY ("' + fk.column_name + '") REFERENCES "' + fk.foreign_table_name + '"("' + fk.foreign_column_name + '") ON DELETE ' + fk.delete_rule + ' ON UPDATE ' + fk.update_rule + ';\n';
  }
  
  const outPath = path.join(__dirname, '..', 'prisma', 'supabase-init.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  
  process.stdout.write('Written ' + tables.length + ' tables to supabase-init.sql\n');
  await p['$disconnect']();
}

main().catch(e => { process.stderr.write('ERR:' + e.message + '\n'); process.exit(1); });
