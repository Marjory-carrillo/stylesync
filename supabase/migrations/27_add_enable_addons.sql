-- Migration 27: Add enable_addons to tenants
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS enable_addons BOOLEAN NOT NULL DEFAULT FALSE;
