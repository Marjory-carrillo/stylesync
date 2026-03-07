-- =========================================================================
-- RESTAURAR EL TRIGGER AUTOMÁTICO DE CLIENTES
-- Instrucciones: Pega todo este código en tu SQL Editor de Supabase y dale a RUN.
-- Esto hará que cada vez que se cree una Cita, la persona se guarde en Clientes.
-- =========================================================================

-- 1. Recrear la función insertora adaptada a nuestra estructura estricta
CREATE OR REPLACE FUNCTION upsert_client_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmada' THEN
        INSERT INTO public.clients (tenant_id, name, phone)
        VALUES (NEW.tenant_id, NEW.client_name, NEW.client_phone)
        ON CONFLICT ON CONSTRAINT clients_phone_tenant_key 
        DO UPDATE SET name = EXCLUDED.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurarnos de eliminar cualquier trigger viejo desconfigurado
DROP TRIGGER IF EXISTS trg_upsert_client ON public.appointments;

-- 3. Crear el Trigger nuevo
CREATE TRIGGER trg_upsert_client
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION upsert_client_on_appointment();

-- 4. Opcional pero recomendado: Sincronizar clientes con las citas que acabas de hacer hoy
INSERT INTO public.clients (tenant_id, name, phone)
SELECT DISTINCT ON (tenant_id, client_phone)
    tenant_id,
    client_name,
    client_phone
FROM public.appointments
WHERE status = 'confirmada'
ON CONFLICT ON CONSTRAINT clients_phone_tenant_key DO NOTHING;
