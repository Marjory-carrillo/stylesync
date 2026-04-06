-- Migration 41: Add Stripe columns to tenants table
-- Stores the Stripe customer and subscription IDs for each tenant

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
