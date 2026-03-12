-- ══════════════════════════════════════════════════════════════════
-- CitaLink: INSPECCIÓN PROFUNDA DE CITAS Y SERVICIOS
-- ══════════════════════════════════════════════════════════════════

-- 1. Ver qué estados existen realmente en tus citas
-- (Para ver si dice 'completada', 'Completada', 'Atendido', etc.)
SELECT status, COUNT(*) 
FROM public.appointments 
WHERE tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
GROUP BY status;

-- 2. Ver una muestra de tus citas para ver los nombres y teléfonos "en bruto"
SELECT 
    client_name, 
    client_phone, 
    status, 
    service_id,
    tenant_id
FROM public.appointments 
WHERE tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
ORDER BY id DESC
LIMIT 10;

-- 3. Ver qué servicios tienes registrados
SELECT id, name, price 
FROM public.services 
WHERE tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e';

-- 4. Prueba de cruce directo (Sin la vista, sólo para probar)
-- Si este query te da resultados > 0, entonces arreglaremos la vista.
SELECT 
    a.client_name,
    COUNT(*) as total
FROM public.appointments a
WHERE a.tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
  AND (LOWER(a.status) = 'completada' OR LOWER(a.status) = 'confirmada')
GROUP BY a.client_name;
