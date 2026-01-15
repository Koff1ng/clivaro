-- =====================================================
-- MIGRACIÓN COMPLETA PARA SUPABASE
-- Ejecuta este script completo en el SQL Editor de Supabase
-- =====================================================

-- =====================================================
-- 1. CAMPOS DE ONBOARDING EN TENANTSETTINGS
-- =====================================================
DO $$ 
BEGIN
  -- onboardingCompleted
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingCompleted'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingCompleted" BOOLEAN DEFAULT false;
  END IF;

  -- onboardingUserName
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingUserName'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingUserName" TEXT;
  END IF;

  -- onboardingCompanyName
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingCompanyName'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingCompanyName" TEXT;
  END IF;
END $$;

-- =====================================================
-- 2. CAMPOS DE MERCADO PAGO EN TENANTSETTINGS
-- =====================================================
DO $$ 
BEGIN
  -- mercadoPagoAccessToken
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoAccessToken'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoAccessToken" TEXT;
  END IF;

  -- mercadoPagoPublicKey
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoPublicKey'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoPublicKey" TEXT;
  END IF;

  -- mercadoPagoEnabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoEnabled'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoEnabled" BOOLEAN DEFAULT false;
  END IF;

  -- mercadoPagoWebhookUrl
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoWebhookUrl'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoWebhookUrl" TEXT;
  END IF;
END $$;

-- =====================================================
-- 3. CAMPOS DE MERCADO PAGO EN SUBSCRIPTION
-- =====================================================
DO $$ 
BEGIN
  -- mercadoPagoPaymentId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPaymentId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPaymentId" TEXT;
  END IF;

  -- mercadoPagoPreferenceId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPreferenceId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPreferenceId" TEXT;
  END IF;

  -- mercadoPagoStatus
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoStatus'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoStatus" TEXT;
  END IF;

  -- mercadoPagoStatusDetail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoStatusDetail'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoStatusDetail" TEXT;
  END IF;

  -- mercadoPagoPaymentMethod
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPaymentMethod'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPaymentMethod" TEXT;
  END IF;

  -- mercadoPagoTransactionId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoTransactionId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoTransactionId" TEXT;
  END IF;

  -- mercadoPagoResponse
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoResponse'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoResponse" TEXT;
  END IF;
END $$;

-- Crear índices para Subscription
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_mercadoPagoPaymentId_key" 
ON "Subscription"("mercadoPagoPaymentId") 
WHERE "mercadoPagoPaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Subscription_mercadoPagoPreferenceId_idx" 
ON "Subscription"("mercadoPagoPreferenceId") 
WHERE "mercadoPagoPreferenceId" IS NOT NULL;

-- =====================================================
-- 4. CAMPOS DE MERCADO PAGO EN PAYMENT (OPCIONAL)
-- =====================================================
DO $$ 
BEGIN
  -- mercadoPagoPaymentId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPaymentId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPaymentId" TEXT;
  END IF;

  -- mercadoPagoPreferenceId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPreferenceId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPreferenceId" TEXT;
  END IF;

  -- mercadoPagoStatus
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoStatus'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoStatus" TEXT;
  END IF;

  -- mercadoPagoStatusDetail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoStatusDetail'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoStatusDetail" TEXT;
  END IF;

  -- mercadoPagoPaymentMethod
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPaymentMethod'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPaymentMethod" TEXT;
  END IF;

  -- mercadoPagoTransactionId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoTransactionId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoTransactionId" TEXT;
  END IF;

  -- mercadoPagoResponse
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoResponse'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoResponse" TEXT;
  END IF;

  -- updatedAt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Crear índices para Payment
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_key" 
ON "Payment"("mercadoPagoPaymentId") 
WHERE "mercadoPagoPaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Payment_mercadoPagoPreferenceId_idx" 
ON "Payment"("mercadoPagoPreferenceId") 
WHERE "mercadoPagoPreferenceId" IS NOT NULL;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
-- Verificar que todas las columnas se crearon correctamente
SELECT 
  'TenantSettings' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'TenantSettings'
  AND column_name IN (
    'onboardingCompleted',
    'onboardingUserName',
    'onboardingCompanyName',
    'mercadoPagoAccessToken',
    'mercadoPagoPublicKey',
    'mercadoPagoEnabled',
    'mercadoPagoWebhookUrl'
  )
ORDER BY column_name;

SELECT 
  'Subscription' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'Subscription'
  AND column_name LIKE 'mercadoPago%'
ORDER BY column_name;

SELECT 
  'Payment' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'Payment'
  AND column_name LIKE 'mercadoPago%'
ORDER BY column_name;

