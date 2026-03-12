-- ══════════════════════════════════════════════════════════════════
-- CitaLink: FIX TOTAL DE RLS (CLIENTES Y CITAS)
-- ══════════════════════════════════════════════════════════════════
-- Este script asegura que los usuarios puedan ver sus propios datos de clientes y citas.

-- 1. Asegurar que las tablas tengan RLS habilitado
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas que puedan estar bloqueando
DROP POLICY IF EXISTS "Users can view their own tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own tenant appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admin view all appointments" ON public.appointments;

-- 3. Crear política de SELECCIÓN para Clientes (Basada en tenant_id)
-- Esta política permite leer si el tenant_id del registro coincide con el del usuario
CREATE POLICY "Users can view their own tenant clients" 
ON public.clients 
FOR SELECT 
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 4. Crear política de SELECCIÓN para Citas (Basada en tenant_id)
CREATE POLICY "Users can view their own tenant appointments" 
ON public.appointments 
FOR SELECT 
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 5. Dar permisos explícitos sobre la vista a los roles de Supabase
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;

-- 6. VERIFICACIÓN FINAL:
-- Si eres super admin, necesitas una política adicional para ver TODO.
CREATE POLICY "Super admins view all clients" 
ON public.clients 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM tenant_users 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Super admins view all appointments" 
ON public.appointments 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM tenant_users 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    )
);

SELECT 'Políticas RLS actualizadas con éxito' as status;
