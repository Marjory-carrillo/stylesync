-- ============================================================
-- RPC: reschedule_appointment_v1
-- Allows a client to reschedule their own appointment using
-- the appointment ID + their phone number as verification.
-- Called from the public /reagendar/:id page.
-- ============================================================

CREATE OR REPLACE FUNCTION reschedule_appointment_v1(
    p_appointment_id  UUID,
    p_client_phone    TEXT,         -- last 10 digits, no country code
    p_new_date        DATE,
    p_new_time        TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt          RECORD;
    v_service       RECORD;
    v_duration      INT;
    v_conflict_id   UUID;
    v_appt_end      TIME;
BEGIN
    -- 1. Fetch the appointment
    SELECT * INTO v_appt
    FROM appointments
    WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cita no encontrada');
    END IF;

    -- 2. Verify phone (compare last 10 digits)
    IF RIGHT(REGEXP_REPLACE(v_appt.client_phone, '[^0-9]', '', 'g'), 10) <> RIGHT(REGEXP_REPLACE(p_client_phone, '[^0-9]', '', 'g'), 10) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Número de teléfono incorrecto');
    END IF;

    -- 3. Validate appointment is still active
    IF v_appt.status IN ('cancelada', 'completada') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta cita no puede ser modificada (status: ' || v_appt.status || ')');
    END IF;

    -- 4. Get service duration
    SELECT duration INTO v_duration
    FROM services
    WHERE id = v_appt.service_id;

    v_duration := COALESCE(v_duration, 30);
    v_appt_end := (p_new_time::TEXT::INTERVAL + (v_duration || ' minutes')::INTERVAL)::TIME;

    -- 5. Check for conflicts on the new slot (same tenant + same stylist, excluding this appt)
    SELECT id INTO v_conflict_id
    FROM appointments
    WHERE tenant_id   = v_appt.tenant_id
      AND id          <> p_appointment_id
      AND date        = p_new_date
      AND status      NOT IN ('cancelada')
      AND (v_appt.stylist_id IS NULL OR stylist_id = v_appt.stylist_id)
      -- Overlap: existing [time, time+duration] overlaps [p_new_time, v_appt_end]
      AND time < v_appt_end
      AND (
            (SELECT duration FROM services WHERE id = appointments.service_id LIMIT 1)
            IS NOT NULL
            AND time + ((SELECT duration FROM services WHERE id = appointments.service_id LIMIT 1) || ' minutes')::INTERVAL::TIME > p_new_time
          )
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El horario seleccionado ya está ocupado. Elige otro.');
    END IF;

    -- 6. Update the appointment
    UPDATE appointments
    SET
        date          = p_new_date,
        time          = p_new_time,
        reminder_sent = false,   -- Reset so a new reminder is sent
        updated_at    = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success',   true,
        'id',        p_appointment_id,
        'new_date',  p_new_date,
        'new_time',  p_new_time
    );
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION reschedule_appointment_v1(UUID, TEXT, DATE, TIME) TO anon, authenticated;
