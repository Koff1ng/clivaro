const fs = require('fs');
const path = require('path');

// Read extracted statements
const stmts = JSON.parse(fs.readFileSync(path.join(__dirname, 'missing-stmts.json'), 'utf8'));

// Fix double-escaped newlines in CREATE TABLE statements
const fixed = stmts.map(s => s.replace(/\\n/g, '\n'));

// Append to supabase-init.sql
const sqlPath = path.join(__dirname, '..', 'prisma', 'supabase-init.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');

sql += '\n\n-- ========================================\n';
sql += '-- ADDED TABLES (auto-synced from tenant_prueba)\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n';
sql += '-- ========================================\n\n';

for (const stmt of fixed) {
  sql += stmt + ';\n\n';
}

fs.writeFileSync(sqlPath, sql, 'utf8');
console.log('Appended ' + stmts.length + ' statements to supabase-init.sql');

// Now regenerate tenant-sql-statements.ts
const outputPath = path.join(__dirname, '..', 'lib', 'tenant-sql-statements.ts');

const allStatements = sql
  .split(';')
  .map(s => s.replace(/\r\n/g, '\n').trim())
  .filter(s => {
    if (!s || s.length === 0) return false;
    const nonCommentLines = s.split('\n').filter(l => !l.trim().startsWith('--'));
    return nonCommentLines.some(l => l.trim().length > 0);
  })
  .map(s => {
    const lines = s.split('\n');
    const firstNonComment = lines.findIndex(l => !l.trim().startsWith('--'));
    return (firstNonComment > 0 ? lines.slice(firstNonComment) : lines).join('\n').trim();
  })
  .filter(s => s.length > 0);

console.log('Total SQL statements: ' + allStatements.length);

const output = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY\n// Run: node scripts/generate-tenant-sql.js to regenerate\n\nexport const TENANT_SQL_STATEMENTS: string[] = ${JSON.stringify(allStatements, null, 2)}\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log('Written tenant-sql-statements.ts');
