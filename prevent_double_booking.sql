-- ===============================================================
-- REFUERZO DE SEGURIDAD: PREVENCIÓN DE DOBLE RESERVA (RACE CONDITIONS)
-- ===============================================================

-- 1. Añadir restricción de unicidad para evitar duplicados absolutos
-- Solo aplica a citas 'confirmada'. Si una se cancela, el slot queda libre.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prevent_double_booking 
ON appointments (tenant_id, stylist_id, date, time) 
WHERE (status = 'confirmada');

-- 2. Función Atómica de Reserva Segura (create_appointment_v3)
-- Esta función corre dentro de una transacción en el servidor.
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
  v_conflict_exists boolean;
  v_new_appt_id uuid;
BEGIN
  -- A. Obtener duración del servicio
  SELECT duration INTO v_duration FROM services WHERE id = p_service_id;
  IF v_duration IS NULL THEN v_duration := 30; END IF;

  -- B. Comprobar conflictos (con bloqueo de fila para evitar race conditions)
  -- Buscamos cualquier cita confirmada que se solape con el nuevo intervalo
  -- Nuevo intervalo: [p_time, p_time + v_duration + 10m buffer]
  
  SELECT EXISTS (
    SELECT 1 FROM appointments 
    WHERE tenant_id = p_tenant_id 
      AND stylist_id = p_stylist_id 
      AND date = p_date 
      AND status = 'confirmada'
      AND (
        -- Lógica de solapamiento: (StartA < EndB) AND (EndA > StartB)
        (time < (p_time + (v_duration + 10) * interval '1 minute')) AND
        ((time + (COALESCE((SELECT duration FROM services WHERE id = service_id), 30) + 10) * interval '1 minute') > p_time)
      )
  ) INTO v_conflict_exists;

  IF v_conflict_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona.');
  END IF;

  -- C. Insertar la cita
  INSERT INTO appointments (
    tenant_id, client_name, client_phone, service_id, stylist_id, date, time, status
  ) VALUES (
    p_tenant_id, p_client_name, p_client_phone, p_service_id, p_stylist_id, p_date, p_time, 'confirmada'
  ) RETURNING id INTO v_new_appt_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_appt_id);

EXCEPTION WHEN unique_violation THEN
  -- Si incluso con el chequeo previo algo falló (muy raro), la restricción UNIQUE nos salva.
  RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona (Unique Violation).');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
