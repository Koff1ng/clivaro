-- ==========================================
-- PHASE 3: INVENTORY (Zones & Manufacturing)
-- ==========================================

-- Create Unit Table
CREATE TABLE IF NOT EXISTS "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- Create UnitConversion Table
CREATE TABLE IF NOT EXISTS "UnitConversion" (
    "id" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- Create Recipe Table
CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "yield" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- Create RecipeItem Table
CREATE TABLE IF NOT EXISTS "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- Create WarehouseZone Table
CREATE TABLE IF NOT EXISTS "WarehouseZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "warehouseId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

-- Create PhysicalInventory Table
CREATE TABLE IF NOT EXISTS "PhysicalInventory" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "PhysicalInventory_pkey" PRIMARY KEY ("id")
);

-- Create PhysicalInventoryItem Table
CREATE TABLE IF NOT EXISTS "PhysicalInventoryItem" (
    "id" TEXT NOT NULL,
    "physicalInventoryId" TEXT NOT NULL,
    "zoneId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "systemQuantity" DOUBLE PRECISION NOT NULL,
    "countedQuantity" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhysicalInventoryItem_pkey" PRIMARY KEY ("id")
);

-- Update Product Table (New columns)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "enableRecipeConsumption" BOOLEAN DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "printerStation" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "preferredZoneId" TEXT;

-- Update StockLevel Table (New columns)
ALTER TABLE "StockLevel" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;

-- Update StockMovement Table (New columns)
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reasonNote" TEXT;


-- ==========================================
-- PHASE 4: POS & CASH CLOSING
-- ==========================================

-- Create PaymentMethod Table
CREATE TABLE IF NOT EXISTS "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ELECTRONIC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- Create CashShift Table (If not exists, or update)
CREATE TABLE IF NOT EXISTS "CashShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "startingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countedCash" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- Create CashMovement Table
CREATE TABLE IF NOT EXISTS "CashMovement" (
    "id" TEXT NOT NULL,
    "cashShiftId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- Create ShiftSummary Table
CREATE TABLE IF NOT EXISTS "ShiftSummary" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualAmount" DOUBLE PRECISION,
    CONSTRAINT "ShiftSummary_pkey" PRIMARY KEY ("id")
);


-- ==========================================
-- PHASE 5: ACCOUNTS RECEIVABLE
-- ==========================================

-- Update Customer Table
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "creditLimit" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "currentBalance" DOUBLE PRECISION DEFAULT 0;


-- ==========================================
-- PHASE 6: CRM & SALES ORDERS
-- ==========================================

-- Create Lead Table
CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "instagram" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "value" DOUBLE PRECISION,
    "expectedRevenue" DOUBLE PRECISION,
    "probability" DOUBLE PRECISION DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Create LeadStageHistory Table
CREATE TABLE IF NOT EXISTS "LeadStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "LeadStageHistory_pkey" PRIMARY KEY ("id")
);

-- Create Activity Table
CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- Create Campaign Table
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "spent" DOUBLE PRECISION DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- Create Opportunity Table
CREATE TABLE IF NOT EXISTS "Opportunity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "assignedToId" TEXT,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- Create Quotation Table
CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- Create QuotationItem Table
CREATE TABLE IF NOT EXISTS "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- Create SalesOrder Table
CREATE TABLE IF NOT EXISTS "SalesOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "quotationId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- Create SalesOrderItem Table
CREATE TABLE IF NOT EXISTS "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);


-- ==========================================
-- PHASE 7: MARKETING & UNSUBSCRIBE
-- ==========================================

-- Create MarketingCampaign Table
CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- Create MarketingCampaignRecipient Table
CREATE TABLE IF NOT EXISTS "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- Create Unsubscribe Table
CREATE TABLE IF NOT EXISTS "Unsubscribe" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unsubscribe_pkey" PRIMARY KEY ("id")
);


-- ==========================================
-- PHASE 8: ACCOUNTING & PAYROLL
-- ==========================================

-- Create AccountingAccount Table
CREATE TABLE IF NOT EXISTS "AccountingAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- Create JournalEntry Table
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- Create JournalEntryLine Table
CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- Create Employee Table
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- Create PayrollRun Table
CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- Create PayrollItem Table
CREATE TABLE IF NOT EXISTS "PayrollItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- Create Indexes (Crucial for performance/uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS "AccountingAccount_code_key" ON "AccountingAccount"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Unsubscribe_email_key" ON "Unsubscribe"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_documentId_key" ON "Employee"("documentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PhysicalInventory_number_key" ON "PhysicalInventory"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentMethod_name_key" ON "PaymentMethod"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_productId_key" ON "Recipe"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_number_key" ON "Quotation"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_number_key" ON "SalesOrder"("number");


-- Indexes for lookups
CREATE INDEX IF NOT EXISTS "JournalEntry_date_idx" ON "JournalEntry"("date");
CREATE INDEX IF NOT EXISTS "PayrollItem_payrollRunId_idx" ON "PayrollItem"("payrollRunId");
