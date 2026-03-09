-- ══════════════════════════════════════════════════════════════════
-- CitaLink: INSPECCIÓN DE VISTA CLIENT_SUMMARIES
-- ══════════════════════════════════════════════════════════════════

-- 1. Ver qué devuelve la vista directamente para tus clientes
SELECT 
    name, 
    phone, 
    total_visits, 
    total_spent, 
    main_service, 
    tenant_id 
FROM public.client_summaries 
WHERE total_visits > 0
LIMIT 5;

-- 2. Si lo anterior sale vacío, ver por qué el JOIN de la vista podría fallar
-- (Citas vs Clientes después de la limpieza)
SELECT 
    c.name as nombre_cliente,
    c.phone as tel_cliente,
    a.client_phone as tel_cita,
    a.status as estado_cita,
    c.tenant_id as t_cliente,
    a.tenant_id as t_cita
FROM public.clients c
JOIN public.appointments a ON c.phone = a.client_phone
WHERE a.status = 'completada'
LIMIT 10;

-- 3. Verificar si los servicios tienen precio (si el precio es 0, total_spent será 0)
SELECT name, price FROM public.services LIMIT 5;
