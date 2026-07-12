import fs from 'fs';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

async function run() {
    const headers = { 
        'apikey': key, 
        'Authorization': `Bearer ${key}`, 
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    console.log("Trying to upsert to nail_calculator_config...");
    const payload = {
        tenant_id: "de305d54-75b4-431b-adb2-eb6b9e546014", // valid dummy UUID
        config: []
    };

    const res = await fetch(`${url}/rest/v1/nail_calculator_config`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    
    if (res.status >= 400) {
        const errText = await res.text();
        console.log(`STATUS: ${res.status}`);
        console.log(`ERROR DETAILS: ${errText}`);
    } else {
        console.log(`SUCCESS! Status: ${res.status}`);
    }
}
run();
