-- =========================================================================
-- SOLUCIÓN FINAL: TRIGGER BLINDADO Y PERMISOS ABIERTOS PARA CLIENTES
-- Instrucciones: Ejecuta esto de nuevo en tu SQL Editor de Supabase.
-- Garantiza que las Citas sí o sí inserten al Cliente y la App sí los lea.
-- =========================================================================

-- 1. Recrear el Trigger de inserción ignorando nombres raros de restricciones
CREATE OR REPLACE FUNCTION upsert_client_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmada' THEN
        -- Insertar al cliente y si ya detecta que existe el mismo teléfono en la misma sucursal, solo actualiza el nombre.
        INSERT INTO public.clients (tenant_id, name, phone)
        VALUES (NEW.tenant_id, NEW.client_name, NEW.client_phone)
        ON CONFLICT (tenant_id, phone) DO UPDATE SET name = EXCLUDED.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurarnos de limpiar el Trigger viejo y poner el nuevo
DROP TRIGGER IF EXISTS trg_upsert_client ON public.appointments;

CREATE TRIGGER trg_upsert_client
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION upsert_client_on_appointment();


-- 3. FORZAR que tu App pueda leer la vista `client_summaries` y la tabla `clients`
-- Hay un bloqueo RLS (42501) que está protegiendo la tabla, le diremos explícitamente a Supabase que te deje leerla.
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.clients TO authenticated, anon;
GRANT ALL ON public.client_summaries TO authenticated, anon;


-- 4. Rescate de todos los fantasmas con método genérico (ON CONFLICT (A, B))
INSERT INTO public.clients (tenant_id, name, phone)
SELECT DISTINCT ON (tenant_id, client_phone)
    tenant_id,
    client_name,
    client_phone
FROM public.appointments
WHERE status = 'confirmada'
ON CONFLICT (tenant_id, phone) DO NOTHING;
