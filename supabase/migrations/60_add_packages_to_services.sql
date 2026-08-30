-- Migration: 60_add_packages_to_services.sql
-- Description: Agrega soporte para Paquetes / Combos de servicios en CitaLink

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS is_package BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS included_service_names text[];

COMMENT ON COLUMN public.services.is_package IS 'Indica si el servicio es un paquete o combo que salta la seleccion de adicionales.';
COMMENT ON COLUMN public.services.included_service_names IS 'Lista de nombres de servicios o elementos incluidos para mostrar al cliente.';
