import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()
const log: string[] = []

async function main() {
  try {
    // Check if autoSendElectronic column exists
    const result: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'TenantSettings' 
      AND column_name = 'autoSendElectronic'
    `)
    log.push('Column exists: ' + (result.length > 0 ? 'YES' : 'NO'))
    
    // Check current values
    if (result.length > 0) {
      const settings: any[] = await prisma.$queryRawUnsafe(`
        SELECT "tenantId", "autoSendElectronic", "factusClientId" 
        FROM "TenantSettings"
      `)
      log.push('Settings count: ' + settings.length)
      for (const s of settings) {
        log.push('  tenant: ' + s.tenantId + ' | autoSend: ' + s.autoSendElectronic + ' | factusId: ' + (s.factusClientId ? 'SET' : 'NULL'))
      }
    } else {
      log.push('Column does not exist - adding it...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TenantSettings" 
        ADD COLUMN IF NOT EXISTS "autoSendElectronic" BOOLEAN DEFAULT false
      `)
      log.push('Column added successfully')
    }
  } catch (e: any) {
    log.push('ERROR: ' + e.message)
  }
  
  writeFileSync('C:/tmp/check-auto-send.txt', log.join('\n'))
  await prisma.$disconnect()
}

main()
