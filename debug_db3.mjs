import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('Fetching raw clients...');
    const { data: clients, error: cerr } = await supabase.from('clients').select('*');
    console.log('Clients:', clients ? clients.length : 0, cerr);
    if (clients) clients.slice(0, 2).forEach(c => console.log('Client:', c.name, c.tenant_id));

    console.log('Fetching appts...');
    const { data: appts, error: aerr } = await supabase.from('appointments').select('*');
    console.log('Appts:', appts ? appts.length : 0, aerr);
    if (appts) appts.slice(0, 5).forEach(a => console.log('App:', a.client_name, a.tenant_id, a.status));

    console.log('Fetching summaries...');
    const { data: sum, error: serr } = await supabase.from('client_summaries').select('*');
    console.log('Sums:', sum ? sum.length : 0, serr);
}
run();
