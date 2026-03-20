-- Alinea tablas de facturación en cada schema tenant_* con Prisma (Invoice / CreditNote → Alegra).
-- Los tenants usan esquemas `tenant_<id>` (ver lib/tenant-utils.ts getSchemaName).
-- Idempotente: IF NOT EXISTS en columnas e índices.

DO $$
DECLARE
  sch text;
BEGIN
  FOR sch IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'tenant\_%' ESCAPE '\'
  LOOP
    -- Invoice (POS, restaurante, etc.)
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = sch
        AND table_name = 'Invoice'
    ) THEN
      EXECUTE format(
        $sql$
        ALTER TABLE %I."Invoice"
          ADD COLUMN IF NOT EXISTS "alegraId" TEXT,
          ADD COLUMN IF NOT EXISTS "alegraNumber" TEXT,
          ADD COLUMN IF NOT EXISTS "alegraStatus" TEXT DEFAULT 'DRAFT',
          ADD COLUMN IF NOT EXISTS "alegraUrl" TEXT;
        $sql$,
        sch
      );
      EXECUTE format(
        $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_alegraId_key"
        ON %I."Invoice" ("alegraId");
        $sql$,
        sch
      );
    END IF;

    -- Notas crédito
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = sch
        AND table_name = 'CreditNote'
    ) THEN
      EXECUTE format(
        $sql$
        ALTER TABLE %I."CreditNote"
          ADD COLUMN IF NOT EXISTS "alegraId" TEXT,
          ADD COLUMN IF NOT EXISTS "alegraNumber" TEXT,
          ADD COLUMN IF NOT EXISTS "alegraStatus" TEXT DEFAULT 'DRAFT',
          ADD COLUMN IF NOT EXISTS "alegraUrl" TEXT;
        $sql$,
        sch
      );
      EXECUTE format(
        $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_alegraId_key"
        ON %I."CreditNote" ("alegraId");
        $sql$,
        sch
      );
    END IF;
  END LOOP;
END $$;
