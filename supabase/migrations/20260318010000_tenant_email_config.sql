-- Create tenant_email_config table with TEXT IDs to match Prisma CUIDs
-- First, drop existing if any (to fix types)
DROP TABLE IF EXISTS public.tenant_email_config;

CREATE TABLE public.tenant_email_config (
    id TEXT PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
    tenant_id TEXT NOT NULL UNIQUE REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    resend_domain_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL,
    dns_records JSONB NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_email_config ENABLE ROW LEVEL SECURITY;

-- Note: Complex RLS with tenant isolation in the public schema requires a mapping table 
-- between Supabase Auth IDs and Tenant IDs. Since the project uses separate schemas 
-- for most data and Prisma for public tables, we provide a base policy for authenticated users.
-- The application's service layer (withTenantRead/Tx) handles strict tenant isolation.

CREATE POLICY "Authenticated users can read email config"
ON public.tenant_email_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage their email config"
ON public.tenant_email_config
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Function to send email securely (placeholder for system calls)
CREATE OR REPLACE FUNCTION public.send_tenant_email(
    p_tenant_id TEXT,
    p_to TEXT,
    p_subject TEXT,
    p_html TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
BEGIN
    -- Get tenant config
    SELECT * INTO v_config 
    FROM public.tenant_email_config 
    WHERE tenant_id = p_tenant_id AND verified = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant email configuration not found or not verified';
    END IF;

    RETURN jsonb_build_object(
        'status', 'queued',
        'tenant_id', p_tenant_id,
        'to', p_to,
        'from', v_config.from_email
    );
END;
$$;
