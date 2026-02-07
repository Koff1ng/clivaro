-- Migration: Add Credit Notes System
-- This migration adds the credit notes tables and fields

-- 1. Add alegraId to CreditNote (if table exists, we'll modify it)
-- First check if CreditNote table exists, if not create it

-- Create CreditNote table
CREATE TABLE IF NOT EXISTS "CreditNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" TEXT NOT NULL UNIQUE,
  "prefix" TEXT,
  "consecutive" TEXT,
  "invoiceId" TEXT NOT NULL,
  "returnId" TEXT UNIQUE,
  "type" TEXT NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "affectedPeriod" TEXT,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cufe" TEXT UNIQUE,
  "qrCode" TEXT,
  "electronicStatus" TEXT,
  "electronicSentAt" TIMESTAMP(3),
  "electronicResponse" TEXT,
  "resolutionNumber" TEXT,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "alegraId" TEXT,
  CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditNote_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for CreditNote
CREATE INDEX IF NOT EXISTS "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "CreditNote_status_idx" ON "CreditNote"("status");
CREATE INDEX IF NOT EXISTS "CreditNote_createdAt_idx" ON "CreditNote"("createdAt");
CREATE INDEX IF NOT EXISTS "CreditNote_electronicStatus_idx" ON "CreditNote"("electronicStatus");

-- Create CreditNoteItem table
CREATE TABLE IF NOT EXISTS "CreditNoteItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditNoteId" TEXT NOT NULL,
  "invoiceItemId" TEXT,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteItem_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for CreditNoteItem
CREATE INDEX IF NOT EXISTS "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");
CREATE INDEX IF NOT EXISTS "CreditNoteItem_invoiceItemId_idx" ON "CreditNoteItem"("invoiceItemId");
CREATE INDEX IF NOT EXISTS "CreditNoteItem_productId_idx" ON "CreditNoteItem"("productId");

-- Create CreditNoteLineTax table
CREATE TABLE IF NOT EXISTS "CreditNoteLineTax" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditNoteItemId" TEXT NOT NULL,
  "taxRateId" TEXT NOT NULL,
  "taxableAmount" DOUBLE PRECISION NOT NULL,
  "taxAmount" DOUBLE PRECISION NOT NULL,
  "taxPercentage" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteLineTax_creditNoteItemId_fkey" FOREIGN KEY ("creditNoteItemId") REFERENCES "CreditNoteItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteLineTax_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for CreditNoteLineTax
CREATE INDEX IF NOT EXISTS "CreditNoteLineTax_creditNoteItemId_idx" ON "CreditNoteLineTax"("creditNoteItemId");

-- Create CreditNoteTaxSummary table
CREATE TABLE IF NOT EXISTS "CreditNoteTaxSummary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditNoteId" TEXT NOT NULL,
  "taxRateId" TEXT NOT NULL,
  "taxableAmount" DOUBLE PRECISION NOT NULL,
  "taxAmount" DOUBLE PRECISION NOT NULL,
  "taxPercentage" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteTaxSummary_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteTaxSummary_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for CreditNoteTaxSummary
CREATE INDEX IF NOT EXISTS "CreditNoteTaxSummary_creditNoteId_idx" ON "CreditNoteTaxSummary"("creditNoteId");

-- Create CreditNoteTransmission table
CREATE TABLE IF NOT EXISTS "CreditNoteTransmission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditNoteId" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "alegraId" TEXT,
  "response" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditNoteTransmission_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create CreditNoteEvent table
CREATE TABLE IF NOT EXISTS "CreditNoteEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transmissionId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "message" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteEvent_transmissionId_fkey" FOREIGN KEY ("transmissionId") REFERENCES "CreditNoteTransmission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for CreditNoteEvent
CREATE INDEX IF NOT EXISTS "CreditNoteEvent_transmissionId_idx" ON "CreditNoteEvent"("transmissionId");
CREATE INDEX IF NOT EXISTS "CreditNoteEvent_createdAt_idx" ON "CreditNoteEvent"("createdAt");

-- Migration complete
SELECT 'Credit Notes tables created successfully' AS status;
