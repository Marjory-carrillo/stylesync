import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function localMetaApiPlugin() {
  return {
    name: 'local-meta-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && (req.url === '/api/send-sms' || req.url === '/api/send-whatsapp') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { to, phone, message } = data;
              const rawTarget = to || phone || '';
              const digits = String(rawTarget).replace(/\D/g, '');
              let waDigits = digits;
              if (digits.length === 10) {
                waDigits = `52${digits}`;
              } else if (digits.startsWith('521') && digits.length === 13) {
                waDigits = `52${digits.slice(3)}`;
              }

              // Leer .env local
              const envPath = path.resolve(process.cwd(), '.env');
              const env: Record<string, string> = {};
              if (fs.existsSync(envPath)) {
                fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
                  const idx = line.indexOf('=');
                  if (idx > 0) {
                    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
                  }
                });
              }

              const phoneId = env.META_WA_PHONE_NUMBER_ID || '1337471699449991';
              const token = env.META_WA_ACCESS_TOKEN;

              if (!token) {
                console.error('[local-meta-api] ❌ META_WA_ACCESS_TOKEN no encontrado en .env');
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'META_WA_ACCESS_TOKEN no encontrado en .env' }));
              }

              console.log(`[local-meta-api] 🚀 Enviando WhatsApp vía Meta Cloud API a ${waDigits}...`);

              const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: waDigits,
                  type: 'text',
                  text: {
                    preview_url: false,
                    body: message || 'Confirmación de cita CitaLink'
                  }
                })
              });

              const metaData = await metaRes.json();
              console.log('[local-meta-api] Respuesta de Meta:', metaRes.status, JSON.stringify(metaData));

              res.statusCode = metaRes.ok ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ 
                success: metaRes.ok, 
                error: !metaRes.ok ? (metaData?.error?.message || 'Error en Meta Cloud API') : undefined,
                data: metaData 
              }));
            } catch (err: any) {
              console.error('[local-meta-api] ❌ Error:', err.message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localMetaApiPlugin()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  }
})
