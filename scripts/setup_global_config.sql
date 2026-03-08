-- Script para crear la tabla de configuración global
CREATE TABLE IF NOT EXISTS global_configs (
    id TEXT PRIMARY KEY DEFAULT 'main',
    basic_plan_price NUMERIC(10,2) DEFAULT 499.00,
    premium_plan_price NUMERIC(10,2) DEFAULT 999.00,
    trial_days INTEGER DEFAULT 14,
    maintenance_mode BOOLEAN DEFAULT false,
    system_email TEXT DEFAULT 'soporte@citalink.app',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE global_configs ENABLE ROW LEVEL SECURITY;

-- Política: Solo Super Admin puede ver y editar
CREATE POLICY "Super Admins can do everything on global_configs"
ON global_configs
FOR ALL
TO authenticated
USING (auth.jwt() -> 'user_metadata' ->> 'is_super_admin' = 'true')
WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'is_super_admin' = 'true');

-- Insertar fila inicial si no existe
INSERT INTO global_configs (id)
VALUES ('main')
ON CONFLICT (id) DO NOTHING;
