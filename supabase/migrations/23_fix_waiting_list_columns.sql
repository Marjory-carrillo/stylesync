-- =============================================
-- Migration 23: Fix waiting_list columns
-- =============================================
-- Add 'name' column if it doesn't exist (frontend expects 'name', table might have 'client_name')
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS name TEXT;

-- Copy data from client_name to name if client_name exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'waiting_list' AND column_name = 'client_name'
    ) THEN
        UPDATE public.waiting_list SET name = client_name WHERE name IS NULL;
    END IF;
END $$;
