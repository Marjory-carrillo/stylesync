-- Migration 37: Trial period support
-- Agrega trial_ends_at a tenants para el mes gratis prometido a clientes actuales

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NULL;

-- Clientes actuales: darles 30 días de trial desde hoy
-- (solo los que ya existen y tienen un negocio real, excluye el tenant demo)
UPDATE tenants
SET trial_ends_at = now() + interval '30 days'
WHERE id != '00000000-0000-0000-0000-000000000001'
  AND trial_ends_at IS NULL;

-- Verificar
SELECT id, name, plan, trial_ends_at FROM tenants ORDER BY created_at;
