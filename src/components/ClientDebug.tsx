import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';

export function ClientDebug() {
    const { tenantId } = useAuthStore();
    const [rawData, setRawData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            console.log('Fetching clients for tenant:', tenantId);
            const { data, error } = await supabase
                .from('client_summaries')
                .select('*')
                .eq('tenant_id', tenantId);

            console.log('Raw response:', { data, error });
            setRawData(data);
            if (error) setError(error.message);
        }

        if (tenantId) fetchData();
    }, [tenantId]);

    return (
        <div className="bg-red-900/50 p-4 rounded-lg mb-4 text-white font-mono text-sm">
            <h3 className="font-bold mb-2">DEBUG CLIENTES</h3>
            <p>TenantID: {tenantId || 'NO TENANT'}</p>
            <p>Registros encontrados: {rawData?.length || 0}</p>
            {error && <p className="text-red-300">Error: {error}</p>}
            <details>
                <summary className="cursor-pointer mt-2">Ver datos crudos</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-60">
                    {JSON.stringify(rawData, null, 2)}
                </pre>
            </details>
        </div>
    );
}
