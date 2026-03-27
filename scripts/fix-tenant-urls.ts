import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Fix Variedades: tenant_variedadesorito -> tenant_cmn0ijh1f0000uncjbsqn8jtc
  const variedades = await prisma.tenant.findFirst({ where: { slug: 'variedadesorito' } })
  if (variedades) {
    const currentUrl = variedades.databaseUrl
    const newUrl = currentUrl.replace('schema=tenant_variedadesorito', `schema=tenant_${variedades.id}`)
    console.log(`Variedades (${variedades.id}):`)
    console.log(`  OLD: ...schema=tenant_variedadesorito`)
    console.log(`  NEW: ...schema=tenant_${variedades.id}`)
    
    await prisma.tenant.update({
      where: { id: variedades.id },
      data: { databaseUrl: newUrl }
    })
    console.log('  FIXED!')
  }

  // Fix Heladeria: tenant_heladeria -> tenant_cmn2ngd9h00008ygrjcr08qqi
  const heladeria = await prisma.tenant.findFirst({ where: { slug: 'heladeria' } })
  if (heladeria) {
    const currentUrl = heladeria.databaseUrl
    const newUrl = currentUrl.replace('schema=tenant_heladeria', `schema=tenant_${heladeria.id}`)
    console.log(`Heladeria (${heladeria.id}):`)
    console.log(`  OLD: ...schema=tenant_heladeria`)
    console.log(`  NEW: ...schema=tenant_${heladeria.id}`)
    
    await prisma.tenant.update({
      where: { id: heladeria.id },
      data: { databaseUrl: newUrl }
    })
    console.log('  FIXED!')
  }

  await prisma.$disconnect()
  console.log('\nDone. Both tenants now point to their correct schemas.')
}

main().catch(console.error)
