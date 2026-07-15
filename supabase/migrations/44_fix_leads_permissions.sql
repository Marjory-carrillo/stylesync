-- 1. Otorgar todos los permisos a los roles necesarios
GRANT ALL ON TABLE public.leads TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.global_configs TO postgres, service_role, authenticated, anon;

-- 2. Limpiar cualquier política vieja o en conflicto de la tabla leads
DROP POLICY IF EXISTS "Acceso a Leads" ON public.leads;
DROP POLICY IF EXISTS "Super admin reads leads" ON public.leads;
DROP POLICY IF EXISTS "Super admin manage leads" ON public.leads;
DROP POLICY IF EXISTS "Permitir lectura para admins" ON public.leads;
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;

-- 3. Crear las políticas limpias y unificadas
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admin manage leads" ON public.leads FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
