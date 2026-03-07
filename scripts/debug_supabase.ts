import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking direct clients...");
    const { data: clients, error: cErr } = await supabase.from('clients').select('*').limit(2);
    if (cErr) console.error("Clients Error:", cErr);
    else console.log("Clients found:", clients?.length);

    console.log("Checking client_summaries...");
    const { data: sums, error: sErr } = await supabase.from('client_summaries').select('*').limit(2);
    if (sErr) console.error("Summaries Error:", sErr);
    else console.log("Summaries found:", sums?.length);
}
check();
