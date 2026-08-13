-- Migration 56: Create reviews table and add QR custom messages to tenants
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_name TEXT DEFAULT 'Cliente Anónimo',
    client_phone TEXT DEFAULT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT NULL,
    reply TEXT DEFAULT NULL,
    replied_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);

-- Enable RLS on reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
DROP POLICY IF EXISTS "Allow public read access to reviews" ON reviews;
CREATE POLICY "Allow public read access to reviews" ON reviews
    FOR SELECT USING (true);

-- Allow public insert access to reviews
DROP POLICY IF EXISTS "Allow public insert access to reviews" ON reviews;
CREATE POLICY "Allow public insert access to reviews" ON reviews
    FOR INSERT WITH CHECK (true);

-- Allow tenant update access to reviews (for replies)
DROP POLICY IF EXISTS "Allow tenant update access to reviews" ON reviews;
CREATE POLICY "Allow tenant update access to reviews" ON reviews
    FOR UPDATE USING (true);

-- Add custom QR messages to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qr_review_message TEXT DEFAULT '¿Cómo fue tu experiencia? Déjanos tu reseña 🌟';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qr_booking_message TEXT DEFAULT 'Agenda tu próxima cita aquí 👇';
