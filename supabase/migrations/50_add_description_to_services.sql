-- Agrega la columna description a la tabla services si no existe
ALTER TABLE services
ADD COLUMN IF NOT EXISTS description text;
