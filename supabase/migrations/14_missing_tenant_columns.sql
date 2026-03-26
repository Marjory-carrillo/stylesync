ALTER TABLE tenants ADD COLUMN IF NOT EXISTS booking_days_ahead integer DEFAULT 14;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS commissions_enabled boolean DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS confirmation_template text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reminder_template text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS week_starts_on integer DEFAULT 1;
