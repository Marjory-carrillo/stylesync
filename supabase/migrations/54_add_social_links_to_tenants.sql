-- Migración 54: Agregar columnas de Redes Sociales al tenant
-- Ejecutar este comando en el Editor SQL de tu panel de Supabase:

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS facebook_url text DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiktok_url text DEFAULT NULL;
