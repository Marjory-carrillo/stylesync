-- Migration 25: Add additional_services to appointments
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS additional_services TEXT[] DEFAULT '{}';
