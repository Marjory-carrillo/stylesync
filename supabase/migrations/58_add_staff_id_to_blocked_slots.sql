-- Migration 58: Add staff_id to blocked_slots table
ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS staff_id text DEFAULT NULL;
