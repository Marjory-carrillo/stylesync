-- Allow tenant members and super admins to delete cancellation log entries
DROP POLICY IF EXISTS "Tenant members delete cancellation log" ON cancellation_log;

CREATE POLICY "Tenant members delete cancellation log" ON cancellation_log
    FOR DELETE
    USING (
        is_super_admin() OR 
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    );
