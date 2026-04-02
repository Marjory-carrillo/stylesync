-- Migration 31: Remove unused WhatsApp template columns from tenants
-- These columns were used by the manual template UI in Settings (now removed).
-- Reminders now use fixed Twilio Meta-approved templates (Content SIDs).

ALTER TABLE tenants 
  DROP COLUMN IF EXISTS confirmation_template,
  DROP COLUMN IF EXISTS reminder_template;
