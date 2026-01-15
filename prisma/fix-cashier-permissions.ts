import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Corrigiendo permisos del cajero...')

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

  // Permissions for cashier: manage_sales, manage_cash, manage_crm, view_reports (for dashboard)
  const cashierPerms = ['manage_sales', 'manage_cash', 'manage_crm', 'view_reports']
  
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

  console.log('\n✅ Permisos del cajero actualizados correctamente!')
  console.log('Permisos asignados:')
  cashierPerms.forEach(perm => console.log(`  - ${perm}`))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

