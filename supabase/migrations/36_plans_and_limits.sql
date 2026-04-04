-- Migration 36: Sistema de Planes (Free / Pro / Business)
-- Agrega campo plan a tenants para controlar límites de sucursales y empleados

-- 1. Agregar columna plan con default 'free'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- 2. Crear constraint para valores válidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_plan_check'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check
            CHECK (plan IN ('free', 'pro', 'business'));
    END IF;
END $$;

-- Verificar
SELECT id, name, plan FROM tenants LIMIT 5;
