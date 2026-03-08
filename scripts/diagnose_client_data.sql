-- ══════════════════════════════════════════════════════════════════
-- CitaLink: DIAGNÓSTICO DE DATOS DE CLIENTES
-- ══════════════════════════════════════════════════════════════════
-- Ejecuta este script en el editor SQL de Supabase para ver qué está pasando.

-- 1. Verificar si hay citas 'completada' en general
SELECT 'Total citas completadas' as metrica, COUNT(*) as valor 
FROM public.appointments 
WHERE status = 'completada'
UNION ALL
-- 2. Verificar si hay clientes registrados
SELECT 'Total clientes' as metrica, COUNT(*) as valor 
FROM public.clients
UNION ALL
-- 3. Verificar si coinciden los teléfonos (MUESTRA DE COINCIDENCIAS)
SELECT 'Coincidencias Teléfono' as metrica, COUNT(*) as valor
FROM public.clients c
JOIN public.appointments a ON a.client_phone = c.phone
WHERE a.status = 'completada';

-- 4. Ver muestra de datos para detectar diferencias de formato
SELECT 
    c.phone as telefono_cliente, 
    a.client_phone as telefono_cita,
    a.status as estado_cita,
    c.tenant_id as tenant_cliente,
    a.tenant_id as tenant_cita
FROM public.clients c
LEFT JOIN public.appointments a ON a.client_phone = c.phone
LIMIT 10;
