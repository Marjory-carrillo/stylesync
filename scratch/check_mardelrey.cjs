require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .or('name.ilike.%mardelrey%,slug.ilike.%mardelrey%,brand_slug.ilike.%mardelrey%');
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Tenant data for mardelrey:", JSON.stringify(data, null, 2));
    }
}
run();
