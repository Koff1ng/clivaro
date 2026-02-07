import { PrismaClient } from '@prisma/client'
import { initializeTenantDatabase } from './lib/initialize-tenant'

const prisma = new PrismaClient()

async function auditTenantFlow() {
    const auditSlug = `audit-${Date.now()}`
    const auditName = `Audit Tenant ${new Date().toLocaleDateString()}`

    console.log(`[AUDIT] Iniciando prueba de flujo completo para: ${auditName}`)

    try {
        // 1. Crear registro de tenant
        const tenant = await prisma.tenant.create({
            data: {
                name: auditName,
                slug: auditSlug,
                databaseUrl: process.env.DATABASE_URL + `?schema=tenant_${auditSlug}` // Temporal
            }
        })
        console.log(`[AUDIT] ✓ Registro creado con ID: ${tenant.id}`)

        // 2. Inicializar base de datos
        console.log(`[AUDIT] Inicializando base de datos...`)
        const result = await initializeTenantDatabase(
            process.env.DATABASE_URL!,
            auditName,
            auditSlug,
            tenant.id
        )
        console.log(`[AUDIT] ✓ Base de datos inicializada. Admin: ${result.adminUsername}`)

        // 3. Verificar si existen datos
        const schemaName = `tenant_${tenant.id}`
        const tenantPrisma = new PrismaClient({
            datasources: { db: { url: process.env.DATABASE_URL + `?schema=${schemaName}` } }
        })

        const userCount = await tenantPrisma.user.count()
        const roleCount = await tenantPrisma.role.count()
        console.log(`[AUDIT] ✓ Verificación de datos: ${userCount} usuarios, ${roleCount} roles encontrados en el esquema ${schemaName}`)

        await tenantPrisma.$disconnect()

        // 4. Limpieza (Simular borrado)
        console.log(`[AUDIT] Limpiando tenant de prueba...`)
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
        await prisma.tenant.delete({ where: { id: tenant.id } })
        console.log(`[AUDIT] ✓ Limpieza completada exitosamente.`)

    } catch (error) {
        console.error(`[AUDIT] ❌ ERROR EN EL FLUJO:`, error)
    } finally {
        await prisma.$disconnect()
    }
}

auditTenantFlow()
