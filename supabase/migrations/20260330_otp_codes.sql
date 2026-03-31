-- Tabla temporal para OTP personalizado
CREATE TABLE IF NOT EXISTS otp_codes (
    phone       text        PRIMARY KEY,
    code        text        NOT NULL,
    attempts    integer     DEFAULT 0,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- Permisos de acceso para todos los roles de Supabase
GRANT ALL ON TABLE otp_codes TO anon, authenticated, service_role;

-- RLS: solo service_role puede operar (desde Edge Functions)
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'otp_codes' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON otp_codes
        FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
