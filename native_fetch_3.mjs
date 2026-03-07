import fs from 'fs';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

async function run() {
    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

    const res = await fetch(`${url}/rest/v1/appointments?select=id,client_name,status,date,time&limit=20`, { headers });
    const appts = await res.json();
    console.log("ALL RECENT APPTS:", appts.map(a => `${a.client_name}: ${a.date} ${a.time} - STATUS: ${a.status}`));
}
run();
