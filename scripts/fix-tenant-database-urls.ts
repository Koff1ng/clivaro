import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'

// Load environment variables
loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

/**
 * Script para actualizar las URLs de las bases de datos de los tenants
 * de SQLite (file:...) a PostgreSQL con schemas separados
 */
async function fixTenantDatabaseUrls() {
    console.log('🔍 Buscando tenants con bases de datos SQLite...\n')

    try {
        // Obtener todos los tenants activos
        const tenants = await prisma.tenant.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                slug: true,
                databaseUrl: true,
            },
            orderBy: { createdAt: 'asc' }
        })

        console.log(`📊 Total de tenants activos: ${tenants.length}\n`)

        // Verificar que DATABASE_URL esté configurada
        const baseDatabaseUrl = process.env.DATABASE_URL
        if (!baseDatabaseUrl) {
            throw new Error('❌ DATABASE_URL no está configurada en las variables de entorno')
        }

        const isPostgresEnv = baseDatabaseUrl.startsWith('postgresql://') || baseDatabaseUrl.startsWith('postgres://')

        if (!isPostgresEnv) {
            console.log('⚠️  El entorno actual usa SQLite. Este script solo es necesario cuando DATABASE_URL es PostgreSQL.')
            return
        }

        console.log(`✅ Entorno PostgreSQL detectado\n`)
        console.log(`🔗 Base URL: ${baseDatabaseUrl}\n`)

        // Función para convertir slug a nombre de schema
        const toSchemaName = (slug: string): string => {
            return `tenant_${slug.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
        }

        // Función para agregar parámetro de schema a la URL
        const withSchemaParam = (baseUrl: string, schema: string): string => {
            try {
                const url = new URL(baseUrl)
                url.searchParams.set('schema', schema)
                return url.toString()
            } catch {
                const separator = baseUrl.includes('?') ? '&' : '?'
                return `${baseUrl}${separator}schema=${encodeURIComponent(schema)}`
            }
        }

        // Filtrar tenants con SQLite
        const sqliteTenants = tenants.filter(t =>
            t.databaseUrl.startsWith('file:') || t.databaseUrl.includes('.db')
        )

        console.log(`📋 Tenants con SQLite encontrados: ${sqliteTenants.length}\n`)

        if (sqliteTenants.length === 0) {
            console.log('✅ No hay tenants con SQLite que necesiten actualización.')
            return
        }

        // Mostrar resumen
        console.log('─'.repeat(80))
        console.log('Resumen de cambios:')
        console.log('─'.repeat(80))

        for (const tenant of sqliteTenants) {
            const schemaName = toSchemaName(tenant.slug)
            const newUrl = withSchemaParam(baseDatabaseUrl, schemaName)

            console.log(`\n📦 Tenant: ${tenant.name} (${tenant.slug})`)
            console.log(`   ID: ${tenant.id}`)
            console.log(`   URL actual: ${tenant.databaseUrl}`)
            console.log(`   Nueva URL:  ${newUrl}`)
        }

        console.log('\n' + '─'.repeat(80))
        console.log(`\n⚠️  Se actualizarán ${sqliteTenants.length} tenants\n`)

        // Actualizar las URLs
        let updatedCount = 0
        let errorCount = 0

        for (const tenant of sqliteTenants) {
            try {
                const schemaName = toSchemaName(tenant.slug)
                const newUrl = withSchemaParam(baseDatabaseUrl, schemaName)

                await prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { databaseUrl: newUrl }
                })

                console.log(`✅ ${tenant.slug} - Actualizado correctamente`)
                updatedCount++
            } catch (error: any) {
                console.error(`❌ ${tenant.slug} - Error: ${error.message}`)
                errorCount++
            }
        }

        console.log('\n' + '='.repeat(80))
        console.log('Resumen de la migración:')
        console.log('='.repeat(80))
        console.log(`✅ Actualizados exitosamente: ${updatedCount}`)
        console.log(`❌ Errores: ${errorCount}`)
        console.log(`📊 Total procesados: ${sqliteTenants.length}`)
        console.log('='.repeat(80))

        if (updatedCount > 0) {
            console.log('\n🎉 ¡URLs de tenants actualizadas con éxito!')
            console.log('\n📝 Próximos pasos:')
            console.log('   1. Verifica que los schemas existan en PostgreSQL/Supabase')
            console.log('   2. Asegúrate de que las tablas estén creadas en cada schema')
            console.log('   3. Prueba el POS con un usuario de tenant para verificar el stock')
        }

    } catch (error: any) {
        console.error('\n❌ Error durante la migración:', error.message)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Ejecutar el script
fixTenantDatabaseUrls()
    .then(() => {
        console.log('\n✅ Script completado')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Script falló:', error)
        process.exit(1)
    })
