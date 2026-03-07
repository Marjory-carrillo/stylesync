-- ══════════════════════════════════════════════════════════════════
-- CitaLink: CORRECCIÓN DE RLS PARA SUPER ADMIN
-- Permite que los usuarios con is_super_admin = true operen en todo el sistema.
-- ══════════════════════════════════════════════════════════════════

-- 1. Función persistente para verificar si el usuario actual es Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Actualizar políticas de TENANTS
DROP POLICY IF EXISTS "Aislamiento de Negocio" ON tenants;
CREATE POLICY "Aislamiento de Negocio" ON tenants
FOR ALL USING (
    is_super_admin()
    OR owner_id = auth.uid() 
    OR id IN (SELECT get_user_tenants())
);

-- 3. Actualizar políticas de SERVICIOS
DROP POLICY IF EXISTS "Servicios por Tenant" ON services;
CREATE POLICY "Servicios por Tenant" ON services
FOR ALL USING (
    is_super_admin()
    OR tenant_id IN (SELECT get_user_tenants())
);

-- 4. Actualizar políticas de PERSONAL
DROP POLICY IF EXISTS "Personal por Tenant" ON stylists;
CREATE POLICY "Personal por Tenant" ON stylists
FOR ALL USING (
    is_super_admin()
    OR tenant_id IN (SELECT get_user_tenants())
);

-- 5. Actualizar políticas de CITAS
DROP POLICY IF EXISTS "Citas por Tenant" ON appointments;
CREATE POLICY "Citas por Tenant" ON appointments
FOR ALL USING (
    is_super_admin()
    OR tenant_id IN (SELECT get_user_tenants())
);

-- 6. Actualizar políticas de HORARIOS
DROP POLICY IF EXISTS "Horarios por Tenant" ON schedule_config;
CREATE POLICY "Horarios por Tenant" ON schedule_config
FOR ALL USING (
    is_super_admin()
    OR tenant_id IN (SELECT get_user_tenants())
);

-- 7. Actualizar políticas de CLIENTES
DROP POLICY IF EXISTS "Clientes por Tenant" ON clients;
CREATE POLICY "Clientes por Tenant" ON clients
FOR ALL USING (
    is_super_admin()
    OR tenant_id IN (SELECT get_user_tenants())
);

-- 8. Otros (Bloqueos, Avisos, etc - Aplicar patrón general)
DROP POLICY IF EXISTS "Bloqueos por Tenant" ON blocked_slots;
CREATE POLICY "Bloqueos por Tenant" ON blocked_slots FOR ALL USING (is_super_admin() OR tenant_id IN (SELECT get_user_tenants()));

DROP POLICY IF EXISTS "Avisos por Tenant" ON announcements;
CREATE POLICY "Avisos por Tenant" ON announcements FOR ALL USING (is_super_admin() OR tenant_id IN (SELECT get_user_tenants()));

DROP POLICY IF EXISTS "Lista de Espera por Tenant" ON waiting_list;
CREATE POLICY "Lista de Espera por Tenant" ON waiting_list FOR ALL USING (is_super_admin() OR tenant_id IN (SELECT get_user_tenants()));

-- 9. LEADS (Evitar Error 403 que pausa la carga)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso a Leads" ON leads;
CREATE POLICY "Acceso a Leads" ON leads FOR ALL USING (is_super_admin() OR tenant_id IN (SELECT get_user_tenants()));

-- 10. TENANT_USERS (Para identificación de roles)
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso a Tenant Users" ON tenant_users;
CREATE POLICY "Acceso a Tenant Users" ON tenant_users FOR ALL USING (is_super_admin() OR user_id = auth.uid());
