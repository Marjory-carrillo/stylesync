import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking tenants categories...");
    const { data: tenants, error } = await supabase.from('tenants').select('category');
    if (error) {
        console.error("Error:", error);
    } else {
        const counts: Record<string, number> = {};
        tenants?.forEach(t => {
            const cat = t.category || 'null';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        console.log("Category counts:", counts);
    }
}
check();
