
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig = Object.fromEntries(
    envContent.split('\n').map(line => line.split('=').map(part => part.trim()))
);

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log('Testing schedule update...');

    // 1. Fetch existing
    const { data: existing, error: fetchError } = await supabase
        .from('schedule_config')
        .select('*')
        .limit(1)
        .single();

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        // If fetch fails, we can't update.
    } else {
        console.log('Existing config found:', existing?.id);
    }

    // 2. Try Update
    const newSchedule = {
        test: "update at " + new Date().toISOString()
    };

    // We need a valid schedule structure or just partial? 
    // The column is jsonb, so any object is valid json.
    // However, let's try to update with the existing schedule just to test permissions 
    // (modifying one field).

    const { error: updateError } = await supabase
        .from('schedule_config')
        .update({ schedule: { ...existing?.schedule, updated: true } })
        .eq('id', existing?.id || 1);

    if (updateError) {
        console.error('Update Error:', updateError);
    } else {
        console.log('Update SUCCESS!');
    }
}

testUpdate();
