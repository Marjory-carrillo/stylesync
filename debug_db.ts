import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    console.log('Fetching raw clients...');
    const { data: clients, error: cerr } = await supabase.from('clients').select('*');
    console.log('Clients:', clients?.length, cerr);
    if (clients) {
        clients.slice(0, 2).forEach(c => console.log('Client:', c.name, c.tenant_id));
    }

    console.log('Fetching appointments...');
    const { data: apps, error: aerr } = await supabase.from('appointments').select('*');
    console.log('Appointments:', apps?.length, aerr);
    if (apps) {
        apps.slice(0, 2).forEach(a => console.log('Appt:', a.client_name, a.tenant_id));
    }
}
run();
