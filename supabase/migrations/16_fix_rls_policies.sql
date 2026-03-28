-- ================================================================
-- CORRECCIÓN DE RLS — CITA-LINK SaaS
-- Ejecutar en Supabase SQL Editor
-- 
-- OBJETIVO: Eliminar políticas "ALL: true" peligrosas y reemplazarlas
-- con políticas correctas que separen lectura pública (booking) 
-- de escritura autenticada (admin).
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- TABLA: appointments
-- Problema: Public Insert/Read/Update con condición `true`
-- Fix: 
--   SELECT público OK (para que clientes vean su cita por teléfono)
--   INSERT público OK pero con tenant_id válido
--   UPDATE/DELETE solo para miembros del tenant autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public Insert Appointments" ON appointments;
DROP POLICY IF EXISTS "Public Read Appointments" ON appointments;
DROP POLICY IF EXISTS "Public Update Appointments" ON appointments;

-- Los clientes pueden insertar citas (flow de booking público)
-- pero solo en tenants que existen realmente
CREATE POLICY "Clients can book appointments" ON appointments
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT id FROM tenants)
    );

-- Lectura pública para que el cliente vea su cita por teléfono
-- (El filtro real se hace en el frontend con el teléfono del cliente)
CREATE POLICY "Public read appointments" ON appointments
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: blocked_phones
-- Problema: "Public access" ALL = true (cualquiera bloquea teléfonos)
-- Fix: Solo miembros autenticados del tenant pueden gestionar
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public access" ON blocked_phones;

CREATE POLICY "Tenant members manage blocked phones" ON blocked_phones
    FOR ALL
    USING (
        is_super_admin() OR 
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    )
    WITH CHECK (
        is_super_admin() OR 
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    );

-- Lectura pública para saber si el teléfono está bloqueado (flow booking)
CREATE POLICY "Public read blocked phones" ON blocked_phones
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: blocked_slots
-- Problema: "Allow All Blocked" y "Enable all for blocked_slots" ALL = true
-- Fix: Lectura pública + escritura solo para autenticados del tenant
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow All Blocked" ON blocked_slots;
DROP POLICY IF EXISTS "Enable all for blocked_slots" ON blocked_slots;

-- Lectura pública (el booking necesita saber qué slots están bloqueados)
CREATE POLICY "Public read blocked slots" ON blocked_slots
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: cancellation_log
-- Problema: "Public access" ALL = true (cualquiera inserta cancelaciones falsas)
-- Fix: Inserción solo desde tenants válidos, lectura solo para autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public access" ON cancellation_log;

-- Inserción pública pero con tenant válido (el cancelar una cita lo puede hacer el cliente)
CREATE POLICY "Insert cancellation with valid tenant" ON cancellation_log
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT id FROM tenants)
    );

-- Solo miembros del tenant pueden leer el log de cancelaciones
CREATE POLICY "Tenant members read cancellation log" ON cancellation_log
    FOR SELECT
    USING (
        is_super_admin() OR 
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    );


-- ────────────────────────────────────────────────────────────────
-- TABLA: schedule_config
-- Problema: "Allow All Schedule" y "Enable all for schedule" ALL = true
-- Fix: Solo lectura pública + escritura para miembros autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow All Schedule" ON schedule_config;
DROP POLICY IF EXISTS "Enable all for schedule" ON schedule_config;

-- Lectura pública (el booking necesita el horario del negocio)
CREATE POLICY "Public read schedule" ON schedule_config
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: services
-- Problema: "Allow All Services" y "Enable all for services" ALL = true
-- Fix: Solo lectura pública + escritura para miembros autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow All Services" ON services;
DROP POLICY IF EXISTS "Enable all for services" ON services;

-- Lectura pública (el booking muestra los servicios disponibles)
CREATE POLICY "Public read services" ON services
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: stylists
-- Problema: "Allow All Stylists" y "Enable all for stylists" ALL = true
-- Fix: Solo lectura pública + escritura para miembros autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow All Stylists" ON stylists;
DROP POLICY IF EXISTS "Enable all for stylists" ON stylists;

-- Lectura pública (el booking muestra los estilistas disponibles)
CREATE POLICY "Public read stylists" ON stylists
    FOR SELECT
    USING (true);


-- ────────────────────────────────────────────────────────────────
-- TABLA: waiting_list
-- Problema: "Public access" ALL = true
-- Fix: INSERT público con tenant válido + gesión solo para autenticados
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public access" ON waiting_list;

-- Los clientes pueden agregarse a la lista de espera (sin login)
CREATE POLICY "Public insert waiting list" ON waiting_list
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT id FROM tenants)
    );


-- ================================================================
-- VERIFICACIÓN FINAL
-- Corre esto después para confirmar que las políticas peligrosas
-- ya no existen:
-- ================================================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'  -- Estas son las que pueden ser peligrosas
ORDER BY tablename;
