-- Migration: Add Deposit & Cancellation Policy columns to Tenants, Appointments, and Stylists
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_type TEXT DEFAULT 'fixed';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_bank_name TEXT DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_clabe TEXT DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_holder_name TEXT DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_cancellation_policy TEXT DEFAULT '';

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_receipt_url TEXT DEFAULT NULL;

ALTER TABLE stylists ADD COLUMN IF NOT EXISTS deposit_bank_name TEXT DEFAULT '';
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS deposit_clabe TEXT DEFAULT '';
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS deposit_holder_name TEXT DEFAULT '';
