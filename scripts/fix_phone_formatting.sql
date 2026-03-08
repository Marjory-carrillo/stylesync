-- ══════════════════════════════════════════════════════════════════
-- CitaLink: ESTANDARIZACIÓN DE TELÉFONOS (SOLO MÉXICO - 10 DÍGITOS)
-- ══════════════════════════════════════════════════════════════════
-- Objetivo: Normalizar todos los teléfonos a +52XXXXXXXXXX

-- 1. Limpiar tabla de Clientes
UPDATE public.clients
SET phone = '+52' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10)
WHERE phone IS NOT NULL;

-- 2. Limpiar tabla de Citas
UPDATE public.appointments
SET client_phone = '+52' || RIGHT(REGEXP_REPLACE(client_phone, '\D', '', 'g'), 10)
WHERE client_phone IS NOT NULL;

-- 3. Limpiar tabla de Miembros del Equipo (opcional pero recomendado)
UPDATE public.stylists
SET phone = '+52' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10)
WHERE phone IS NOT NULL AND phone <> '';

-- 4. Refrescar la vista de resúmenes (CASCADE asegura que se apliquen los cambios)
-- Nota: La vista utiliza joins por teléfono, ahora que están normalizados, coincidirán.
SELECT 'Estandarización completada' as resultado;
