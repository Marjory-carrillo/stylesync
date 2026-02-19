-- Script de Corrección para Tabla Tenants (Negocios)
-- Ejecuta este script en el Editor SQL de Supabase para corregir el error de "Crear Negocio"

-- 1. Asegurar que las columnas necesarias existan
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text;

-- 2. Habilitar seguridad (RLS)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de seguridad (de forma segura, sin error si ya existen)
DO $$
BEGIN
    -- Política para INSERT (Crear)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'Users can create their own tenant'
    ) THEN
        CREATE POLICY "Users can create their own tenant" ON public.tenants
            FOR INSERT TO authenticated
            WITH CHECK (auth.uid() = owner_id);
    END IF;

    -- Política para UPDATE (Actualizar)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'Users can update their own tenant'
    ) THEN
        CREATE POLICY "Users can update their own tenant" ON public.tenants
            FOR UPDATE TO authenticated
            USING (auth.uid() = owner_id);
    END IF;

    -- Política para SELECT (Ver propios)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'Users can view their own tenant'
    ) THEN
        CREATE POLICY "Users can view their own tenant" ON public.tenants
            FOR SELECT TO authenticated
            USING (auth.uid() = owner_id);
    END IF;
    
    -- Política para SELECT (Público ver por link/slug)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'Public can view tenants by slug'
    ) THEN
        CREATE POLICY "Public can view tenants by slug" ON public.tenants
            FOR SELECT TO anon
            USING (true);
    END IF;
END
$$;
