-- ══════════════════════════════════════════════════════════════════
-- CitaLink: RLS y Permisos para el Cotizador de Uñas (nail_calculator_config)
-- EJECUTA ESTE SCRIPT en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════

-- 1. Habilitar RLS en la tabla si aún no está habilitado
ALTER TABLE public.nail_calculator_config ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar cualquier política previa para evitar duplicados
DROP POLICY IF EXISTS "Aislamiento de Cotizador para Miembros" ON public.nail_calculator_config;
DROP POLICY IF EXISTS "Lectura pública del Cotizador" ON public.nail_calculator_config;

-- 3. Crear política de control total para dueños/colaboradores del negocio (tenant)
CREATE POLICY "Aislamiento de Cotizador para Miembros"
ON public.nail_calculator_config
FOR ALL
USING (
    tenant_id IN (SELECT get_user_tenants())
)
WITH CHECK (
    tenant_id IN (SELECT get_user_tenants())
);

-- 4. Crear política de lectura pública (SELECT) para las reservas de las clientas (anónimos/autenticados)
CREATE POLICY "Lectura pública del Cotizador"
ON public.nail_calculator_config
FOR SELECT
USING (true);

-- 5. Otorgar permisos a nivel de base de datos para roles de Supabase
GRANT SELECT ON public.nail_calculator_config TO anon;
GRANT ALL ON public.nail_calculator_config TO authenticated;
GRANT ALL ON public.nail_calculator_config TO service_role;
