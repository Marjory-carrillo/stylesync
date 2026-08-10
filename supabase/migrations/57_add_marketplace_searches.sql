-- Migración 57: Crear tabla para registrar lo más buscado en el Marketplace
CREATE TABLE IF NOT EXISTS marketplace_searches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE marketplace_searches ENABLE ROW LEVEL SECURITY;

-- Permitir inserción a usuarios anónimos y autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_searches' AND policyname = 'Allow public insert to marketplace_searches'
    ) THEN
        CREATE POLICY "Allow public insert to marketplace_searches" ON marketplace_searches
            FOR INSERT TO public WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_searches' AND policyname = 'Allow public select from marketplace_searches'
    ) THEN
        CREATE POLICY "Allow public select from marketplace_searches" ON marketplace_searches
            FOR SELECT TO public USING (true);
    END IF;
END $$;
