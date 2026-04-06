-- Migration 40: Fix create_appointment_v3 function overload conflict
-- 
-- Problem: Migration 28 created the function with (bigint, bigint) params for service_id/stylist_id.
-- Migration 39 tried CREATE OR REPLACE with (uuid, uuid), but PostgreSQL treats different
-- parameter types as DIFFERENT functions (overloaded), so both versions coexist.
-- When the frontend calls with uuid values, it may match the wrong overload,
-- causing "time without time zone" or type mismatch errors.
--
-- Fix: Drop the old bigint version, then recreate with the correct uuid signature.

-- Step 1: Drop the OLD bigint-signature version (safe: the new uuid one remains)
DROP FUNCTION IF EXISTS create_appointment_v3(uuid, text, text, bigint, bigint, date, time);

-- Step 2: Drop the uuid version too, to recreate cleanly
DROP FUNCTION IF EXISTS create_appointment_v3(uuid, text, text, uuid, uuid, date, time);

-- Step 3: Recreate with correct types and all features (monthly limit + conflict check + end_time)
CREATE OR REPLACE FUNCTION create_appointment_v3(
    p_tenant_id       uuid,
    p_client_name     text,
    p_client_phone    text,
    p_service_id      bigint,
    p_stylist_id      bigint,
    p_date            date,
    p_time            time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot_count        int;
    v_service           record;
    v_duration_minutes  int;
    v_buffer            int;
    v_end_time          time;
    v_new_id            uuid;
    v_tenant_plan       text;
    v_monthly_count     int;
    v_trial_ends_at     timestamptz;
BEGIN
    -- ── 1. Plan & trial check ────────────────────────────────────
    SELECT plan, trial_ends_at, COALESCE(break_between_appointments, 0)
    INTO v_tenant_plan, v_trial_ends_at, v_buffer
    FROM tenants
    WHERE id = p_tenant_id;

    -- Only enforce limit on Free plan AND not in trial
    IF v_tenant_plan = 'free' AND (v_trial_ends_at IS NULL OR v_trial_ends_at <= now()) THEN
        SELECT COUNT(*)
        INTO v_monthly_count
        FROM appointments
        WHERE tenant_id = p_tenant_id
          AND date_trunc('month', date::timestamp) = date_trunc('month', p_date::timestamp)
          AND status != 'cancelada';

        IF v_monthly_count >= 30 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'MONTHLY_LIMIT_REACHED'
            );
        END IF;
    END IF;

    -- ── 2. Service lookup ────────────────────────────────────────
    SELECT * INTO v_service FROM services
    WHERE id = p_service_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado');
    END IF;

    v_duration_minutes := COALESCE(v_service.duration, 60);
    v_end_time := p_time + (v_duration_minutes || ' minutes')::interval;

    -- ── 3. Conflict check (with buffer) ──────────────────────────
    SELECT COUNT(*) INTO v_slot_count
    FROM appointments
    WHERE tenant_id   = p_tenant_id
      AND stylist_id  = p_stylist_id
      AND date        = p_date
      AND status NOT IN ('cancelada', 'completada')
      AND (
        -- New appointment overlaps existing
        (p_time < (time + (COALESCE((SELECT duration FROM services WHERE id = service_id), 30) + v_buffer) * interval '1 minute'))
        AND
        (v_end_time + v_buffer * interval '1 minute' > time)
      );

    IF v_slot_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Horario no disponible');
    END IF;

    -- ── 4. Insert ────────────────────────────────────────────────
    INSERT INTO appointments (
        tenant_id, client_name, client_phone, service_id,
        stylist_id, date, time, status
    ) VALUES (
        p_tenant_id, p_client_name, p_client_phone, p_service_id,
        p_stylist_id, p_date, p_time, 'confirmada'
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'id', v_new_id);

EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este horario ya ha sido reservado.');
WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
