import { createClient } from '@supabase/supabase-js';

const url = "https://mcvcuymiyfondasvqskv.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdmN1eW1peWZvbmRhc3Zxc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODM3NDMsImV4cCI6MjA4Njg1OTc0M30.2Hbj-g-LXMcNLcv0I6lemRhH717w-zpGnW0JFc79GGc";

const supabase = createClient(url, anonKey);

async function testUpdate() {
    console.log("Testing update on nail_calculator_config...");
    const { data: existing, error: selectErr } = await supabase
        .from('nail_calculator_config')
        .select('*')
        .limit(1);

    console.log("Select result:", { existing, selectErr });

    if (existing && existing.length > 0) {
        const row = existing[0];
        console.log("Testing update for tenant:", row.tenant_id);
        const { data: updateData, error: updateErr } = await supabase
            .from('nail_calculator_config')
            .update({ config: row.config })
            .eq('tenant_id', row.tenant_id)
            .select();

        console.log("Update result:", { updateData, updateErr });
    }
}

testUpdate();
