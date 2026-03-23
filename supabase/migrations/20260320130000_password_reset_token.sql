-- Tabla maestra (public) para enlaces de "olvidé mi contraseña" (usuarios viven en tenant_*).
CREATE TABLE IF NOT EXISTS public."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
    ON public."PasswordResetToken" ("tokenHash");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_tenantId_userId_idx"
    ON public."PasswordResetToken" ("tenantId", "userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PasswordResetToken_tenantId_fkey'
    ) THEN
        ALTER TABLE public."PasswordResetToken"
            ADD CONSTRAINT "PasswordResetToken_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
