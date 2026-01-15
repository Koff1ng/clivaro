import { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/db'
import { getTenantPrisma } from '../lib/tenant-db'

async function main() {
  const tenantSlug = process.argv[2] || 'ferro-agro'
  
  console.log(`=== Verificando usuario en tenant: ${tenantSlug} ===\n`)
  
  try {
    // Obtener tenant de la BD maestra
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        databaseUrl: true,
        active: true,
      }
    })

    if (!tenant) {
      console.error(`❌ Tenant "${tenantSlug}" no encontrado`)
      process.exit(1)
    }

    console.log(`✓ Tenant encontrado: ${tenant.name}`)
    console.log(`  ID: ${tenant.id}`)
    console.log(`  Database URL: ${tenant.databaseUrl}`)
    console.log(`  Activo: ${tenant.active ? 'Sí' : 'No'}\n`)

    // Conectar a la BD del tenant
    const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
    
    console.log('Conectando a la base de datos del tenant...')
    await tenantPrisma.$connect()
    console.log('✓ Conectado\n')

    // Verificar tablas
    const tables = await tenantPrisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
    console.log(`Tablas encontradas: ${tables.length}`)
    tables.forEach(t => console.log(`  - ${t.name}`))
    console.log('')

    // Buscar usuario admin
    const users = await tenantPrisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })

    console.log(`Usuarios encontrados: ${users.length}\n`)

    if (users.length === 0) {
      console.error('❌ No se encontraron usuarios en la BD del tenant')
      console.log('\nEl usuario admin no se creó durante la inicialización.')
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Usuario:`)
        console.log(`   - ID: ${user.id}`)
        console.log(`   - Username: ${user.username}`)
        console.log(`   - Email: ${user.email || 'N/A'}`)
        console.log(`   - Nombre: ${user.name}`)
        console.log(`   - Activo: ${user.active ? 'Sí' : 'No'}`)
        console.log(`   - Roles: ${user.userRoles.map(ur => ur.role.name).join(', ') || 'Ninguno'}`)
        console.log('')
      })
    }

    // Buscar específicamente el usuario "admin"
    const adminUser = await tenantPrisma.user.findUnique({
      where: { username: 'admin' },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })

    if (adminUser) {
      console.log('✓ Usuario "admin" encontrado:')
      console.log(`   - Password hash: ${adminUser.password.substring(0, 20)}...`)
      console.log(`   - Roles: ${adminUser.userRoles.map(ur => ur.role.name).join(', ')}`)
    } else {
      console.error('❌ Usuario "admin" NO encontrado')
    }

    await tenantPrisma.$disconnect()
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })


