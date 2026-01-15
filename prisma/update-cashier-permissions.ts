import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Actualizando permisos del cajero...')

  // Get CASHIER role
  const cashierRole = await prisma.role.findUnique({
    where: { name: 'CASHIER' },
  })

  if (!cashierRole) {
    console.error('Rol CASHIER no encontrado')
    process.exit(1)
  }

  // Get permissions
  const permissionMap = new Map()
  const permissions = await prisma.permission.findMany()
  permissions.forEach(perm => {
    permissionMap.set(perm.name, perm.id)
  })

  // Permissions for cashier: manage_sales, manage_cash, manage_crm
  const cashierPerms = ['manage_sales', 'manage_cash', 'manage_crm']
  
  // Delete existing permissions for CASHIER
  await prisma.rolePermission.deleteMany({
    where: { roleId: cashierRole.id },
  })

  // Add new permissions
  for (const permName of cashierPerms) {
    const permId = permissionMap.get(permName)
    if (permId) {
      await prisma.rolePermission.create({
        data: {
          roleId: cashierRole.id,
          permissionId: permId,
        },
      })
      console.log(`✓ Permiso ${permName} asignado al rol CASHIER`)
    } else {
      console.warn(`⚠ Permiso ${permName} no encontrado`)
    }
  }

  // Verify cashier user exists and is active
  const cashierUser = await prisma.user.findUnique({
    where: { email: 'cashier@local' },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (cashierUser) {
    console.log(`\nUsuario cajero encontrado:`)
    console.log(`  Email: ${cashierUser.email}`)
    console.log(`  Nombre: ${cashierUser.name}`)
    console.log(`  Activo: ${cashierUser.active}`)
    console.log(`  Roles: ${cashierUser.userRoles.map(ur => ur.role.name).join(', ')}`)
    
    if (!cashierUser.active) {
      console.log('\n⚠ El usuario cajero está inactivo. Activándolo...')
      await prisma.user.update({
        where: { id: cashierUser.id },
        data: { active: true },
      })
      console.log('✓ Usuario cajero activado')
    }
  } else {
    console.warn('\n⚠ Usuario cajero no encontrado. Creándolo...')
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash('Cashier123!', 10)
    
    const newCashierUser = await prisma.user.create({
      data: {
        username: 'cashier',
        email: 'cashier@local',
        password: hashedPassword,
        name: 'Cashier',
        active: true,
      },
    })

    await prisma.userRole.create({
      data: {
        userId: newCashierUser.id,
        roleId: cashierRole.id,
      },
    })
    
    console.log('✓ Usuario cajero creado')
  }

  console.log('\n✓ Permisos del cajero actualizados correctamente')
  console.log('\nCredenciales del cajero:')
  console.log('  Email: cashier@local')
  console.log('  Contraseña: Cashier123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

