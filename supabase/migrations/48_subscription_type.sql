-- Migration 48: Add subscription_type and payment_status to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_type text NOT NULL DEFAULT 'manual';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

-- Constraints validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_subscription_type_check'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_type_check
            CHECK (subscription_type IN ('stripe', 'manual'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_payment_status_check'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_payment_status_check
            CHECK (payment_status IN ('active', 'grace_period', 'suspended'));
    END IF;
END $$;
