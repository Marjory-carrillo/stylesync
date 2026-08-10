-- Migración 55: Agregar campos de Marketplace y Comisiones por cliente nuevo
-- Ejecutar este comando en el Editor SQL de tu panel de Supabase:

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_enabled boolean DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_commission_rate numeric DEFAULT 15.0;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'direct';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS marketplace_commission_amount numeric DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS commission_billed boolean DEFAULT false;
