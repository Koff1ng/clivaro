import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()
const log: string[] = []

async function main() {
  try {
    const allSubs = await prisma.subscription.findMany({
      include: { plan: true, tenant: true },
    })
    
    log.push('Total subscriptions: ' + allSubs.length)
    for (const s of allSubs) {
      log.push('  ' + (s.tenant?.name || '?') + ' | ' + (s.plan?.name || '?') + ' | ' + s.status)
    }
    
    const result = await prisma.subscription.updateMany({
      where: { status: 'pending_payment' },
      data: { status: 'active' },
    })
    log.push('Updated: ' + result.count)
  } catch (e: any) {
    log.push('ERROR: ' + e.message)
  }
  
  writeFileSync('C:/tmp/fix-result.txt', log.join('\n'))
  await prisma.$disconnect()
}

main()
