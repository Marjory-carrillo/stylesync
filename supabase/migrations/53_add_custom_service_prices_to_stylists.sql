-- Migración 53: Agregar columna JSONB para tarifas y duraciones personalizadas por profesional
-- Ejecutar este comando en el Editor SQL de tu panel de Supabase:

ALTER TABLE stylists ADD COLUMN IF NOT EXISTS custom_service_prices jsonb DEFAULT '{}'::jsonb;
