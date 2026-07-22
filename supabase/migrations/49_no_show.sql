-- Migration 49: Add no_show functionality

-- 1. Add no_show to appointments status constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('confirmada', 'cancelada', 'completada', 'no_show'));

-- 2. Add no_show_count to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;

-- 3. Add no_show_whatsapp_sent to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_whatsapp_sent BOOLEAN NOT NULL DEFAULT false;

-- 4. Recreate client_summaries view to include no_show_count
DROP VIEW IF EXISTS client_summaries;
CREATE VIEW client_summaries AS
SELECT 
    c.id,
    c.tenant_id,
    c.name,
    c.phone,
    c.notes,
    c.tags,
    c.created_at,
    c.no_show_count,
    COUNT(a.id) FILTER (WHERE a.status = 'completada') AS total_visits,
    COALESCE(SUM(s.price) FILTER (WHERE a.status = 'completada'), 0) AS total_spent,
    MAX(a.date) FILTER (WHERE a.status = 'completada') AS last_visit,
    (
        SELECT s2.name
        FROM appointments a2
        JOIN services s2 ON a2.service_id = s2.id
        WHERE a2.client_phone = c.phone 
          AND a2.tenant_id = c.tenant_id
          AND a2.status = 'completada'
        GROUP BY s2.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) AS main_service
FROM clients c
LEFT JOIN appointments a ON c.phone = a.client_phone AND c.tenant_id = a.tenant_id
LEFT JOIN services s ON a.service_id = s.id
GROUP BY c.id, c.tenant_id, c.name, c.phone, c.notes, c.tags, c.created_at, c.no_show_count;

-- 5. Create mark_no_show RPC function
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
