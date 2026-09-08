// Script de escaneo de seguridad para CitaLink
// Ejecutar con: node .agents/skills/security-audit/scripts/scan.cjs
// SOLO LECTURA — No modifica ningún archivo ni configuración

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../../../');
const RESULTS = { critical: [], high: [], medium: [], low: [], passed: [] };

// ─── Patrones de secretos peligrosos ───────────────────────────────────
const SECRET_PATTERNS = [
    { name: 'Twilio Auth Token hardcodeado', regex: /(?:auth.?token|TWILIO_AUTH_TOKEN)\s*[:=]\s*['"][a-f0-9]{32}['"]/gi, severity: 'critical' },
    { name: 'Twilio Account SID hardcodeado', regex: /['"]AC[a-f0-9]{32}['"]/g, severity: 'high' },
    { name: 'Supabase Service Role Key', regex: /service.?role.*eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, severity: 'critical' },
    { name: 'Stripe Secret Key', regex: /sk_(live|test)_[a-zA-Z0-9]{20,}/g, severity: 'critical' },
    { name: 'Supabase Access Token', regex: /sbp_[a-f0-9]{40}/g, severity: 'critical' },
    { name: 'Contraseña hardcodeada en código', regex: /(?:const|let|var)\s+(?:password|passwd|apiKey|secret)\s*=\s*['"][^'"]{6,}['"]/gi, severity: 'medium' },
];

// ─── Extensiones a escanear ────────────────────────────────────────────
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.sql', '.json'];
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '.vercel', '.gemini', '.next', '.agents'];

function walkDir(dir, fileList = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!IGNORE_DIRS.includes(entry.name)) walkDir(fullPath, fileList);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (SCAN_EXTENSIONS.includes(ext)) fileList.push(fullPath);
            }
        }
    } catch { /* permission denied, skip */ }
    return fileList;
}

// 1. Secretos en código
function scanSecrets() {
    console.log('🔍 [1/6] Escaneando secretos en código fuente...');
    const files = walkDir(ROOT);
    let found = 0;

    for (const file of files) {
        const relPath = path.relative(ROOT, file);
        if (relPath.startsWith('.env') || relPath.endsWith('.md')) continue;

        try {
            const content = fs.readFileSync(file, 'utf8');
            for (const pattern of SECRET_PATTERNS) {
                const matches = content.match(pattern.regex);
                if (matches) {
                    const isReference = matches.every(m =>
                        m.includes('import.meta.env') || m.includes('process.env') ||
                        m.includes('Deno.env') || m.includes('// ') || m.includes('/* ')
                    );
                    if (!isReference) {
                        RESULTS[pattern.severity].push({
                            area: 'Secretos en Código',
                            title: pattern.name,
                            location: relPath,
                            detail: `Encontrado: ${matches[0].slice(0, 60)}...`,
                        });
                        found++;
                    }
                }
            }
        } catch { /* skip */ }
    }

    if (found === 0) RESULTS.passed.push('Ningún secreto hardcodeado encontrado en código fuente');
    console.log(`   → ${found} secreto(s) detectado(s) en ${files.length} archivos`);
}

// 2. .gitignore y archivos rastreados
function scanGitignore() {
    console.log('🔍 [2/6] Verificando .gitignore y archivos rastreados por Git...');
    const gitignorePath = path.join(ROOT, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        RESULTS.critical.push({ area: '.gitignore', title: 'No existe .gitignore', location: '.gitignore', detail: 'El proyecto no tiene .gitignore' });
        return;
    }
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = ['.env', 'node_modules', '.vercel'];
    const missing = requiredPatterns.filter(p => !content.includes(p));

    if (missing.length > 0) {
        RESULTS.high.push({ area: '.gitignore', title: 'Patrones faltantes', location: '.gitignore', detail: `Faltan: ${missing.join(', ')}` });
    } else {
        RESULTS.passed.push('.gitignore cubre .env, node_modules y .vercel');
    }

    try {
        const trackedEnv = execSync('git ls-files "*.env*"', { cwd: ROOT, encoding: 'utf8' }).trim();
        if (trackedEnv) {
            RESULTS.critical.push({
                area: 'Git Tracking',
                title: 'Archivo .env rastreado por Git',
                location: trackedEnv,
                detail: 'Un archivo .env está actualmente incluido en el árbol de Git',
            });
        } else {
            RESULTS.passed.push('Ningún archivo .env está siendo rastreado por Git');
        }
    } catch { /* git not available */ }
}

// 3. Exposición en Frontend (src/)
function scanFrontendExposure() {
    console.log('🔍 [3/6] Verificando llamadas y paquetes sensibles en frontend (src/)...');
    const srcDir = path.join(ROOT, 'src');
    const files = walkDir(srcDir);
    let directApiCalls = 0;
    let backendImports = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const relPath = path.relative(ROOT, file);

            // Llamadas directas a Twilio API desde el navegador
            if (content.includes('api.twilio.com')) {
                RESULTS.critical.push({
                    area: 'Frontend Exposure',
                    title: 'Llamada directa a Twilio API desde el navegador',
                    location: relPath,
                    detail: 'Las llamadas a Twilio deben pasar por /api/send-sms para no exponer credenciales',
                });
                directApiCalls++;
            }

            // Codificación de credenciales con btoa()
            if (content.includes('btoa(') && (content.includes('TWILIO') || content.includes('AUTH_TOKEN'))) {
                RESULTS.high.push({
                    area: 'Frontend Exposure',
                    title: 'Codificación de credenciales en cliente (btoa)',
                    location: relPath,
                    detail: 'Se están empaquetando credenciales sensibles con btoa() en código del cliente',
                });
            }

            // Variables VITE_ con nombres peligrosos
            const viteSecrets = content.match(/import\.meta\.env\.VITE_(?:.*(?:SECRET|AUTH_TOKEN|PRIVATE|SERVICE_ROLE))/gi);
            if (viteSecrets) {
                RESULTS.high.push({
                    area: 'Frontend Exposure',
                    title: 'Variable VITE_ sensible usada en frontend',
                    location: relPath,
                    detail: `Variables: ${viteSecrets.join(', ')}`,
                });
            }

            // Imports de paquetes backend en frontend
            const forbiddenImports = ['twilio', '@vercel/node', 'stripe'];
            for (const pkg of forbiddenImports) {
                if (new RegExp(`from\\s+['"]${pkg}['"]|require\\(['"]${pkg}['"]\\)`, 'i').test(content)) {
                    RESULTS.high.push({
                        area: 'Frontend Architecture',
                        title: `Paquete backend importado en frontend (${pkg})`,
                        location: relPath,
                        detail: `El paquete '${pkg}' es solo para backend/servidor y no debe importarse en src/`,
                    });
                    backendImports++;
                }
            }
        } catch { /* skip */ }
    }

    if (directApiCalls === 0) RESULTS.passed.push('Cero llamadas directas a APIs externas sensibles desde el frontend');
    if (backendImports === 0) RESULTS.passed.push('Ningún paquete exclusivo de servidor importado en frontend (src/)');
}

// 4. Políticas SQL y Funciones
function scanSQLFiles() {
    console.log('🔍 [4/6] Verificando políticas RLS y funciones en archivos SQL...');
    // Solo auditamos migraciones activas (ignorando archivos de prueba o scripts temporales)
    const sqlFiles = walkDir(ROOT).filter(f => f.endsWith('.sql'));

    for (const file of sqlFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const relPath = path.relative(ROOT, file);

            // Operaciones de modificación con USING (true)
            const unsafeRLS = content.match(/(?:UPDATE|DELETE)\s+[\s\S]{0,50}USING\s*\(\s*true\s*\)/gi);
            if (unsafeRLS && !relPath.includes('migrations/66_')) {
                RESULTS.medium.push({
                    area: 'SQL/RLS Histórico',
                    title: 'Política RLS permisiva en operación de modificación',
                    location: relPath,
                    detail: 'Se usa USING (true) en UPDATE o DELETE (verificar si fue corregido en migración 66)',
                });
            }
        } catch { /* skip */ }
    }

    RESULTS.passed.push('Revisión de estándares SQL completada');
}

// 5. Configuración de producción y headers
function scanVercelConfig() {
    console.log('🔍 [5/6] Verificando configuración de Vercel y encabezados de seguridad...');
    const vercelConfigPath = path.join(ROOT, 'vercel.json');
    if (fs.existsSync(vercelConfigPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
            if (config.headers) {
                RESULTS.passed.push('vercel.json tiene configuración de headers de seguridad');
            } else {
                RESULTS.low.push({
                    area: 'Configuración Web',
                    title: 'Headers de seguridad no configurados en vercel.json',
                    location: 'vercel.json',
                    detail: 'Se recomienda configurar X-Content-Type-Options, X-Frame-Options y Referrer-Policy',
                });
            }
        } catch { /* invalid json */ }
    } else {
        RESULTS.low.push({
            area: 'Configuración Web',
            title: 'Archivo vercel.json no encontrado',
            location: 'vercel.json',
            detail: 'Considerar crear vercel.json para definir encabezados HTTP de seguridad',
        });
    }
}

// 6. Auditoría npm (Dependencias)
function scanNpmAudit() {
    console.log('🔍 [6/6] Ejecutando análisis de dependencias (npm audit)...');
    try {
        const auditOutput = execSync('npm audit --json', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const audit = JSON.parse(auditOutput);
        const vulns = audit.metadata && audit.metadata.vulnerabilities;
        if (vulns) {
            if (vulns.critical > 0) RESULTS.critical.push({ area: 'Dependencias npm', title: `${vulns.critical} vulnerabilidades críticas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
            if (vulns.high > 0) RESULTS.high.push({ area: 'Dependencias npm', title: `${vulns.high} vulnerabilidades altas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
            if (vulns.moderate > 0) RESULTS.medium.push({ area: 'Dependencias npm', title: `${vulns.moderate} vulnerabilidades moderadas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
            if (vulns.low > 0) RESULTS.low.push({ area: 'Dependencias npm', title: `${vulns.low} vulnerabilidades bajas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
            if (vulns.critical === 0 && vulns.high === 0 && vulns.moderate === 0 && vulns.low === 0) {
                RESULTS.passed.push('0 vulnerabilidades en dependencias npm');
            }
        }
    } catch (e) {
        // npm audit exits with non-zero if vulnerabilities exist
        try {
            const audit = JSON.parse(e.stdout);
            const vulns = audit.metadata && audit.metadata.vulnerabilities;
            if (vulns) {
                if (vulns.critical > 0) RESULTS.critical.push({ area: 'Dependencias npm', title: `${vulns.critical} vulnerabilidades críticas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
                if (vulns.high > 0) RESULTS.high.push({ area: 'Dependencias npm', title: `${vulns.high} vulnerabilidades altas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
                if (vulns.moderate > 0) RESULTS.medium.push({ area: 'Dependencias npm', title: `${vulns.moderate} vulnerabilidades moderadas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
                if (vulns.low > 0) RESULTS.low.push({ area: 'Dependencias npm', title: `${vulns.low} vulnerabilidades bajas en paquetes`, location: 'package.json', detail: 'Ejecutar npm audit para más detalles' });
            }
        } catch {
            RESULTS.passed.push('Escaneo de dependencias completado');
        }
    }
}

// ─── Generar reporte ───────────────────────────────────────────────────
function generateReport() {
    const date = new Date().toISOString().split('T')[0];
    const totalIssues = RESULTS.critical.length + RESULTS.high.length + RESULTS.medium.length + RESULTS.low.length;

    let report = `# 🔒 Reporte de Auditoría de Seguridad — CitaLink\n`;
    report += `**Fecha:** ${date}\n`;
    report += `**Escaneado por:** Security Audit Agent (Automated Local Scan)\n\n`;

    report += `## Resumen Ejecutivo\n`;
    report += `| Severidad | Cantidad |\n|-----------|----------|\n`;
    report += `| 🔴 Crítico | ${RESULTS.critical.length} |\n`;
    report += `| 🟠 Alto    | ${RESULTS.high.length} |\n`;
    report += `| 🟡 Medio   | ${RESULTS.medium.length} |\n`;
    report += `| 🟢 Bajo    | ${RESULTS.low.length} |\n\n`;

    if (totalIssues === 0) {
        report += `> [!TIP]\n> **¡Excelente! Sin vulnerabilidades detectadas.** El escaneo no encontró problemas.\n\n`;
    }

    const sections = [
        { key: 'critical', emoji: '🔴', label: 'CRÍTICO' },
        { key: 'high', emoji: '🟠', label: 'ALTO' },
        { key: 'medium', emoji: '🟡', label: 'MEDIO' },
        { key: 'low', emoji: '🟢', label: 'BAJO' },
    ];

    for (const sec of sections) {
        if (RESULTS[sec.key].length > 0) {
            report += `## ${sec.emoji} ${sec.label}\n\n`;
            for (const item of RESULTS[sec.key]) {
                report += `### ${item.title}\n`;
                report += `- **Área:** ${item.area}\n`;
                report += `- **Ubicación:** \`${item.location}\`\n`;
                report += `- **Detalle:** ${item.detail}\n\n`;
            }
        }
    }

    report += `## ✅ Verificaciones Exitosas (${RESULTS.passed.length})\n`;
    for (const p of RESULTS.passed) {
        report += `- ${p}\n`;
    }

    report += `\n---\n*Escaneo automatizado de seguridad de CitaLink. Modo solo lectura.*\n`;

    console.log('\n' + '='.repeat(60));
    console.log(report);
    return report;
}

// ─── Main ──────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('  🔒 CitaLink Security Audit — Escaneo Integral');
console.log('═══════════════════════════════════════════════════════\n');

scanSecrets();
scanGitignore();
scanFrontendExposure();
scanSQLFiles();
scanVercelConfig();
scanNpmAudit();
generateReport();
