-- ================================================================
-- FIX: Recrear vista client_summaries correctamente
-- Error: cannot change name of view column → hay que DROP primero
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- 1. Eliminar la vista vieja para poder recrearla con columnas correctas
DROP VIEW IF EXISTS client_summaries CASCADE;

-- 2. Recrear la vista con las columnas correctas
CREATE VIEW client_summaries AS
SELECT
    c.id,
    c.tenant_id,
    c.name,
    c.phone,
    c.notes,
    c.tags,
    c.created_at,

    -- Total de visitas completadas
    COUNT(a.id) FILTER (WHERE a.status = 'completada') AS total_visits,

    -- Total gastado (suma de precios de servicios de citas completadas)
    COALESCE(SUM(s.price) FILTER (WHERE a.status = 'completada'), 0) AS total_spent,

    -- Fecha de la última visita completada
    MAX(a.date) FILTER (WHERE a.status = 'completada') AS last_visit,

    -- Servicio más frecuente
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
LEFT JOIN appointments a 
    ON a.client_phone = c.phone 
    AND a.tenant_id = c.tenant_id
LEFT JOIN services s 
    ON a.service_id = s.id
GROUP BY c.id, c.tenant_id, c.name, c.phone, c.notes, c.tags, c.created_at;

-- 3. Permisos
GRANT SELECT ON client_summaries TO authenticated;
GRANT SELECT ON client_summaries TO anon;

-- 4. Verificar resultado
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'client_summaries' 
ORDER BY ordinal_position;
