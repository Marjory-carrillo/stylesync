-- ============================================================
-- SCRIPT COMPLETO: Añadir tabla de clientes a schema existente
-- Ejecuta POR SEPARADO, en este orden:
-- 1) Primero: fix_tenants_schema_v4.sql  (si tenants no existe)
-- 2) Luego: este archivo
-- ============================================================

-- 1. Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    notes       TEXT,
    tags        TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, phone)
);

-- 2. Permisos abiertos (sin RLS para simplificar)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
GRANT ALL ON clients TO postgres, anon, authenticated;

-- 3. Función que auto-crea clientes al insertar/actualizar citas
CREATE OR REPLACE FUNCTION upsert_client_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmada' THEN
        INSERT INTO clients (tenant_id, name, phone)
        VALUES (NEW.tenant_id, NEW.client_name, NEW.client_phone)
        ON CONFLICT (tenant_id, phone) DO UPDATE SET name = EXCLUDED.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger sobre la tabla appointments
DROP TRIGGER IF EXISTS trg_upsert_client ON appointments;
CREATE TRIGGER trg_upsert_client
AFTER INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION upsert_client_on_appointment();

-- 5. (Opcional) Poblar clients con datos que ya existen en appointments
INSERT INTO clients (tenant_id, name, phone)
SELECT DISTINCT ON (tenant_id, client_phone)
    tenant_id,
    client_name,
    client_phone
FROM appointments
WHERE status = 'confirmada'
ON CONFLICT (tenant_id, phone) DO NOTHING;
