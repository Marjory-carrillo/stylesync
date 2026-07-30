-- Migration 51: Actualizar constraint tenants_plan_check para permitir el plan 'lite' (Esencial)
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check 
    CHECK (plan IN ('free', 'lite', 'pro', 'business'));
