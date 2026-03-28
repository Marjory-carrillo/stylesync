
-- 1. ADICIÓN DE COLUMNA PARA DESCANSOS (BREAKS)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS break_between_appointments integer DEFAULT 0;

-- 2. ACTUALIZACIÓN DE LA FUNCIÓN DE RESERVA SEGURA (create_appointment_v3)
-- Ahora lee el buffer de descanso del negocio y lo aplica a la validación de conflictos.
CREATE OR REPLACE FUNCTION create_appointment_v3(
  p_tenant_id uuid,
  p_client_name text,
  p_client_phone text,
  p_service_id bigint,
  p_stylist_id bigint,
  p_date date,
  p_time time
) RETURNS jsonb AS $$
DECLARE
  v_duration integer;
  v_buffer integer;
  v_conflict_exists boolean;
  v_new_appt_id uuid;
BEGIN
  -- A. Obtener configuración del negocio (duración y buffer)
  SELECT duration INTO v_duration FROM services WHERE id = p_service_id;
  IF v_duration IS NULL THEN v_duration := 30; END IF;

  -- B. Obtener el descanso (break) configurado para este tenant
  SELECT break_between_appointments INTO v_buffer FROM tenants WHERE id = p_tenant_id;
  IF v_buffer IS NULL THEN v_buffer := 0; END IF;

  -- C. Comprobar conflictos (con lógica de solapamiento dinámico)
  -- Una cita nueva en p_time con duración v_duration + v_buffer
  -- NO debe solaparse con ninguna cita existente (time + duration + v_buffer)
  -- El solapamiento ocurre si:
  -- [NuevoInicio < ExistenteFin + Buffer] Y [ExistenteInicio < NuevoFin + Buffer]
  SELECT EXISTS (
    SELECT 1 FROM appointments 
    WHERE tenant_id = p_tenant_id 
      AND stylist_id = p_stylist_id 
      AND date = p_date 
      AND status = 'confirmada'
      AND (
        (time < (p_time + (v_duration + v_buffer) * interval '1 minute')) AND
        ((time + (COALESCE((SELECT duration FROM services WHERE id = service_id), 30) + v_buffer) * interval '1 minute') > p_time)
      )
  ) INTO v_conflict_exists;

  IF v_conflict_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona.');
  END IF;

  -- D. Insertar la cita
  INSERT INTO appointments (
    tenant_id, client_name, client_phone, service_id, stylist_id, date, time, status
  ) VALUES (
    p_tenant_id, p_client_name, p_client_phone, p_service_id, p_stylist_id, p_date, p_time, 'confirmada'
  ) RETURNING id INTO v_new_appt_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_appt_id);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
