-- Add new pipeline columns to existing Opportunity table
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "stageId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Opportunity" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "value" SET DEFAULT 0;

-- Pipeline Stages
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
);
CREATE INDEX IF NOT EXISTS "PipelineStage_order_idx" ON "PipelineStage"("order");

-- FK from Opportunity to PipelineStage (only if doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Opportunity_stageId_fkey'
  ) THEN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey"
      FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Opportunity_stageId_idx" ON "Opportunity"("stageId");

-- Opportunity Activities
CREATE TABLE IF NOT EXISTS "OpportunityActivity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "metadata" TEXT,
    "opportunityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpportunityActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OpportunityActivity_opportunityId_idx" ON "OpportunityActivity"("opportunityId");

-- Seed default pipeline stages (only if empty)
INSERT INTO "PipelineStage" ("id", "name", "color", "order", "isDefault", "isWon", "isLost", "updatedAt")
SELECT gen_random_uuid()::text, s.name, s.color, s.ord, s.is_default, s.is_won, s.is_lost, CURRENT_TIMESTAMP
FROM (VALUES
    ('Nuevo', '#6366f1', 0, true, false, false),
    ('Contactado', '#3b82f6', 1, false, false, false),
    ('En Negociación', '#f59e0b', 2, false, false, false),
    ('Propuesta Enviada', '#8b5cf6', 3, false, false, false),
    ('Cerrado Ganado', '#10b981', 4, false, true, false),
    ('Cerrado Perdido', '#ef4444', 5, false, false, true)
) AS s(name, color, ord, is_default, is_won, is_lost)
WHERE NOT EXISTS (SELECT 1 FROM "PipelineStage" LIMIT 1);
