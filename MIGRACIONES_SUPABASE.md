# Migraciones SQL para Supabase

Ejecuta estas migraciones en el SQL Editor de Supabase para actualizar la base de datos con los nuevos campos.

## 1. Campos de Onboarding en TenantSettings

```sql
-- Ejecutar: prisma/migrations/add-onboarding-fields.sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingCompleted'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingCompleted" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingUserName'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingUserName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'onboardingCompanyName'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "onboardingCompanyName" TEXT;
  END IF;
END $$;
```

## 2. Campos de Mercado Pago en TenantSettings

```sql
-- Ejecutar: prisma/migrations/add-mercadopago-fields.sql (solo la parte de TenantSettings)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoAccessToken'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoAccessToken" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoPublicKey'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoPublicKey" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoEnabled'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoEnabled" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TenantSettings' 
    AND column_name = 'mercadoPagoWebhookUrl'
  ) THEN
    ALTER TABLE "TenantSettings" 
    ADD COLUMN "mercadoPagoWebhookUrl" TEXT;
  END IF;
END $$;
```

## 3. Campos de Mercado Pago en Subscription

```sql
-- Ejecutar: prisma/migrations/add-mercadopago-subscription-fields.sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPaymentId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPaymentId" TEXT;
    
    CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_mercadoPagoPaymentId_key" 
    ON "Subscription"("mercadoPagoPaymentId") 
    WHERE "mercadoPagoPaymentId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPreferenceId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPreferenceId" TEXT;
    
    CREATE INDEX IF NOT EXISTS "Subscription_mercadoPagoPreferenceId_idx" 
    ON "Subscription"("mercadoPagoPreferenceId") 
    WHERE "mercadoPagoPreferenceId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoStatus'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoStatus" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoStatusDetail'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoStatusDetail" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoPaymentMethod'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoPaymentMethod" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoTransactionId'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoTransactionId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Subscription' 
    AND column_name = 'mercadoPagoResponse'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD COLUMN "mercadoPagoResponse" TEXT;
  END IF;
END $$;
```

## 4. Campos de Mercado Pago en Payment (opcional, para compatibilidad)

```sql
-- Ejecutar: prisma/migrations/add-mercadopago-fields.sql (solo la parte de Payment)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPaymentId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPaymentId" TEXT;
    
    CREATE UNIQUE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_key" 
    ON "Payment"("mercadoPagoPaymentId") 
    WHERE "mercadoPagoPaymentId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPreferenceId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPreferenceId" TEXT;
    
    CREATE INDEX IF NOT EXISTS "Payment_mercadoPagoPreferenceId_idx" 
    ON "Payment"("mercadoPagoPreferenceId") 
    WHERE "mercadoPagoPreferenceId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoStatus'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoStatus" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoStatusDetail'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoStatusDetail" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoPaymentMethod'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoPaymentMethod" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoTransactionId'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoTransactionId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'mercadoPagoResponse'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "mercadoPagoResponse" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' 
    AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "Payment" 
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
```

## 5. Actualizar método de Payment para incluir MERCADOPAGO

```sql
-- Asegurar que el campo method puede aceptar 'MERCADOPAGO'
-- (Esto generalmente no requiere cambios si el campo es TEXT/VARCHAR)
-- Pero verificar que no haya constraints que lo impidan
```

## Instrucciones

1. Ve al SQL Editor de Supabase
2. Ejecuta cada bloque SQL en orden (1, 2, 3, 4)
3. Verifica que no haya errores
4. Los endpoints deberían funcionar correctamente después de estas migraciones

## Nota Importante

Si los errores 500 persisten después de ejecutar las migraciones, verifica:
- Que las tablas existan en la base de datos
- Que no haya problemas de conexión
- Revisa los logs de Vercel para ver el error específico

