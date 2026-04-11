const { Client } = require('pg')

const DB_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres'

// Tables every tenant schema MUST have (core Prisma models)
const REQUIRED_TABLES = [
  'User', 'Role', 'Permission', 'RolePermission', 'UserRole',
  'Customer', 'Product', 'ProductVariant', 'Category',
  'Invoice', 'InvoiceItem', 'Payment', 'PaymentMethod',
  'Warehouse', 'StockLevel', 'InventoryMovement',
  'CashShift', 'CashMovement', 'ShiftSummary',
  'TaxRate', 'InvoiceLineTax', 'InvoiceTaxSummary',
  'SaleUnit', 'Recipe', 'RecipeIngredient',
  'Lead', 'Pipeline', 'PipelineStage',
  'Quotation', 'QuotationItem',
  'PurchaseOrder', 'PurchaseOrderItem', 'Supplier',
  'Receipt', 'ReceiptItem',
  'SalesOrder', 'SalesOrderItem',
  'CreditNote', 'CreditNoteItem',
  'JournalEntry', 'JournalLine', 'AccountingAccount', 'AccountingPeriod',
  'Activity',
]

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  // 1. List all tenants
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TENANT HEALTH CHECK')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  const tenants = await client.query(`
    SELECT t.id, t.name, t.slug, t.active, 
           ts."companyName",
           s."planId", s.status as "subStatus"
    FROM public."Tenant" t 
    LEFT JOIN public."TenantSettings" ts ON ts."tenantId" = t.id 
    LEFT JOIN public."Subscription" s ON s."tenantId" = t.id
    ORDER BY t.name
  `)
  
  console.log(`📋 Tenants encontrados: ${tenants.rowCount}\n`)
  
  for (const t of tenants.rows) {
    console.log(`  ${t.active ? '🟢' : '🔴'} ${t.name} (${t.slug}) — Plan: ${t.planId || 'N/A'} — Sub: ${t.subStatus || 'none'} — Active: ${t.active}`)
  }

  // 2. Check schemas exist
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SCHEMA HEALTH')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const schemas = await client.query(`
    SELECT schema_name FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `)
  
  const schemaSet = new Set(schemas.rows.map(r => r.schema_name))
  console.log(`📂 Schemas tenant_* encontrados: ${schemaSet.size}`)
  schemaSet.forEach(s => console.log(`  └─ ${s}`))

  // 3. Check each active tenant's schema
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TABLE AUDIT PER TENANT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  for (const t of tenants.rows) {
    const schema = `tenant_${t.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    const exists = schemaSet.has(schema)
    
    console.log(`\n── ${t.name} (${schema}) ──`)
    
    if (!exists) {
      console.log(`  ❌ SCHEMA NOT FOUND`)
      continue
    }
    
    // Get all tables in this schema
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema])
    
    const tableSet = new Set(tables.rows.map(r => r.table_name))
    const missing = REQUIRED_TABLES.filter(t => !tableSet.has(t))
    const extra = [...tableSet].filter(t => !REQUIRED_TABLES.includes(t))
    
    console.log(`  📊 Tables: ${tableSet.size} found | ${missing.length} missing | ${extra.length} extra`)
    
    if (missing.length > 0) {
      console.log(`  ⚠️  Missing: ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      console.log(`  ℹ️  Extra: ${extra.join(', ')}`)
    }
    
    // 4. Data counts for key tables
    const counts = {}
    for (const tbl of ['User', 'Product', 'Customer', 'Invoice', 'PaymentMethod', 'Warehouse', 'TaxRate', 'Role']) {
      if (!tableSet.has(tbl)) continue
      try {
        const r = await client.query(`SELECT count(*)::int as cnt FROM "${schema}"."${tbl}"`)
        counts[tbl] = r.rows[0].cnt
      } catch (e) {
        counts[tbl] = `ERR: ${e.message.slice(0, 40)}`
      }
    }
    
    console.log(`  📈 Data: ${Object.entries(counts).map(([k,v]) => `${k}=${v}`).join(' | ')}`)
    
    // 5. Check for orphan/integrity issues
    if (tableSet.has('User')) {
      const noRole = await client.query(`
        SELECT count(*)::int as cnt FROM "${schema}"."User" u 
        WHERE NOT EXISTS (SELECT 1 FROM "${schema}"."UserRole" ur WHERE ur."userId" = u.id)
      `)
      if (noRole.rows[0].cnt > 0) {
        console.log(`  ⚠️  ${noRole.rows[0].cnt} user(s) without any role`)
      }
    }
    
    if (tableSet.has('PaymentMethod')) {
      const methods = await client.query(`SELECT name, type, active FROM "${schema}"."PaymentMethod" ORDER BY name`)
      console.log(`  💳 Payment Methods: ${methods.rows.map(m => `${m.name}(${m.type}${m.active === false ? ',OFF' : ''})`).join(', ')}`)
    }
    
    if (tableSet.has('Warehouse')) {
      try {
        const wh = await client.query(`SELECT name FROM "${schema}"."Warehouse" ORDER BY name`)
        console.log(`  🏭 Warehouses: ${wh.rows.map(w => w.name).join(', ')}`)
      } catch { console.log('  🏭 Warehouses: error reading') }
    }
  }
  
  // 6. Check for orphan schemas (schemas without a tenant record)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  ORPHAN CHECK')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  const tenantSlugs = new Set(tenants.rows.map(t => `tenant_${t.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`))
  const orphanSchemas = [...schemaSet].filter(s => !tenantSlugs.has(s))
  
  if (orphanSchemas.length > 0) {
    console.log(`  ⚠️  Orphan schemas (no tenant record): ${orphanSchemas.join(', ')}`)
  } else {
    console.log('  ✅ No orphan schemas found')
  }
  
  // Tenants without schemas
  const noSchema = tenants.rows.filter(t => {
    const schema = `tenant_${t.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    return !schemaSet.has(schema)
  })
  if (noSchema.length > 0) {
    console.log(`  ⚠️  Tenants without schema: ${noSchema.map(t => `${t.name}(${t.slug})`).join(', ')}`)
  } else {
    console.log('  ✅ All tenants have schemas')
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  DONE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  await client.end()
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
