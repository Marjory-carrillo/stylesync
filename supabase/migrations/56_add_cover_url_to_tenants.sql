-- Migración 56: Campo de foto de portada para negocios
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cover_url text DEFAULT NULL;
