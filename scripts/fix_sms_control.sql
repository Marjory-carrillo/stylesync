-- Fase 10: Auditoría y Control de Costos SMS

-- 1. Añadir columna de control a la tabla de tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;

-- 2. Crear tabla de logs para auditoría de SMS
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone_to TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'error', 'blocked'
    error_message TEXT,
    provider_sid TEXT, -- SID de Twilio
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS en sms_logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de RLS para sms_logs
-- Solo el Super Admin puede ver todos los logs
CREATE POLICY "Super admins can view all sms logs"
    ON sms_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenant_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_id ON sms_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at);

-- 6. Comentario de documentación
COMMENT ON TABLE sms_logs IS 'Registro detallado de envíos de SMS para auditoría y facturación.';
COMMENT ON COLUMN tenants.sms_enabled IS 'Indica si el negocio tiene permiso para enviar SMS reales (Twilio).';
