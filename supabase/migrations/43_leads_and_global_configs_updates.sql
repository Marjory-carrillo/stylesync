-- Migration 43: leads and global_configs updates

-- 1. Asegurar tabla global_configs y agregar superadmin_phone
CREATE TABLE IF NOT EXISTS global_configs (
    id TEXT PRIMARY KEY DEFAULT 'main',
    basic_plan_price NUMERIC DEFAULT 499.00,
    premium_plan_price NUMERIC DEFAULT 999.00,
    trial_days INTEGER DEFAULT 21,
    maintenance_mode BOOLEAN DEFAULT false,
    system_email TEXT DEFAULT 'soporte@citalink.app',
    superadmin_phone TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE global_configs ADD COLUMN IF NOT EXISTS superadmin_phone TEXT;

-- 2. Asegurar políticas RLS para global_configs
DROP POLICY IF EXISTS "Permitir lectura global_configs" ON global_configs;
CREATE POLICY "Permitir lectura global_configs" ON global_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admin manages global config" ON global_configs;
CREATE POLICY "Super admin manages global config" ON global_configs FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 3. Asegurar tabla leads y columnas adicionales
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT,
    business_type TEXT,
    employee_count TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'nuevo',
    notes TEXT,
    archived_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    converted_tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_tenant_id UUID;

-- 4. Asegurar políticas RLS para leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert leads" ON leads;
CREATE POLICY "Public insert leads" ON leads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin reads leads" ON leads;
DROP POLICY IF EXISTS "Super admin manage leads" ON leads;
CREATE POLICY "Super admin manage leads" ON leads FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
