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
              const { to, phone, message, template_name, template_sid, template_variables, template_lang } = data;
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

              const phoneId = env.META_WA_PHONE_NUMBER_ID || '1312583781938400';
              const token = env.META_WA_ACCESS_TOKEN;

              if (!token) {
                console.error('[local-meta-api] ❌ META_WA_ACCESS_TOKEN no encontrado en .env');
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'META_WA_ACCESS_TOKEN no encontrado en .env' }));
              }

              const META_TEMPLATE_MAP: Record<string, { name: string; lang?: string }> = {
                'HXcc71cca366ff7fa242044edb96ead1bc': { name: 'citalink_cliente_cita_manual', lang: 'es_MX' },
                'HX9f85e85c7229648e7e4966e678f8d204': { name: 'citalink_cliente_confirmacion_v3', lang: 'es_MX' },
                'HX35ed4a23580c8a4b1050a95802a335c0': { name: 'citalink_cliente_recordatorio_v5', lang: 'es_MX' },
                'HXb2828c0bd3aabc8edd912c81db56884f': { name: 'citalink_cliente_cancelacion', lang: 'es_MX' },
                'HX84b5a4b7cf045e4fe976564f705a0613': { name: 'citalink_cliente_reprogramacion', lang: 'es_MX' },
                'HX7e31d42fe0693980543f4fb2308e05a8': { name: 'citalink_cliente_actualizacion_precio', lang: 'es_MX' },
                'HXd19a0ab5d8bf37655221320bb6555ea1': { name: 'citalink_admin_nueva_cita', lang: 'es_MX' },
                'HX16247c41bf5cf9f31236c2e574337308': { name: 'citalink_admin_reprogramacion', lang: 'es_MX' },
                'HXdc7be5995c074f498642e9536b157947': { name: 'citalink_admin_cancelacion', lang: 'es_MX' },
                'HXe57fdea8c7ab7bd6311190fd5737c638': { name: 'citalink_superadmin_nuevo_negocio', lang: 'es_MX' },
                'citalink_cliente_cita_manual': { name: 'citalink_cliente_cita_manual', lang: 'es_MX' },
                'citalink_cliente_confirmacion_v3': { name: 'citalink_cliente_confirmacion_v3', lang: 'es_MX' },
                'citalink_cliente_recordatorio_v5': { name: 'citalink_cliente_recordatorio_v5', lang: 'es_MX' },
                'citalink_cliente_cancelacion': { name: 'citalink_cliente_cancelacion', lang: 'es_MX' },
                'citalink_cliente_reprogramacion': { name: 'citalink_cliente_reprogramacion', lang: 'es_MX' },
                'citalink_cliente_actualizacion_precio': { name: 'citalink_cliente_actualizacion_precio', lang: 'es_MX' },
                'citalink_admin_nueva_cita': { name: 'citalink_admin_nueva_cita', lang: 'es_MX' },
                'citalink_admin_reprogramacion': { name: 'citalink_admin_reprogramacion', lang: 'es_MX' },
                'citalink_admin_cancelacion': { name: 'citalink_admin_cancelacion', lang: 'es_MX' },
                'citalink_superadmin_nuevo_negocio': { name: 'citalink_superadmin_nuevo_negocio', lang: 'es_MX' },
              };

              let targetTemplate = template_name;
              let targetLang = template_lang || 'es_MX';

              if (template_name && META_TEMPLATE_MAP[template_name]) {
                targetTemplate = META_TEMPLATE_MAP[template_name].name;
                targetLang = META_TEMPLATE_MAP[template_name].lang || targetLang;
              } else if (template_sid && META_TEMPLATE_MAP[template_sid]) {
                targetTemplate = META_TEMPLATE_MAP[template_sid].name;
                targetLang = META_TEMPLATE_MAP[template_sid].lang || targetLang;
              }

              let metaPayload: any;

              if (targetTemplate) {
                const bodyParams = template_variables
                  ? Object.keys(template_variables)
                      .sort((a, b) => Number(a) - Number(b))
                      .map((k) => ({
                        type: 'text',
                        text: String(template_variables[k] ?? ''),
                      }))
                  : [];

                console.log(`[local-meta-api] 🚀 Enviando plantilla oficial Meta '${targetTemplate}' a ${waDigits}...`);
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: waDigits,
                  type: 'template',
                  template: {
                    name: targetTemplate,
                    language: {
                      code: targetLang,
                    },
                    ...(bodyParams.length > 0
                      ? {
                          components: [
                            {
                              type: 'body',
                              parameters: bodyParams,
                            },
                          ],
                        }
                      : {}),
                  },
                };
              } else {
                console.log(`[local-meta-api] 🚀 Enviando WhatsApp texto libre vía Meta Cloud API a ${waDigits}...`);
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: waDigits,
                  type: 'text',
                  text: {
                    preview_url: false,
                    body: message || 'Confirmación de cita CitaLink',
                  },
                };
              }

              const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(metaPayload),
              });

              const metaData: any = await metaRes.json();
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
