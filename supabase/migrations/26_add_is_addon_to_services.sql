-- Migration 26: Add is_addon flag to services
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS is_addon BOOLEAN NOT NULL DEFAULT FALSE;
