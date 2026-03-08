-- Corrección de políticas para sms_logs
-- Permite que el sistema registre logs sin importar el RLS (aunque usaremos service_role)
-- Y asegura que el Super Admin tenga visibilidad total.

-- 1. Permitir inserción anónima (para la API de Vercel si usa ANON_KEY)
-- Aunque se recomienda usar SERVICE_ROLE_KEY, esto añade una capa de redundancia.
CREATE POLICY "Enable insert for everyone" 
ON public.sms_logs 
FOR INSERT 
WITH CHECK (true);

-- 2. Asegurar que la política de lectura para Super Admin esté bien definida
-- Re-creamos por si hubo algún error en la anterior
DROP POLICY IF EXISTS "Super admins can view all sms logs" ON sms_logs;
CREATE POLICY "Super admins can view all sms logs"
    ON sms_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenant_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- 3. Índice adicional para conteos rápidos por tenant
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_status ON sms_logs(tenant_id, status);
