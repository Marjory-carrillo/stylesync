-- Add enable_nail_calculator column to tenants table (defaults to true)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enable_nail_calculator boolean DEFAULT true;
