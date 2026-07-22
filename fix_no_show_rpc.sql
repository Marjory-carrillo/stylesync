-- 1. Eliminar la función vieja con firma obsoleta (uuid, text)
DROP FUNCTION IF EXISTS mark_no_show(uuid, text);

-- 2. Crear la función corregida con firma (uuid, uuid) para evitar el error "operator does not exist: uuid = text"
CREATE OR REPLACE FUNCTION mark_no_show(p_appointment_id uuid, p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt record;
BEGIN
    -- 1. Obtener la cita y verificar que pertenezca al tenant
    SELECT * INTO v_appt
    FROM appointments
    WHERE id = p_appointment_id AND tenant_id = p_tenant_id;

    IF v_appt IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cita no encontrada');
    END IF;

    IF v_appt.status = 'no_show' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La cita ya está marcada como No Asistió');
    END IF;

    -- 2. Actualizar el estado de la cita
    UPDATE appointments
    SET status = 'no_show'
    WHERE id = p_appointment_id;

    -- 3. Incrementar el contador en la tabla de clientes
    UPDATE clients
    SET no_show_count = no_show_count + 1
    WHERE phone = v_appt.client_phone AND tenant_id = p_tenant_id;

    -- 4. Bloquear el teléfono (upsert)
    INSERT INTO blocked_phones (phone, tenant_id, reason)
    VALUES (v_appt.client_phone, p_tenant_id, 'no_show')
    ON CONFLICT (phone, tenant_id) 
    DO UPDATE SET reason = 'no_show';

    RETURN jsonb_build_object('success', true);
END;
$$;
