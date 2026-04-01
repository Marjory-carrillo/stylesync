-- =============================================
-- Migration 24: Fix auto-complete timezone — Per-Tenant Timezone
-- =============================================
-- Each tenant stores its own timezone so the auto-complete
-- function works correctly regardless of location.
-- Supports multi-state Mexico and international businesses.

-- 1. Add timezone column to tenants (default: Mexico City)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- 2. Replace auto_complete function to use per-tenant timezone
CREATE OR REPLACE FUNCTION auto_complete_past_appointments()
RETURNS integer AS $$
DECLARE
    v_updated integer := 0;
    v_tenant RECORD;
    v_count integer;
BEGIN
    -- Loop through each tenant with their own timezone
    FOR v_tenant IN SELECT id, timezone FROM tenants LOOP
        UPDATE appointments
        SET status = 'completada'
        WHERE status = 'confirmada'
          AND tenant_id = v_tenant.id
          AND (
              -- Citas de días anteriores (fecha local del tenant)
              date < (NOW() AT TIME ZONE v_tenant.timezone)::date
              OR
              -- Citas de hoy cuyo horario de fin ya pasó (hora local del tenant)
              (
                date = (NOW() AT TIME ZONE v_tenant.timezone)::date
                AND (time + (
                    COALESCE(
                        (SELECT duration FROM services WHERE id = appointments.service_id),
                        30
                    ) * interval '1 minute'
                )) < (NOW() AT TIME ZONE v_tenant.timezone)::time
              )
          );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_updated := v_updated + v_count;
    END LOOP;
    
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
