-- Tabla temporal para OTP personalizado
CREATE TABLE IF NOT EXISTS otp_codes (
    phone       text        PRIMARY KEY,
    code        text        NOT NULL,
    attempts    integer     DEFAULT 0,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- Auto-limpiar registros expirados
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx ON otp_codes(expires_at);

-- Solo la service role puede operar esta tabla (Edge Function)
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON otp_codes
    USING (auth.role() = 'service_role');
