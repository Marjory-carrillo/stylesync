import { createClient } from '@supabase/supabase-js';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

const supabase = createClient(url, anonKey);

async function test() {
    console.log("Checking nail_calculator_config...");
    const { data, error } = await supabase.from('nail_calculator_config').select('*');
    console.log("Fetch result:", { count: data?.length, error });
}

test();
