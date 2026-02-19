-- ===============================================================
-- FIX: TYPE MISMATCH & REFINED ATOMIC BOOKING (V4)
-- ===============================================================

-- 1. Ensure column types are correct across all relevant tables
-- We use USING clause for safe conversion from text to date/time

-- Table: Appointments
ALTER TABLE public.appointments 
  ALTER COLUMN date TYPE date USING (date::date),
  ALTER COLUMN time TYPE time USING (time::time);

-- Table: Blocked Slots
ALTER TABLE public.blocked_slots 
  ALTER COLUMN date TYPE date USING (date::date),
  ALTER COLUMN start_time TYPE time USING (start_time::time),
  ALTER COLUMN end_time TYPE time USING (end_time::time);

-- Table: Waiting List
ALTER TABLE public.waiting_list 
  ALTER COLUMN date TYPE date USING (date::date);

-- Table: Cancellation Log
ALTER TABLE public.cancellation_log 
  ALTER COLUMN date TYPE date USING (date::date),
  ALTER COLUMN time TYPE time USING (time::time);

-- 2. Refine create_appointment_v3 with explicit types and better error handling
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
  -- A. Get service duration (safety check)
  SELECT duration INTO v_duration FROM services WHERE id = p_service_id;
  IF v_duration IS NULL THEN v_duration := 30; END IF;

  -- B. Check for conflicts with explicit type handling
  SELECT EXISTS (
    SELECT 1 FROM appointments 
    WHERE tenant_id = p_tenant_id 
      AND stylist_id = p_stylist_id 
      AND (date::date) = p_date 
      AND status = 'confirmada'
      AND (
        (time < (p_time + (v_duration + 10) * interval '1 minute')) AND
        ((time + (COALESCE((SELECT duration FROM services WHERE id = service_id), 30) + 10) * interval '1 minute') > p_time)
      )
  ) INTO v_conflict_exists;

  IF v_conflict_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lo sentimos, este horario ya ha sido reservado por otra persona.');
  END IF;

  -- C. Insert the appointment
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

-- 3. Re-ensure the unique index is correct for the new types
DROP INDEX IF EXISTS idx_prevent_double_booking;
CREATE UNIQUE INDEX idx_prevent_double_booking 
ON appointments (tenant_id, stylist_id, date, time) 
WHERE (status = 'confirmada');
