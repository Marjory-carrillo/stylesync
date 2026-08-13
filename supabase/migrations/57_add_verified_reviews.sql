-- Migration 57: Add verified_client and appointment_id to reviews for phone verification
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_client BOOLEAN DEFAULT true;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
