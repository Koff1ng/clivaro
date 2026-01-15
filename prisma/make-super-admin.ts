import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function makeSuperAdmin(username?: string) {
  try {
    console.log('=== Crear Super Administrador ===\n')
    
    const targetUsername = username || process.argv[2]
    
    if (!targetUsername) {
      rl.question('Ingresa el username del usuario a convertir en super admin: ', async (inputUsername) => {
        await processUser(inputUsername)
      })
    } else {
      await processUser(targetUsername)
    }
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

async function processUser(username: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      console.error(`❌ Usuario "${username}" no encontrado`)
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: true }
    })

    console.log(`\n✅ Usuario "${username}" ahora es Super Administrador`)
    console.log('Puedes acceder al panel admin en: /admin/tenants')
    
    rl.close()
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }
}

makeSuperAdmin()

