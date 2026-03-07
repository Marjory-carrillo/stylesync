import fs from 'fs';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

async function run() {
    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

    const res1 = await fetch(`${url}/rest/v1/clients?select=id,name,phone&limit=10`, { headers });
    const clients = await res1.json();
    console.log("CLIENTS:", clients.map(c => `${c.name} (${c.phone})`));

    const res2 = await fetch(`${url}/rest/v1/appointments?select=id,client_name,client_phone,status,date&status=eq.completada&limit=10`, { headers });
    const appts = await res2.json();
    console.log("\nCOMPLETED APPTS:", appts.map(a => `${a.client_name} (${a.client_phone}) - ${a.date}`));

    const res3 = await fetch(`${url}/rest/v1/client_summaries?select=name,phone,total_visits,total_spent&limit=10`, { headers });
    const sums = await res3.json();
    console.log("\nCLIENT SUMMARIES:", sums.map(s => `${s.name} (${s.phone}): Visits ${s.total_visits}, Spent $${s.total_spent}`));
}
run();
