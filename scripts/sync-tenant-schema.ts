import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Tenant Schema Synchronization Tool
 * 
 * This script automates:
 * 1. Generating a fresh supabase-init.sql from prisma/schema.prisma
 * 2. Regenerating lib/tenant-sql-statements.ts for new tenant creation
 * 
 * Usage: tsx scripts/sync-tenant-schema.ts
 */
async function syncTenantSchema() {
    console.log('🔄 Starting Tenant Schema Synchronization...')

    try {
        const projectRoot = process.cwd()
        const sqlPath = path.join(projectRoot, 'prisma', 'supabase-init.sql')
        const generatorPath = path.join(projectRoot, 'scripts', 'generate-tenant-sql.js')

        // 1. Generate fresh SQL diff from empty to current schema
        console.log('📝 Generating fresh prisma/supabase-init.sql...')
        const migrateDiffCmd = 'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script'
        const sqlOutput = execSync(migrateDiffCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })

        // Ensure UTF-8 and write to file
        fs.writeFileSync(sqlPath, sqlOutput, 'utf8')
        console.log(`✅ Updated ${sqlPath}`)

        // 2. Regenerate TypeScript statements
        console.log('🔨 Regenerating lib/tenant-sql-statements.ts...')
        if (!fs.existsSync(generatorPath)) {
            throw new Error(`Generator script not found at ${generatorPath}`)
        }

        const genResult = execSync(`node ${generatorPath}`, { encoding: 'utf8' })
        console.log(genResult.trim())
        console.log('✅ Updated lib/tenant-sql-statements.ts')

        console.log('\n✨ Tenant initialization scripts are now in sync with prisma/schema.prisma.')
        console.log('\n👉 NOTE: To update EXISTING tenants, please run:')
        console.log('   npm run db:migrate-tenants (or tsx scripts/migrate-tenants.ts)')

    } catch (error: any) {
        console.error('\n❌ Error during synchronization:')
        console.error(error.message)
        process.exit(1)
    }
}

syncTenantSchema()
