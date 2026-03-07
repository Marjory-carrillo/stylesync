-- ══════════════════════════════════════════════════════════════════
-- CitaLink: MIGRACIÓN DE SEGURIDAD (FASE 1.1)
-- Habilita RLS y aislamiento por Tenant de forma segura y performante.
-- ══════════════════════════════════════════════════════════════════

-- 1. Asegurar tabla de relación (ya existe como tenant_users, solo validamos estructura)
-- ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Función de ayuda para evitar recursos en RLS (Security Definer)
-- Esto permite que el RLS verifique permisos sin entrar en bucles infinitos.
CREATE OR REPLACE FUNCTION public.get_user_tenants()
RETURNS TABLE (tenant_id uuid) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
$$;

-- 3. Crear tablas faltantes (especialmente clients que introdujimos después) y habilitar RLS en todas
CREATE TABLE IF NOT EXISTS clients (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    notes       TEXT,
    tags        TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, phone)
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de aislamiento por TENANT

-- A. Tenants (Solo dueños o miembros autorizados)
DROP POLICY IF EXISTS "Aislamiento de Negocio" ON tenants;
CREATE POLICY "Aislamiento de Negocio" ON tenants
FOR ALL USING (
    owner_id = auth.uid() 
    OR id IN (SELECT get_user_tenants())
);

-- B. Servicios (Solo usuarios del tenant)
DROP POLICY IF EXISTS "Servicios por Tenant" ON services;
CREATE POLICY "Servicios por Tenant" ON services
FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

-- C. Personal/Stylists
DROP POLICY IF EXISTS "Personal por Tenant" ON stylists;
CREATE POLICY "Personal por Tenant" ON stylists
FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

-- D. Citas (Appointments)
DROP POLICY IF EXISTS "Citas por Tenant" ON appointments;
CREATE POLICY "Citas por Tenant" ON appointments
FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

-- E. Horarios (Schedule Config)
DROP POLICY IF EXISTS "Horarios por Tenant" ON schedule_config;
CREATE POLICY "Horarios por Tenant" ON schedule_config
FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

-- F. Otros (Bloqueos, Avisos, Lista de Espera, Clientes)
DROP POLICY IF EXISTS "Bloqueos por Tenant" ON blocked_slots;
CREATE POLICY "Bloqueos por Tenant" ON blocked_slots FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

DROP POLICY IF EXISTS "Avisos por Tenant" ON announcements;
CREATE POLICY "Avisos por Tenant" ON announcements FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

DROP POLICY IF EXISTS "Lista de Espera por Tenant" ON waiting_list;
CREATE POLICY "Lista de Espera por Tenant" ON waiting_list FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

DROP POLICY IF EXISTS "Clientes por Tenant" ON clients;
CREATE POLICY "Clientes por Tenant" ON clients FOR ALL USING (tenant_id IN (SELECT get_user_tenants()));

-- G. Políticas para Acceso Público (PWA - Reservas de clientes)
-- IMPORTANTE: Los clientes finales NO están autenticados como auth.users muchas veces.
-- Si el flujo es totalmente anónimo para reservas, necesitamos permitir SELECT en tablas clave basado en el tenant_id.
-- Pero para seguridad interna, las de arriba cubren el panel de administración.

-- Si permitimos reservas anónimas:
-- CREATE POLICY "Lectura pública de servicios" ON services FOR SELECT TO anon USING (true);
-- CREATE POLICY "Lectura pública de personal" ON stylists FOR SELECT TO anon USING (true);
-- ... (Podemos restringir esto por tenant_id si pasamos el ID en la URL de reserva)

-- 5. Revocar permisos innecesarios
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT ON appointments TO anon; -- Solo para crear citas
GRANT SELECT ON services TO anon;
GRANT SELECT ON stylists TO anon;
GRANT SELECT ON tenants TO anon;
GRANT SELECT ON schedule_config TO anon;
GRANT SELECT ON announcements TO anon;
GRANT INSERT ON waiting_list TO anon;
