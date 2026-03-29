-- =============================================
-- Migration 21: WhatsApp Provider Support
-- =============================================

-- 1. Asegurar que sms_logs existe con estructura correcta
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone       TEXT NOT NULL,
    message     TEXT,
    provider    TEXT NOT NULL DEFAULT 'demo', -- 'demo' | 'whatsapp'
    status      TEXT NOT NULL DEFAULT 'demo', -- 'demo' | 'sent' | 'failed'
    twilio_sid  TEXT,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Si ya existía, agregar columnas que pueden faltar
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS error TEXT;

-- 3. Agregar columna sms_provider a tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_provider TEXT NOT NULL DEFAULT 'demo';

-- 4. Migrar datos existentes de sms_enabled a sms_provider
UPDATE public.tenants SET sms_provider = 'whatsapp' WHERE sms_enabled = true;
UPDATE public.tenants SET sms_provider = 'demo' WHERE sms_enabled = false OR sms_enabled IS NULL;

-- 5. RLS para sms_logs (SuperAdmin puede leer todo)
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin can read all sms_logs" ON public.sms_logs;
CREATE POLICY "SuperAdmin can read all sms_logs"
    ON public.sms_logs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role can insert sms_logs" ON public.sms_logs;
CREATE POLICY "Service role can insert sms_logs"
    ON public.sms_logs FOR INSERT
    WITH CHECK (true);
