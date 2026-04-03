-- Migration 34: Multi-Business Support
-- Adds index for efficient owner_id lookups when an owner has multiple businesses.

CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);
