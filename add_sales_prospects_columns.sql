-- Migration: Agregar columnas enriquecidas a la tabla sales_prospects
CREATE TABLE IF NOT EXISTS public.sales_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pendiente_visita',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar columnas nuevas si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'contact_name') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN contact_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'category') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN category TEXT DEFAULT 'barbershop';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'next_visit_at') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN next_visit_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'photo_url') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN photo_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'google_maps_url') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN google_maps_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_prospects' AND column_name = 'converted_tenant_id') THEN
        ALTER TABLE public.sales_prospects ADD COLUMN converted_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.sales_prospects ENABLE ROW LEVEL SECURITY;

-- Política para que usuarios autenticados / SuperAdmin puedan gestionar prospectos
DROP POLICY IF EXISTS "Authenticated users full access to sales_prospects" ON public.sales_prospects;
CREATE POLICY "Authenticated users full access to sales_prospects"
ON public.sales_prospects
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
