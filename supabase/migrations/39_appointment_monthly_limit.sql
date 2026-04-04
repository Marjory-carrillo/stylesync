-- Migration 39: Monthly appointment limit for Free plan
-- Patches create_appointment_v3 to reject new bookings when Free plan exceeds 30/month

CREATE OR REPLACE FUNCTION create_appointment_v3(
    p_tenant_id       uuid,
    p_client_name     text,
    p_client_phone    text,
    p_service_id      uuid,
    p_stylist_id      uuid,
    p_date            date,
    p_time            time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot_count        int;
    v_service           record;
    v_duration_minutes  int;
    v_end_time          time;
    v_new_id            uuid;
    v_tenant_plan       text;
    v_monthly_count     int;
    v_trial_ends_at     timestamptz;
BEGIN
    -- ── 1. Plan & trial check ────────────────────────────────────
    SELECT plan, trial_ends_at
    INTO v_tenant_plan, v_trial_ends_at
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

    v_duration_minutes := COALESCE(v_service.duration_minutes, 60);
    v_end_time := (p_time::interval + (v_duration_minutes || ' minutes')::interval)::time;

    -- ── 3. Conflict check ────────────────────────────────────────
    SELECT COUNT(*) INTO v_slot_count
    FROM appointments
    WHERE tenant_id   = p_tenant_id
      AND stylist_id  = p_stylist_id
      AND date        = p_date
      AND status NOT IN ('cancelada', 'completada')
      AND (
        (p_time >= time AND p_time < end_time)
        OR (v_end_time > time AND v_end_time <= end_time)
        OR (p_time <= time AND v_end_time >= end_time)
      );

    IF v_slot_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Horario no disponible');
    END IF;

    -- ── 4. Insert ────────────────────────────────────────────────
    INSERT INTO appointments (
        tenant_id, client_name, client_phone, service_id,
        stylist_id, date, time, end_time, status
    ) VALUES (
        p_tenant_id, p_client_name, p_client_phone, p_service_id,
        p_stylist_id, p_date, p_time, v_end_time, 'confirmada'
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;
