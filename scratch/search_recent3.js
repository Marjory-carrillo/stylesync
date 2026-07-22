const fs = require('fs');

const logPath = 'C:\\\\Users\\\\ADMIN\\\\.gemini\\\\antigravity\\\\brain\\\\2e9b01e2-ccae-4228-9673-fd67c2b35678\\\\.system_generated\\\\logs\\\\transcript.jsonl';
if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    for (let i = 1914; i < 2150; i++) {
        if (!lines[i]) continue;
        try {
            const parsed = JSON.parse(lines[i]);
            if (parsed.tool_calls) {
                parsed.tool_calls.forEach(tc => {
                    if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
                        console.log(`Line ${i + 1}: ${tc.name}`);
                        console.log('Keys of tc:', Object.keys(tc));
                        if (tc.arguments) {
                            console.log('Keys of arguments:', Object.keys(tc.arguments));
                            console.log('TargetFile:', tc.arguments.TargetFile || tc.arguments.targetFile);
                            console.log('Description:', tc.arguments.Description || tc.arguments.description);
                        }
                        console.log('---');
                    }
                });
            }
        } catch (e) {
            console.error('Error on line ' + (i+1) + ':', e);
        }
    }
} else {
    console.log('Log file not found');
}
