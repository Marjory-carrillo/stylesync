-- ============================================================
-- Migration 42: Add missing tenant columns
-- Adds confirmation_template and reminder_template columns
-- that are referenced in the frontend but missing in the DB
-- ============================================================

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS confirmation_template text DEFAULT '',
    ADD COLUMN IF NOT EXISTS reminder_template      text DEFAULT '';
