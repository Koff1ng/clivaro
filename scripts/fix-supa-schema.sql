-- Script para corregir el esquema en Supabase (Producción)
-- Ejecutar en SQL Editor de Supabase -> New Query

-- 1. Crear tabla ChatMessage si no existe
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- Crear índices para ChatMessage
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChatMessage_externalId_key') THEN
        CREATE UNIQUE INDEX "ChatMessage_externalId_key" ON "ChatMessage"("externalId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChatMessage_leadId_idx') THEN
        CREATE INDEX "ChatMessage_leadId_idx" ON "ChatMessage"("leadId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChatMessage_externalId_idx') THEN
        CREATE INDEX "ChatMessage_externalId_idx" ON "ChatMessage"("externalId");
    END IF;
END $$;

-- Agregar Foreign Key con seguridad para evitar errores si ya existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ChatMessage_leadId_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. Actualizar tabla Lead (agregar columna instagram)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "instagram" TEXT;

-- 3. Actualizar tabla TenantSettings (agregar campos de Meta/WhatsApp)
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "metaBusinessId" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "metaAccessToken" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;

-- Confirmación
SELECT 'Migración completada exitosamente' as result;
