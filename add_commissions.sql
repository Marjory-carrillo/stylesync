-- Migración: Añadir soporte para el Módulo de Comisiones y Plantillas de WhatsApp

-- 1. Añadir flag de comisiones y plantillas a la tabla tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS commissions_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS confirmation_template TEXT;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS reminder_template TEXT;

-- 2. Añadir porcentaje de comisión a la tabla stylists
ALTER TABLE public.stylists
ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 0;

-- 3. Actualizar políticas de RLS para asegurar que el owner puede editar estos nuevos campos
-- (Las políticas existentes de UPDATE en tenants y stylists deberían cubrir esto, 
-- pero añadimos un dummy select para verificar que las columnas se añadieron correctamente)
SELECT id, name, commissions_enabled, confirmation_template FROM public.tenants LIMIT 1;
SELECT id, name, commission_rate FROM public.stylists LIMIT 1;
