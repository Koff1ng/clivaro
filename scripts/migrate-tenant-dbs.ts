import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

async function migrateTenantDatabases() {
  console.log('🔍 Buscando tenants activos...')
  
  // Obtener todos los tenants activos
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
  })

  console.log(`📦 Encontrados ${tenants.length} tenants activos`)

  for (const tenant of tenants) {
    console.log(`\n🔄 Migrando base de datos del tenant: ${tenant.name} (${tenant.slug})`)
    console.log(`   Database URL: ${tenant.databaseUrl}`)

    try {
      // Resolver la ruta absoluta de la base de datos
      let absoluteDatabaseUrl = tenant.databaseUrl
      if (absoluteDatabaseUrl.startsWith('file:./')) {
        const relativePath = absoluteDatabaseUrl.replace('file:./', '')
        const absolutePath = path.resolve(process.cwd(), relativePath)
        // Usar forward slashes para Prisma (funciona en Windows también)
        absoluteDatabaseUrl = `file:${absolutePath.replace(/\\/g, '/')}`
      } else if (absoluteDatabaseUrl.startsWith('file:')) {
        const filePath = absoluteDatabaseUrl.replace('file:', '')
        if (!path.isAbsolute(filePath)) {
          const absolutePath = path.resolve(process.cwd(), filePath)
          // Usar forward slashes para Prisma
          absoluteDatabaseUrl = `file:${absolutePath.replace(/\\/g, '/')}`
        } else {
          // Ya es absoluta, solo normalizar separadores
          absoluteDatabaseUrl = `file:${filePath.replace(/\\/g, '/')}`
        }
      }

      console.log(`   Ruta absoluta: ${absoluteDatabaseUrl}`)

      // Verificar que el archivo existe
      const dbPath = absoluteDatabaseUrl.replace('file:', '')
      if (!fs.existsSync(dbPath)) {
        console.log(`   ⚠️  Base de datos no existe, saltando...`)
        continue
      }

      // Crear un schema temporal para este tenant
      const tempSchemaPath = path.join(process.cwd(), 'prisma', 'schema.tenant.temp.prisma')
      const originalSchema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8')
      
      // Reemplazar DATABASE_URL con la del tenant
      const tenantSchema = originalSchema.replace(
        /url\s*=\s*env\("DATABASE_URL"\)/,
        `url = "${absoluteDatabaseUrl}"`
      )

      fs.writeFileSync(tempSchemaPath, tenantSchema)

      try {
        // Ejecutar prisma db push con el schema temporal
        console.log(`   📤 Aplicando schema...`)
        const result = execSync(
          `npx prisma db push --schema="${tempSchemaPath}" --skip-generate`,
          { 
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: 'pipe'
          }
        )
        
        console.log(`   ✅ Schema aplicado exitosamente`)
        if (result) {
          console.log(`   ${result.trim()}`)
        }
      } catch (error: any) {
        console.error(`   ❌ Error aplicando schema:`, error.message)
        if (error.stdout) console.log(`   stdout: ${error.stdout}`)
        if (error.stderr) console.log(`   stderr: ${error.stderr}`)
      } finally {
        // Eliminar el schema temporal
        if (fs.existsSync(tempSchemaPath)) {
          fs.unlinkSync(tempSchemaPath)
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Error procesando tenant ${tenant.name}:`, error.message)
    }
  }

  console.log('\n✅ Migración de tenants completada')
}

migrateTenantDatabases()
  .catch((error) => {
    console.error('Error en migración:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

