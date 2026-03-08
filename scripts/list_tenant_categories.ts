import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching tenants list with categories...");
    const { data: tenants, error } = await supabase.from('tenants').select('name, category');
    if (error) {
        console.error("Error:", error);
    } else {
        console.table(tenants);
    }
}
check();
