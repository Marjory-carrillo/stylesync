-- Migration 62: Add duration column to catalog_items
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS duration integer;
