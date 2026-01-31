import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'

// Load environment variables
loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

/**
 * Script para diagnosticar la configuración de bases de datos de los tenants
 */
async function diagnoseTenants() {
    console.log('🔍 Diagnosticando configuración de tenants...\n')

    try {
        // Obtener todos los tenants
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                databaseUrl: true,
                active: true,
            },
            orderBy: { createdAt: 'asc' }
        })

        console.log(`📊 Total de tenants: ${tenants.length}`)
        console.log(`✅ Activos: ${tenants.filter(t => t.active).length}`)
        console.log(`❌ Inactivos: ${tenants.filter(t => !t.active).length}\n`)

        const baseDatabaseUrl = process.env.DATABASE_URL || 'NO_CONFIGURADO'
        console.log(`🔗 DATABASE_URL: ${baseDatabaseUrl}\n`)

        console.log('─'.repeat(100))
        console.log('DETALLES DE TENANTS:')
        console.log('─'.repeat(100))

        for (const tenant of tenants) {
            console.log(`\n📦 ${tenant.name} (${tenant.slug})`)
            console.log(`   ID: ${tenant.id}`)
            console.log(`   Estado: ${tenant.active ? '✅ Activo' : '❌ Inactivo'}`)
            console.log(`   Database URL: ${tenant.databaseUrl}`)

            // Analizar el tipo de URL
            if (tenant.databaseUrl.startsWith('file:')) {
                console.log(`   ⚠️  TIPO: SQLite`)
            } else if (tenant.databaseUrl.startsWith('postgresql://') || tenant.databaseUrl.startsWith('postgres://')) {
                console.log(`   ✅ TIPO: PostgreSQL`)

                // Extraer el schema de la URL
                try {
                    const url = new URL(tenant.databaseUrl)
                    const schema = url.searchParams.get('schema')
                    if (schema) {
                        console.log(`   📂 Schema: ${schema}`)
                    } else {
                        console.log(`   ⚠️  Schema: NO ESPECIFICADO (usará 'public')`)
                    }
                } catch (e) {
                    console.log(`   ❌ Error parseando URL`)
                }
            } else {
                console.log(`   ❓ TIPO: Desconocido`)
            }
        }

        console.log('\n' + '='.repeat(100))
        console.log('ANÁLISIS:')
        console.log('='.repeat(100))

        const sqliteCount = tenants.filter(t => t.databaseUrl.startsWith('file:')).length
        const postgresCount = tenants.filter(t =>
            t.databaseUrl.startsWith('postgresql://') || t.databaseUrl.startsWith('postgres://')
        ).length

        console.log(`SQLite: ${sqliteCount}`)
        console.log(`PostgreSQL: ${postgresCount}`)
        console.log(`Otros: ${tenants.length - sqliteCount - postgresCount}`)

        // Verificar si hay incompatibilidad
        const isPostgresEnv = baseDatabaseUrl.startsWith('postgresql://') || baseDatabaseUrl.startsWith('postgres://')

        if (isPostgresEnv && sqliteCount > 0) {
            console.log(`\n⚠️  PROBLEMA DETECTADO: ${sqliteCount} tenant(s) con SQLite en entorno PostgreSQL`)
            console.log('   Esto causará fallback a la base de datos maestra.')
        } else if (isPostgresEnv && postgresCount === tenants.length) {
            console.log(`\n✅ Todos los tenants usan PostgreSQL correctamente`)
        }

    } catch (error: any) {
        console.error('\n❌ Error durante el diagnóstico:', error.message)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Ejecutar el diagnóstico
diagnoseTenants()
    .then(() => {
        console.log('\n✅ Diagnóstico completado')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Diagnóstico falló:', error)
        process.exit(1)
    })
