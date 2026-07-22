import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    "https://mcvcuymiyfondasvqskv.supabase.co", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc"
);

async function run() {
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', 'a9568f4e-0181-4471-9df9-92a98d80831e')
        .single();
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Mar del rey details:", JSON.stringify(data, null, 2));
    }
}
run();
