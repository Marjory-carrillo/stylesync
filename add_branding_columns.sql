
-- Add branding columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS primary_color text,
ADD COLUMN IF NOT EXISTS accent_color text;

-- Comment on columns
COMMENT ON COLUMN public.tenants.primary_color IS 'Custom primary hue (0-360) or hex color';
COMMENT ON COLUMN public.tenants.accent_color IS 'Custom accent hue (0-360) or hex color';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('primary_color', 'accent_color');
