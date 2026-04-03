-- Migration 35: Brand Slug for Multi-Branch Client Booking
-- Adds a brand_slug column so multiple branches under the same owner
-- can share a single public booking link.
-- e.g., /reserva/barberia-el-rey shows a branch picker,
-- while /reserva/barberia-el-rey-norte goes directly to that branch.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_slug TEXT;

-- Index for fast brand_slug lookups
CREATE INDEX IF NOT EXISTS idx_tenants_brand_slug ON tenants(brand_slug);
