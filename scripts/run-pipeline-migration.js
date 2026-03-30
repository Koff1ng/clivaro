const { PrismaClient } = require('@prisma/client')

const master = new PrismaClient()

async function main() {
  // 1. Find all tenant schemas
  const schemas = await master.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%' 
    ORDER BY schema_name
  `)
  console.log('Tenant schemas:', schemas.length)

  for (const schema of schemas) {
    const name = schema.schema_name
    console.log(`\n=== ${name} ===`)
    try {
      await master.$executeRawUnsafe(`SET search_path TO "${name}"`)

      // Add new columns to Opportunity
      const alterCols = [
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "description" TEXT`,
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "stageId" TEXT`,
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM'`,
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source" TEXT`,
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT`,
        `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0`,
      ]
      for (const sql of alterCols) {
        try { await master.$executeRawUnsafe(sql); console.log('  OK: ALTER') }
        catch(e) { console.log('  SKIP ALTER:', e.message?.substring(0, 60)) }
      }

      // Make customerId optional
      try {
        await master.$executeRawUnsafe(`ALTER TABLE "Opportunity" ALTER COLUMN "customerId" DROP NOT NULL`)
        console.log('  OK: customerId nullable')
      } catch(e) { console.log('  SKIP:', e.message?.substring(0, 60)) }

      // Create PipelineStage table
      try {
        await master.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "PipelineStage" (
            "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
            "name" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT '#6366f1',
            "order" INTEGER NOT NULL DEFAULT 0,
            "isDefault" BOOLEAN NOT NULL DEFAULT false,
            "isWon" BOOLEAN NOT NULL DEFAULT false,
            "isLost" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
          )
        `)
        console.log('  OK: PipelineStage table')
      } catch(e) { console.log('  SKIP:', e.message?.substring(0, 60)) }

      try {
        await master.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PipelineStage_order_idx" ON "PipelineStage"("order")`)
      } catch(e) {}

      // FK Opportunity -> PipelineStage
      try {
        await master.$executeRawUnsafe(`
          ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey"
          FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE
        `)
        console.log('  OK: FK stageId')
      } catch(e) { console.log('  SKIP FK:', e.message?.substring(0, 60)) }

      try {
        await master.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Opportunity_stageId_idx" ON "Opportunity"("stageId")`)
      } catch(e) {}

      // OpportunityActivity table
      try {
        await master.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "OpportunityActivity" (
            "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
            "type" TEXT NOT NULL,
            "content" TEXT,
            "metadata" TEXT,
            "opportunityId" TEXT NOT NULL,
            "createdById" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "OpportunityActivity_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "OpportunityActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") 
              REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `)
        console.log('  OK: OpportunityActivity table')
      } catch(e) { console.log('  SKIP:', e.message?.substring(0, 60)) }

      try {
        await master.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OpportunityActivity_opportunityId_idx" ON "OpportunityActivity"("opportunityId")`)
      } catch(e) {}

      // Seed pipeline stages (only if empty)
      const stageCount = await master.$queryRawUnsafe(`SELECT count(*)::int as c FROM "PipelineStage"`)
      if (stageCount[0].c === 0) {
        const stages = [
          ['Nuevo', '#6366f1', 0, true, false, false],
          ['Contactado', '#3b82f6', 1, false, false, false],
          ['En Negociación', '#f59e0b', 2, false, false, false],
          ['Propuesta Enviada', '#8b5cf6', 3, false, false, false],
          ['Cerrado Ganado', '#10b981', 4, false, true, false],
          ['Cerrado Perdido', '#ef4444', 5, false, false, true],
        ]
        for (const [sname, color, order, isDefault, isWon, isLost] of stages) {
          await master.$executeRawUnsafe(`
            INSERT INTO "PipelineStage" ("id", "name", "color", "order", "isDefault", "isWon", "isLost", "updatedAt")
            VALUES (gen_random_uuid()::text, '${sname}', '${color}', ${order}, ${isDefault}, ${isWon}, ${isLost}, CURRENT_TIMESTAMP)
          `)
        }
        console.log('  OK: Seeded 6 stages')
      } else {
        console.log('  SKIP: Stages already exist (' + stageCount[0].c + ')')
      }

    } catch (e) {
      console.log(`  ERROR: ${e.message?.substring(0, 80)}`)
    }
  }

  await master.$executeRawUnsafe('SET search_path TO public')
  await master.$disconnect()
  console.log('\nDone!')
}

main()
