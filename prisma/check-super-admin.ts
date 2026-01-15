import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Super Administradores ===\n')
  
  const superAdmins = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      active: true,
    }
  })

  if (superAdmins.length === 0) {
    console.log('❌ No se encontraron super administradores')
  } else {
    console.log(`✅ Se encontraron ${superAdmins.length} super administrador(es):\n`)
    superAdmins.forEach((user, index) => {
      console.log(`${index + 1}. Usuario:`)
      console.log(`   - ID: ${user.id}`)
      console.log(`   - Username: ${user.username}`)
      console.log(`   - Email: ${user.email || 'N/A'}`)
      console.log(`   - Nombre: ${user.name}`)
      console.log(`   - Activo: ${user.active ? 'Sí' : 'No'}`)
      console.log(`   - Super Admin: ${user.isSuperAdmin ? 'Sí' : 'No'}`)
      console.log('')
    })
  }

  await prisma.$disconnect()
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })


