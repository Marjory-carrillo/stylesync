-- ===============================================================
-- REFUERZO DE SEGURIDAD (V2): LIMPIEZA Y PREVENCIÓN DE DOBLE RESERVA
-- ===============================================================

-- 1. LIMPIEZA: Identificar y "cancelar" citas duplicadas existentes
-- Esto es necesario porque el error 23505 dice que ya tienes duplicados.
-- Vamos a mantener la cita más antigua (la "original") y marcar las demás como canceladas.

UPDATE appointments
SET status = 'cancelada'
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY tenant_id, stylist_id, date, time 
                   ORDER BY created_at ASC
               ) as row_num
        FROM appointments
        WHERE status = 'confirmada'
    ) sub
    WHERE row_num > 1
);

-- 2. Crear el índice único de seguridad
-- Ahora que ya no hay duplicados 'confirmada', el índice se creará sin errores.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prevent_double_booking 
ON appointments (tenant_id, stylist_id, date, time) 
WHERE (status = 'confirmada');

-- 3. Función Atómica de Reserva Segura (create_appointment_v3)
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

  -- B. Comprobar conflictos (con lógica de solapamiento)
  SELECT EXISTS (
    SELECT 1 FROM appointments 
    WHERE tenant_id = p_tenant_id 
      AND stylist_id = p_stylist_id 
      AND date = p_date 
      AND status = 'confirmada'
      AND (
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
  RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
