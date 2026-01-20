/**
 * Script para aplicar la migración updatedAt a Payment en todas las bases de datos de tenants
 * 
 * Uso:
 *   npx tsx scripts/migrate-all-tenants-updatedat.ts
 * 
 * O con ts-node:
 *   npx ts-node scripts/migrate-all-tenants-updatedat.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaClient as TenantPrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import * as path from 'path'

// Usar el schema postgres para la conexión master
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

const MIGRATION_SQL = `
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Payment'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'updatedAt'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            
            UPDATE "Payment" 
            SET "updatedAt" = "createdAt" 
            WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";
            
            RAISE NOTICE '✅ Columna updatedAt agregada exitosamente';
        ELSE
            RAISE NOTICE 'ℹ️ Columna updatedAt ya existe';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en esta base de datos';
    END IF;
END $$;
`

async function migrateTenantDatabase(databaseUrl: string, tenantName: string, tenantSlug: string) {
  console.log(`\n🔄 Procesando tenant: ${tenantName} (${tenantSlug})`)
  console.log(`   URL: ${databaseUrl.substring(0, 50)}...`)

  try {
    // Crear cliente Prisma para este tenant
    const tenantPrisma = new TenantPrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['error'],
    })

    // Ejecutar la migración usando $executeRawUnsafe
    await tenantPrisma.$executeRawUnsafe(MIGRATION_SQL)

    // Verificar que la columna existe
    const result = await tenantPrisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'Payment' 
      AND column_name = 'updatedAt'
    `)

    if (result && result.length > 0) {
      console.log(`   ✅ Migración exitosa para ${tenantName}`)
    } else {
      console.log(`   ⚠️  Advertencia: No se pudo verificar la columna en ${tenantName}`)
    }

    // Cerrar la conexión
    await tenantPrisma.$disconnect()
  } catch (error: any) {
    console.error(`   ❌ Error en ${tenantName}:`, error.message)
    if (error.code) {
      console.error(`      Código: ${error.code}`)
    }
  }
}

async function main() {
  console.log('🚀 Iniciando migración de updatedAt para todos los tenants...\n')

  // Verificar conexión a la base de datos
  try {
    await prisma.$connect()
    console.log('✅ Conectado a la base de datos master\n')
  } catch (error: any) {
    console.error('❌ Error al conectar a la base de datos master:')
    console.error(`   ${error.message}\n`)
    console.error('💡 Soluciones posibles:')
    console.error('   1. Verifica que DATABASE_URL esté configurado en .env')
    console.error('   2. Verifica que la base de datos esté accesible desde tu red')
    console.error('   3. Si estás en producción, ejecuta este script desde el servidor')
    console.error('   4. O ejecuta la migración manualmente en cada base de datos de tenant\n')
    process.exit(1)
  }

  try {
    // Obtener todos los tenants activos
    const tenants = await prisma.tenant.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        databaseUrl: true,
      },
    })

    if (tenants.length === 0) {
      console.log('⚠️  No se encontraron tenants activos')
      return
    }

    console.log(`📊 Encontrados ${tenants.length} tenant(s) activo(s)\n`)

    // Filtrar solo tenants con PostgreSQL (no SQLite)
    const postgresTenants = tenants.filter(
      (t) =>
        t.databaseUrl &&
        (t.databaseUrl.startsWith('postgresql://') || t.databaseUrl.startsWith('postgres://'))
    )

    if (postgresTenants.length === 0) {
      console.log('⚠️  No se encontraron tenants con base de datos PostgreSQL')
      console.log('   (Solo se migran bases de datos PostgreSQL)')
      return
    }

    console.log(`📊 ${postgresTenants.length} tenant(s) con PostgreSQL encontrado(s)\n`)

    // Migrar cada tenant
    let successCount = 0
    let errorCount = 0

    for (const tenant of postgresTenants) {
      try {
        await migrateTenantDatabase(tenant.databaseUrl!, tenant.name, tenant.slug)
        successCount++
      } catch (error) {
        errorCount++
        console.error(`   ❌ Error procesando ${tenant.name}:`, error)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Resumen de migración:')
    console.log(`   ✅ Exitosos: ${successCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    console.log(`   📦 Total: ${postgresTenants.length}`)
    console.log('='.repeat(60))
  } catch (error: any) {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar el script
main()
  .then(() => {
    console.log('\n✅ Proceso completado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })

