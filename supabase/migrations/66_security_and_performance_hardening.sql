-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 66: Hardening Integral de Seguridad y Rendimiento
-- CitaLink SaaS - Registro histórico y de auditoría
-- Aplicado con éxito en Supabase Advisors (0 Performance Warnings, Advisors Seguros)
-- ══════════════════════════════════════════════════════════════════════════════

-- ==============================================================================
-- 1. RENDIMIENTO: INITPLAN CACHING EN POLÍTICAS RLS (auth_rls_initplan)
-- ==============================================================================
-- Garantiza que PostgreSQL evalúe auth.uid() una sola vez por consulta y no fila por fila.

-- 1.1 tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
FOR SELECT TO authenticated
USING (id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant owners can update their tenant" ON public.tenants;
CREATE POLICY "Tenant owners can update their tenant" ON public.tenants
FOR UPDATE TO authenticated
USING (id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

-- 1.2 appointments
DROP POLICY IF EXISTS "appointments_tenant_select" ON public.appointments;
CREATE POLICY "appointments_tenant_select" ON public.appointments
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

DROP POLICY IF EXISTS "appointments_tenant_update" ON public.appointments;
CREATE POLICY "appointments_tenant_update" ON public.appointments
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

DROP POLICY IF EXISTS "appointments_tenant_delete" ON public.appointments;
CREATE POLICY "appointments_tenant_delete" ON public.appointments
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

-- 1.3 stylists
DROP POLICY IF EXISTS "stylists_tenant_write" ON public.stylists;
CREATE POLICY "stylists_tenant_write" ON public.stylists
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

-- 1.4 services
DROP POLICY IF EXISTS "services_tenant_write" ON public.services;
CREATE POLICY "services_tenant_write" ON public.services
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

-- 1.5 clients
DROP POLICY IF EXISTS "clients_tenant_isolation" ON public.clients;
CREATE POLICY "clients_tenant_isolation" ON public.clients
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());

-- 1.6 tenant_users
DROP POLICY IF EXISTS "tenant_users_select" ON public.tenant_users;
CREATE POLICY "tenant_users_select" ON public.tenant_users
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenants())
    OR public.is_super_admin()
);

-- ==============================================================================
-- 2. RENDIMIENTO: ÍNDICES EN LLAVES FORÁNEAS (unindexed_foreign_keys)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant ON public.catalog_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_service_id ON public.catalog_items(service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_stylist_id ON public.catalog_items(stylist_id);
CREATE INDEX IF NOT EXISTS idx_quotes_appointment_id ON public.quotes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_quotes_service_id ON public.quotes(service_id);
CREATE INDEX IF NOT EXISTS idx_quotes_stylist_id ON public.quotes(stylist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_stylist_id ON public.appointments(stylist_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_service_id ON public.waiting_list(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment_id ON public.reviews(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_converted_tenant_id ON public.sales_prospects(converted_tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_tenant_id ON public.blocked_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_stylist_id ON public.tenant_users(stylist_id);
CREATE INDEX IF NOT EXISTS idx_stylists_tenant_id ON public.stylists(tenant_id);

-- ==============================================================================
-- 3. SEGURIDAD: SEARCH_PATH EXPLÍCITO EN FUNCIONES (function_search_path_mutable)
-- ==============================================================================
ALTER FUNCTION public.is_super_admin() SET search_path = public, extensions;
ALTER FUNCTION public.get_user_tenants() SET search_path = public, extensions;
ALTER FUNCTION public.get_admin_tenants() SET search_path = public, extensions;
ALTER FUNCTION public.link_invited_user() SET search_path = public, extensions;
ALTER FUNCTION public.cancel_appointment_by_client(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_appointment_v3(uuid, text, text, bigint, bigint, date, time without time zone, text[], text, numeric) SET search_path = public, extensions;
ALTER FUNCTION public.reschedule_appointment_v1(uuid, text, date, time without time zone) SET search_path = public, extensions;

-- ==============================================================================
-- 4. SEGURIDAD: AISLAMIENTO DE EXTENSIÓN PG_NET (extension_in_public)
-- ==============================================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- 5. SEGURIDAD: RETIRO DE POLÍTICAS SELECT GLOBALES EN STORAGE (public_bucket_allows_listing)
-- ==============================================================================
-- El acceso público se sirve directamente por CDN (storage.buckets.public = true).
DROP POLICY IF EXISTS "logos_read" ON storage.objects;
DROP POLICY IF EXISTS "services_read" ON storage.objects;
DROP POLICY IF EXISTS "stylists_read" ON storage.objects;

-- ==============================================================================
-- 6. SEGURIDAD: LIMPIEZA DE SOBRECARGAS OBSOLETAS
-- ==============================================================================
DROP FUNCTION IF EXISTS public.update_appointment_time_by_client(uuid, uuid, text);

-- ==============================================================================
-- 7. SEGURIDAD: VALIDACIÓN DE TENANT EN FUNCIONES SECURITY DEFINER
-- ==============================================================================

-- 7.1 clear_cancellation_log_for_tenant
CREATE OR REPLACE FUNCTION public.clear_cancellation_log_for_tenant(p_tenant_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_tenant_id::uuid NOT IN (SELECT public.get_user_tenants()) AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'No autorizado para limpiar los registros de este negocio';
    END IF;

    DELETE FROM cancellation_log WHERE tenant_id = p_tenant_id;
END;
$$;

-- 7.2 delete_cancellation_log_item
CREATE OR REPLACE FUNCTION public.delete_cancellation_log_item(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tenant_id text;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM cancellation_log WHERE id = p_id;
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    IF v_tenant_id::uuid NOT IN (SELECT public.get_user_tenants()) AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'No autorizado para eliminar este registro';
    END IF;

    DELETE FROM cancellation_log WHERE id = p_id;
END;
$$;

-- 7.3 mark_no_show
CREATE OR REPLACE FUNCTION public.mark_no_show(p_appointment_id uuid, p_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_appt record;
    v_tenant_id uuid;
BEGIN
    v_tenant_id := p_tenant_id::uuid;

    IF v_tenant_id NOT IN (SELECT public.get_user_tenants()) AND NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT * INTO v_appt
    FROM appointments
    WHERE id = p_appointment_id AND tenant_id = v_tenant_id;

    IF v_appt IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cita no encontrada');
    END IF;

    IF v_appt.status = 'no_show' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La cita ya está marcada como No Asistió');
    END IF;

    UPDATE appointments
    SET status = 'no_show'
    WHERE id = p_appointment_id;

    UPDATE clients
    SET no_show_count = no_show_count + 1
    WHERE phone = v_appt.client_phone AND tenant_id = v_tenant_id;

    INSERT INTO blocked_phones (phone, tenant_id, reason)
    VALUES (v_appt.client_phone, v_tenant_id, 'no_show')
    ON CONFLICT (phone, tenant_id) 
    DO UPDATE SET reason = 'no_show';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- 8. SEGURIDAD: VALIDACIÓN DE INTEGRIDAD EN POLÍTICAS INSERT (rls_policy_always_true)
-- ==============================================================================

-- 8.1 leads
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
CREATE POLICY "Public insert leads" ON public.leads
FOR INSERT TO public
WITH CHECK (phone IS NOT NULL AND length(trim(phone)) > 0);

-- 8.2 marketplace_searches
DROP POLICY IF EXISTS "Allow public insert to marketplace_searches" ON public.marketplace_searches;
CREATE POLICY "Allow public insert to marketplace_searches" ON public.marketplace_searches
FOR INSERT TO public
WITH CHECK (search_term IS NOT NULL AND length(trim(search_term)) > 0);

-- 8.3 reviews
DROP POLICY IF EXISTS "Allow public insert access to reviews" ON public.reviews;
CREATE POLICY "Allow public insert access to reviews" ON public.reviews
FOR INSERT TO public
WITH CHECK (rating >= 1 AND rating <= 5 AND tenant_id IS NOT NULL);

-- 8.4 sms_logs
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.sms_logs;
CREATE POLICY "Enable insert for everyone" ON public.sms_logs
FOR INSERT TO public
WITH CHECK (tenant_id IS NOT NULL OR phone_to IS NOT NULL);

-- 8.5 system_errors
DROP POLICY IF EXISTS "System errors insert public" ON public.system_errors;
CREATE POLICY "System errors insert public" ON public.system_errors
FOR INSERT TO public
WITH CHECK (error_message IS NOT NULL AND length(trim(error_message)) > 0);

-- 8.6 promotions (protegida para administradores del tenant)
DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;
CREATE POLICY "Public can view active promotions" ON public.promotions
FOR SELECT TO public
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "Tenant owners manage promotions" ON public.promotions;
CREATE POLICY "Tenant owners manage promotions" ON public.promotions
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());
