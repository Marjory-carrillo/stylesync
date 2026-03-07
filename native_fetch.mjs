import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    console.log('--- CLIENTS ---');
    const res = await fetch(`${url}/rest/v1/clients?select=name,phone,tenant_id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const clients = await res.json();
    console.log(clients.slice(0, 3));

    console.log('--- APPOINTMENTS ---');
    const res1 = await fetch(`${url}/rest/v1/appointments?select=client_name,client_phone,tenant_id,status`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const appts = await res1.json();
    console.log(appts.slice(0, 5));

    console.log('--- SUMMARIES ---');
    const res2 = await fetch(`${url}/rest/v1/client_summaries?select=name,phone,tenant_id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const sums = await res2.json();
    if (sums.error) console.log(sums);
    else console.log(sums.slice(0, 3));
}
run();
