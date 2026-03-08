import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking global_configs table...");
    const { data, error } = await supabase.from('global_configs').select('*').limit(1);
    if (error) {
        console.error("Error or table does not exist:", error);
    } else {
        console.log("Table exists. Data:", data);
    }
}
check();
