/**
 * Reads supabase-init.sql and generates lib/tenant-sql-statements.ts
 * with all SQL statements embedded as a TypeScript array.
 * Run this whenever the Prisma schema changes.
 */
const fs = require('fs')
const path = require('path')

const sqlPath = path.join(__dirname, '..', 'prisma', 'supabase-init.sql')
const outputPath = path.join(__dirname, '..', 'lib', 'tenant-sql-statements.ts')

const sql = fs.readFileSync(sqlPath, 'utf8')

// Split by semicolons, keep multi-line statements intact
const statements = sql
    .split(';')
    .map(s => s.replace(/\r\n/g, '\n').trim())
    .filter(s => {
        if (!s || s.length === 0) return false
        // Remove pure comment lines
        const nonCommentLines = s.split('\n').filter(l => !l.trim().startsWith('--'))
        return nonCommentLines.some(l => l.trim().length > 0)
    })
    .map(s => {
        // Strip leading comment lines but keep inline comments
        const lines = s.split('\n')
        const firstNonComment = lines.findIndex(l => !l.trim().startsWith('--'))
        return (firstNonComment > 0 ? lines.slice(firstNonComment) : lines).join('\n').trim()
    })
    .filter(s => s.length > 0)

console.log(`Found ${statements.length} SQL statements`)
console.log('First statement preview:', statements[0].substring(0, 80))
console.log('Last statement preview:', statements[statements.length - 1].substring(0, 80))

const output = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Run: node scripts/generate-tenant-sql.js to regenerate

export const TENANT_SQL_STATEMENTS: string[] = ${JSON.stringify(statements, null, 2)}
`

fs.writeFileSync(outputPath, output, 'utf8')
console.log(`Written to ${outputPath}`)
