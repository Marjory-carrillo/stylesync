-- ══════════════════════════════════════════════════════════════════
-- CitaLink: DIAGNÓSTICO DE TELÉFONOS ESPECÍFICOS (CAPTURA)
-- ══════════════════════════════════════════════════════════════════

-- 1. Ver qué citas hay exactamente para los números de la captura
-- (Buscamos por coincidencia parcial para atrapar variaciones de longitud)
SELECT 
    client_name, 
    client_phone, 
    status, 
    date,
    tenant_id
FROM public.appointments
WHERE client_phone LIKE '%2346494864%' 
   OR client_phone LIKE '%2551548485%'
   OR client_phone LIKE '%22616416161%'
LIMIT 20;

-- 2. Ver cuántas citas 'completada' existen realmente en total para este tenant
-- (Para descartar que no se estén marcando como completadas)
SELECT status, COUNT(*) 
FROM public.appointments 
WHERE tenant_id = 'a9568f4e-0181-4471-9df9-92a98d80831e'
GROUP BY status;

-- 3. Ver cómo están guardados esos clientes en la tabla 'clients'
SELECT name, phone, tenant_id 
FROM public.clients 
WHERE phone LIKE '%2346494864%' 
   OR phone LIKE '%2551548485%'
   OR phone LIKE '%22616416161%';
