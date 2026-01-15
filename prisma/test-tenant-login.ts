import { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/db'
import { getTenantPrisma } from '../lib/tenant-db'
import bcrypt from 'bcryptjs'

async function main() {
  const tenantSlug = process.argv[2] || 'ferro-agro'
  const username = process.argv[3] || 'admin'
  const password = process.argv[4] || 'Admin123!'
  
  console.log(`=== Probando login para tenant: ${tenantSlug} ===\n`)
  console.log(`Usuario: ${username}`)
  console.log(`Contraseña: ${password}\n`)
  
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

    if (!tenant || !tenant.active) {
      console.error(`❌ Tenant "${tenantSlug}" no encontrado o inactivo`)
      process.exit(1)
    }

    console.log(`✓ Tenant encontrado: ${tenant.name}`)
    console.log(`  Database URL: ${tenant.databaseUrl}\n`)

    // Conectar a la BD del tenant
    const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
    
    // Buscar usuario
    const user = await tenantPrisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.error(`❌ Usuario "${username}" no encontrado`)
      process.exit(1)
    }

    console.log(`✓ Usuario encontrado:`)
    console.log(`  - ID: ${user.id}`)
    console.log(`  - Username: ${user.username}`)
    console.log(`  - Email: ${user.email || 'N/A'}`)
    console.log(`  - Activo: ${user.active ? 'Sí' : 'No'}`)
    console.log(`  - Password hash: ${user.password.substring(0, 30)}...\n`)

    // Verificar contraseña
    console.log('Verificando contraseña...')
    const isValid = await bcrypt.compare(password, user.password)
    
    if (isValid) {
      console.log('✓ Contraseña válida\n')
      
      // Mostrar permisos
      const permissions = new Set<string>()
      user.userRoles.forEach(userRole => {
        userRole.role.rolePermissions.forEach(rp => {
          permissions.add(rp.permission.name)
        })
      })
      
      console.log(`Permisos (${permissions.size}):`)
      Array.from(permissions).forEach(p => console.log(`  - ${p}`))
    } else {
      console.error('❌ Contraseña inválida')
      console.log(`\nHash almacenado: ${user.password}`)
      console.log(`Contraseña probada: ${password}`)
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


