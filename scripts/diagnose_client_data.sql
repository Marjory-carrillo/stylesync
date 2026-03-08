-- ══════════════════════════════════════════════════════════════════
-- CitaLink: DIAGNÓSTICO DE DATOS AVANZADO (V2)
-- ══════════════════════════════════════════════════════════════════
-- Ejecuta esto para ver por qué no coinciden los clientes con sus citas.

-- 1. Ver longitud y caracteres de los teléfonos para detectar espacios ocultos
SELECT 
    'CLIENTES' as origen,
    phone,
    LENGTH(phone) as largo,
    QUOTE_LITERAL(phone) as literal
FROM public.clients
LIMIT 5;

SELECT 
    'CITAS' as origen,
    client_phone,
    LENGTH(client_phone) as largo,
    QUOTE_LITERAL(client_phone) as literal,
    status
FROM public.appointments
WHERE status = 'completada'
LIMIT 5;

-- 2. Probar JOIN con limpieza de caracteres (espacios, guiones, etc)
SELECT 
    c.name as cliente,
    c.phone as tel_cliente,
    a.client_phone as tel_cita,
    a.status as estado
FROM public.clients c
JOIN public.appointments a ON REGEXP_REPLACE(a.client_phone, '\D', '', 'g') = REGEXP_REPLACE(c.phone, '\D', '', 'g')
WHERE a.status = 'completada'
AND c.tenant_id = a.tenant_id;

-- 3. Ver si el tenant_id de las citas mostradas en la captura es el correcto
-- (Busca los nombres que viste en tu pantalla)
SELECT 
    client_name, 
    client_phone, 
    status, 
    tenant_id 
FROM public.appointments 
WHERE client_name IN ('MISAEL', 'CARLOS', 'JUAN')
ORDER BY created_at DESC;
