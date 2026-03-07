import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("1. Buscando clientes...");
    const { data: clients, error: cErr } = await supabase.from('clients').select('id, name, phone, tenant_id').limit(5);
    if (cErr) console.error("Error clientes:", cErr);
    console.log(clients);

    console.log("\n2. Buscando citas completadas de hoy...");
    const { data: appts, error: aErr } = await supabase.from('appointments').select('id, client_name, client_phone, status, tenant_id, date').eq('status', 'completada').order('date', { ascending: false }).limit(5);
    if (aErr) console.error("Error appts:", aErr);
    console.log(appts);

    console.log("\n3. Buscando resumen de clientes (client_summaries)...");
    const { data: sums, error: sErr } = await supabase.from('client_summaries').select('name, phone, total_visits, total_spent').limit(5);
    if (sErr) console.error("Error summaries:", sErr);
    console.log(sums);
}

checkData();
