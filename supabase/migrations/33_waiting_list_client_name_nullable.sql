-- Migration 33: Make client_name nullable in waiting_list
-- client_name is a legacy column; inserts now use 'name' as the primary field.
-- Dropping NOT NULL allows the new insert pattern to work without duplicating logic.

ALTER TABLE public.waiting_list 
  ALTER COLUMN client_name DROP NOT NULL;
