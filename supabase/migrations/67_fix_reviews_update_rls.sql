-- ==============================================================================
-- Migración 67: Cierre de Política RLS Permisiva UPDATE en Reviews
-- CitaLink SaaS - Seguridad y Protección de Reseñas Multi-Tenant
-- ==============================================================================

-- 1. Eliminar la política anterior permisiva que permitía UPDATE a cualquiera (USING true)
DROP POLICY IF EXISTS "Allow tenant update access to reviews" ON public.reviews;

-- 2. Crear la nueva política restrictiva que solo permite actualizar (responder o editar)
--    a los usuarios autenticados que pertenezcan al negocio (tenant) o a un SuperAdmin.
CREATE POLICY "Allow tenant update access to reviews" ON public.reviews
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin());
