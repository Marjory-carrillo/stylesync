-- Agrega columna para ocultar precios en la vista pública de reservas
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS hide_service_prices boolean NOT NULL DEFAULT false;
