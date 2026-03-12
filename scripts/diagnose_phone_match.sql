-- ══════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO FINAL: ¿Por qué total_visits = 0?
-- EJECUTA CADA BLOQUE POR SEPARADO y mándame el resultado
-- ══════════════════════════════════════════════════════════════════

-- BLOQUE A: Ver los teléfonos que SÍ tienen citas completadas
-- (Estos son los que DEBERÍAN tener total_visits > 0)
SELECT 
    client_name,
    client_phone,
    RIGHT(REGEXP_REPLACE(client_phone, '[^0-9]', '', 'g'), 10) AS phone_normalized,
    COUNT(*) AS citas_completadas
FROM public.appointments
WHERE status = 'completada'
  AND tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
GROUP BY client_name, client_phone
ORDER BY citas_completadas DESC;

-- ══════════════════════════════════════════════════════════════════

-- BLOQUE B: Ver los teléfonos normalizados de los CLIENTES de tu negocio
SELECT 
    name,
    phone,
    RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS phone_normalized
FROM public.clients
WHERE tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
ORDER BY name;

-- ══════════════════════════════════════════════════════════════════

-- BLOQUE C: Cruzar directamente (esto debería dar > 0 si hay coincidencias)
SELECT 
    c.name,
    c.phone as cliente_phone,
    a.client_phone as cita_phone,
    COUNT(*) as visitas
FROM public.clients c
JOIN public.appointments a 
    ON RIGHT(REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g'), 10) 
     = RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10)
   AND a.tenant_id = c.tenant_id
WHERE a.status = 'completada'
  AND c.tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
GROUP BY c.name, c.phone, a.client_phone
ORDER BY visitas DESC;
