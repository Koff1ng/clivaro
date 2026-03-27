-- Add Factus fields to TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "factusClientId" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "factusClientSecret" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "factusUsername" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "factusPassword" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "factusSandbox" BOOLEAN DEFAULT true;
