-- Migration 38: WhatsApp como proveedor de mensajería por defecto
ALTER TABLE tenants ALTER COLUMN sms_provider SET DEFAULT 'whatsapp';

-- Verificar
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'sms_provider';
