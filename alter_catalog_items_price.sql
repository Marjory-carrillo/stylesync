-- ══════════════════════════════════════════════════════════════════
-- CitaLink: Agregar columna precio a catalog_items
-- EJECUTA ESTE SCRIPT en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS price NUMERIC;
