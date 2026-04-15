-- Migration 42: Add add-on tracking columns to tenants table
-- Synced by stripe-webhook when subscription items change

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS extra_employees_paid integer DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS extra_branches_paid integer DEFAULT 0;
