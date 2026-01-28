
DO $$
DECLARE
    tenant_record RECORD;
    tenant_schema text;
BEGIN
    -- Loop through all tenants
    FOR tenant_record IN SELECT slug FROM public."Tenant" LOOP
        
        -- Calculate schema name safely
        tenant_schema := 'tenant_' || replace(lower(tenant_record.slug), '-', '_');
        
        RAISE NOTICE 'Processing Schema: %', tenant_schema;

        -- Set search path to the specific tenant schema
        PERFORM set_config('search_path', tenant_schema, true);

        -- 1. Create Tables if they don't exist
        
        -- TenantSettings
        CREATE TABLE IF NOT EXISTS "TenantSettings" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "electronicBillingProvider" TEXT,
            "electronicBillingApiUrl" TEXT,
            "electronicBillingApiKey" TEXT,
            "companyNit" TEXT,
            "companyName" TEXT,
            "companyAddress" TEXT,
            "companyPhone" TEXT,
            "companyEmail" TEXT,
            "billingResolutionNumber" TEXT,
            "billingResolutionPrefix" TEXT,
            "billingResolutionFrom" TEXT,
            "billingResolutionTo" TEXT,
            "billingResolutionValidFrom" TIMESTAMP(3),
            "billingResolutionValidTo" TIMESTAMP(3),
            "subscriptionTrialDays" INTEGER DEFAULT 14,
            "subscriptionGracePeriodDays" INTEGER DEFAULT 7,
            "subscriptionAutoRenew" BOOLEAN DEFAULT true,
            "timezone" TEXT DEFAULT 'America/Bogota',
            "currency" TEXT DEFAULT 'COP',
            "dateFormat" TEXT DEFAULT 'DD/MM/YYYY',
            "timeFormat" TEXT DEFAULT '24h',
            "language" TEXT DEFAULT 'es',
            "invoicePrefix" TEXT DEFAULT 'FV',
            "invoiceNumberFormat" TEXT DEFAULT '000000',
            "quotationPrefix" TEXT DEFAULT 'COT',
            "quotationNumberFormat" TEXT DEFAULT '000000',
            "purchaseOrderPrefix" TEXT DEFAULT 'OC',
            "purchaseOrderNumberFormat" TEXT DEFAULT '000000',
            "customSettings" TEXT,
            "onboardingCompleted" BOOLEAN DEFAULT false,
            "onboardingUserName" TEXT,
            "onboardingCompanyName" TEXT,
            "enableRestaurantMode" BOOLEAN DEFAULT false,
            "mercadoPagoAccessToken" TEXT,
            "mercadoPagoPublicKey" TEXT,
            "mercadoPagoEnabled" BOOLEAN DEFAULT false,
            "mercadoPagoWebhookUrl" TEXT,
            "metaBusinessId" TEXT,
            "metaAccessToken" TEXT,
            "whatsappPhoneNumberId" TEXT,
            "instagramAccountId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
        );
        
        -- Index for TenantSettings
        BEGIN
            CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");
        EXCEPTION WHEN duplicate_table THEN NULL; END;

        -- Ensure Product table exists (base table)
        CREATE TABLE IF NOT EXISTS "Product" (
            "id" TEXT NOT NULL, "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "price" DOUBLE PRECISION NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
        );

        -- Ensure StockMovement table exists
        CREATE TABLE IF NOT EXISTS "StockMovement" (
            "id" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "productId" TEXT NOT NULL, "type" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "cost" DOUBLE PRECISION NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL,
            CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
        );

        -- Create Restaurant Tables
        CREATE TABLE IF NOT EXISTS "Unit" (
            "id" TEXT NOT NULL, "name" TEXT NOT NULL, "symbol" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "UnitConversion" (
            "id" TEXT NOT NULL, "fromUnitId" TEXT NOT NULL, "toUnitId" TEXT NOT NULL, "multiplier" DOUBLE PRECISION NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "Recipe" (
            "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "yield" DOUBLE PRECISION NOT NULL DEFAULT 1, "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "RecipeItem" (
            "id" TEXT NOT NULL, "recipeId" TEXT NOT NULL, "ingredientId" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "unitId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
        );

        -- 2. Add Columns (using Exception Block pattern)
        
        BEGIN ALTER TABLE "Product" ADD COLUMN "productType" TEXT NOT NULL DEFAULT 'RETAIL'; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE "Product" ADD COLUMN "enableRecipeConsumption" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
        
        BEGIN ALTER TABLE "StockMovement" ADD COLUMN "reasonCode" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE "StockMovement" ADD COLUMN "reasonNote" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN ALTER TABLE "TenantSettings" ADD COLUMN "enableRestaurantMode" BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE "TenantSettings" ADD COLUMN "customSettings" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE "TenantSettings" ADD COLUMN "onboardingCompleted" BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;

        -- 3. Indexes & Constraints

        BEGIN CREATE INDEX "UnitConversion_fromUnitId_toUnitId_idx" ON "UnitConversion"("fromUnitId", "toUnitId"); EXCEPTION WHEN duplicate_table THEN NULL; END;
        BEGIN CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId"); EXCEPTION WHEN duplicate_table THEN NULL; END;
        BEGIN CREATE INDEX "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId"); EXCEPTION WHEN duplicate_table THEN NULL; END;
        BEGIN CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId"); EXCEPTION WHEN duplicate_table THEN NULL; END;

        -- Foreign Keys
        BEGIN ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        
        BEGIN ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        
        BEGIN ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;

    END LOOP;
    
    -- Restore public schema to update the function
    PERFORM set_config('search_path', 'public', true);
    
    -- Security Fix Function
    EXECUTE 'CREATE OR REPLACE FUNCTION public.set_updated_at_column() RETURNS TRIGGER AS $func$ BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $func$ language plpgsql SECURITY DEFINER SET search_path = public';

END $$;
