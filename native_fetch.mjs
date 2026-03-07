const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

async function run() {
    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

    // 1. Clientes
    const res1 = await fetch(`${url}/rest/v1/clients?select=id,name,phone,tenant_id&limit=5`, { headers });
    const clients = await res1.json();
    console.log("CLIENTS:", clients);

    // 2. Citas Completadas
    const res2 = await fetch(`${url}/rest/v1/appointments?select=id,client_name,client_phone,status,tenant_id,date&status=eq.completada&order=date.desc&limit=5`, { headers });
    const appts = await res2.json();
    console.log("\nCOMPLETED APPTS:", appts);

    // 3. Resumenes
    const res3 = await fetch(`${url}/rest/v1/client_summaries?select=name,phone,tenant_id,total_visits,total_spent&limit=10`, { headers });
    const sums = await res3.json();
    console.log("\nCLIENT SUMMARIES:", sums);
}
run();
