import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Migrando usuarios existentes para agregar campo username...')
  
  try {
    // Get all users
    const users = await prisma.user.findMany()
    
    console.log(`Total de usuarios encontrados: ${users.length}`)

    for (const user of users) {
      // Skip if username already exists
      if (user.username && user.username.trim() !== '') {
        console.log(`Usuario ${user.name} ya tiene username: ${user.username}`)
        continue
      }

      // Generate username from email or name
      let username = ''
      
      if (user.email) {
        // Use email prefix as username, remove special characters
        username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
      } else {
        // Use name, convert to lowercase and replace spaces with underscores
        username = user.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      }

      // Ensure username is not empty
      if (!username || username.trim() === '') {
        username = `user_${user.id.substring(0, 8)}`
      }

      // Ensure username is unique by appending number if needed
      let finalUsername = username
      let counter = 1
      while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
        finalUsername = `${username}_${counter}`
        counter++
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { username: finalUsername },
      })

      console.log(`✓ Actualizado usuario ${user.name} (${user.email || 'sin email'}): ${finalUsername}`)
    }

    console.log('\n✅ Migración completada!')
    console.log('Ahora puedes hacer username requerido en el schema ejecutando:')
    console.log('1. Edita prisma/schema.prisma y cambia "username String? @unique" a "username String @unique"')
    console.log('2. Ejecuta: npx prisma migrate dev --name make_username_required')
  } catch (error: any) {
    console.error('❌ Error durante la migración:', error.message)
    if (error.code === 'P2002') {
      console.error('Error: Ya existe un usuario con ese username. Revisa los datos.')
    }
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

