import fs from 'fs';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

async function run() {
    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

    console.log("Checking nail_calculator_config table...");
    const res = await fetch(`${url}/rest/v1/nail_calculator_config?select=*&limit=5`, { headers });
    const data = await res.json();
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
}
run();
