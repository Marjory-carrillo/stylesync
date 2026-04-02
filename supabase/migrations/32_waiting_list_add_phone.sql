-- Migration 32: Add phone column to waiting_list table
-- The useWaitingList hook inserts { name, phone, date, service_id, tenant_id }
-- but the phone column was never added to the table.

ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS phone TEXT;
