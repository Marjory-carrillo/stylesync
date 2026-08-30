-- Migration 61: Allow deleting services by setting ON DELETE SET NULL on appointments and waiting_list foreign keys

ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS appointments_service_id_fkey,
ADD CONSTRAINT appointments_service_id_fkey 
    FOREIGN KEY (service_id) 
    REFERENCES services(id) 
    ON DELETE SET NULL;

ALTER TABLE waiting_list 
DROP CONSTRAINT IF EXISTS waiting_list_service_id_fkey,
ADD CONSTRAINT waiting_list_service_id_fkey 
    FOREIGN KEY (service_id) 
    REFERENCES services(id) 
    ON DELETE SET NULL;
