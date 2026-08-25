-- Migration 49: Self-serve onboarding support and tenant flags
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS enable_nail_calculator BOOLEAN DEFAULT true;

-- Ensure nail_calculator_config table exists and has proper permissions
CREATE TABLE IF NOT EXISTS public.nail_calculator_config (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_nail_calculator_config_tenant ON public.nail_calculator_config(tenant_id);

-- Enable RLS
ALTER TABLE public.nail_calculator_config ENABLE ROW LEVEL SECURITY;

-- Policies for nail_calculator_config
DROP POLICY IF EXISTS "Public can view nail calculator config" ON public.nail_calculator_config;
CREATE POLICY "Public can view nail calculator config" ON public.nail_calculator_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant users can manage nail calculator config" ON public.nail_calculator_config;
CREATE POLICY "Tenant users can manage nail calculator config" ON public.nail_calculator_config
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        ) OR public.is_super_admin()
    ) WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        ) OR public.is_super_admin()
    );
