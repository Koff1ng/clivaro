-- 1. Create Tenant Users table (Links Auth Users to Tenancy)
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'staff', -- admin, staff
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- 2. Create Quote Email Logs table
CREATE TABLE IF NOT EXISTS public.quote_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    quote_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL, -- sent, failed
    error_message TEXT,
    sent_by UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.quote_email_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for Tenant Isolation

-- Policy: Users can only see their own tenant memberships
CREATE POLICY tenant_users_isolation ON public.tenant_users
    FOR ALL
    USING (user_id = auth.uid());

-- Policy: Users can only see/action quotes from their authorized tenants
-- Assuming 'Quotation' table has a 'tenantId' column (we should add it if missing)
-- For now, we apply it to logs and ensure quotes follow suit.

CREATE POLICY quote_email_logs_isolation ON public.quote_email_logs
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

-- 4. Storage Policies for 'quotes' bucket
-- (Run this in the Supabase Dashboard or via API)
-- CREATE BUCKET quotes;

-- Policy: Access isolated by tenant_id in the path /quotes/{tenant_id}/{quote_id}.pdf
-- (Simplified version for SQL migration)
/*
CREATE POLICY "Isolated Storage Access" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'quotes' 
        AND (storage.foldername(name))[1] IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );
*/

-- 5. Helper Function to get current tenant_id for the user
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS TEXT AS $$
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
