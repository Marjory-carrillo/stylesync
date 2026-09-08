---
name: security-audit
description: >-
  Activa esta skill cuando el usuario pida "escanear seguridad", "auditoría de seguridad",
  "buscar vulnerabilidades", "revisar seguridad", "security audit", "escanea citalink",
  "detectar riesgos" o similar. Ejecuta un análisis integral de seguridad sin modificar
  ningún archivo ni ejecutar comandos destructivos. Solo reporta hallazgos.
---

# Security Audit — Escáner de Vulnerabilidades de CitaLink

Esta skill realiza una auditoría de seguridad integral y no-destructiva del proyecto CitaLink.
**NUNCA modifica archivos, bases de datos ni configuraciones.** Solo analiza y reporta.

---

## 🔒 Principios de Operación

1. **Solo Lectura**: No ejecutar ningún comando que modifique archivos, base de datos o configuración.
2. **Clasificación Clara**: Cada hallazgo se clasifica como 🔴 **CRÍTICO**, 🟠 **ALTO**, 🟡 **MEDIO** o 🟢 **BAJO**.
3. **Reporte Estructurado**: Al finalizar, generar un artefacto markdown con todos los hallazgos.
4. **Contexto de Negocio**: Considerar que CitaLink es una app SaaS multi-tenant donde clientes anónimos agendan citas.

---

## 📋 Checklist de Auditoría (7 Áreas)

### 1. Secretos Expuestos en Código Fuente
Buscar en `src/`, `api/`, `supabase/functions/` y archivos raíz:
- Tokens, API keys, contraseñas hardcodeadas (no en variables de entorno)
- Variables `VITE_` que contengan secretos (Auth Tokens, Service Role keys, etc.)
- Credenciales en comentarios o archivos de debug

```bash
# Patrones a buscar con grep:
- Literales de API keys: /sk_live_|sk_test_|AC[a-f0-9]{32}|sbp_|service_role|secret/i
- Tokens JWT hardcodeados: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/
- Variables VITE_ peligrosas: /VITE_.*(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE)/i
```

### 2. Historial de Git (Fugas Pasadas)
Revisar si alguna vez se subieron secretos al repositorio:
```bash
git log --all --full-history --summary -- "**.env*"
git log -S "service_role" --name-only --oneline
git log -S "sk_live_" --name-only --oneline
git log -S "AUTH_TOKEN" --name-only --oneline
```

### 3. Producción — Bundle JavaScript Público
Descargar el JS principal de `https://www.citalink.app/` y verificar:
- Que NO contenga Account SIDs de Twilio (`AC...`)
- Que NO contenga Auth Tokens ni claves privadas
- Que solo contenga JWTs con role `anon` (nunca `service_role`)
- Que NO tenga URLs de APIs internas con credenciales

### 4. Supabase — Base de Datos
Consultar vía Supabase Management API (solo lectura):
```
GET /v1/projects/{ref}/advisors/security   → Security Lints
GET /v1/projects/{ref}/advisors/performance → Performance Lints
```
Verificar:
- Políticas RLS con `USING (true)` en operaciones de escritura
- Funciones `SECURITY DEFINER` sin validación de tenant
- Extensiones en esquema `public` con permisos abiertos
- `search_path` no definido en funciones
- Vistas sin `security_invoker`

### 5. Dependencias npm (Vulnerabilidades Conocidas)
```bash
npm audit --json
```
Clasificar por severidad: critical, high, moderate, low.

### 6. Configuración de Servidor (Headers y CORS)
Verificar headers de seguridad en producción:
```bash
# Fetch headers de www.citalink.app
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy
```
Verificar que archivos sensibles NO sean accesibles:
- `/.env`, `/.env.local`, `/.git/HEAD`, `/.git/config`

### 7. Archivos Sensibles en el Repositorio
Verificar que `.gitignore` cubra:
- `.env`, `.env.local`, `.env*.local`
- `node_modules/`
- `.vercel/`
- Archivos de debug con tokens

---

## 📊 Formato del Reporte

Generar un artefacto `security_audit_report.md` con el siguiente formato:

```markdown
# 🔒 Reporte de Auditoría de Seguridad — CitaLink
**Fecha:** {fecha}
**Escaneado por:** Security Audit Agent

## Resumen Ejecutivo
| Severidad | Cantidad |
|-----------|----------|
| 🔴 Crítico | X |
| 🟠 Alto    | X |
| 🟡 Medio   | X |
| 🟢 Bajo    | X |

## Hallazgos Detallados

### 🔴 CRÍTICO — [Título del hallazgo]
- **Ubicación:** [archivo o servicio]
- **Descripción:** [qué se encontró]
- **Impacto:** [qué podría pasar si se explota]
- **Recomendación:** [cómo solucionarlo]

(repetir para cada hallazgo)

## ✅ Verificaciones Exitosas
- [Lista de controles que pasaron correctamente]
```

---

## ⚠️ Restricciones Absolutas

- **NUNCA** ejecutar SQL contra Supabase (ni siquiera SELECT).
- **NUNCA** modificar archivos del proyecto.
- **NUNCA** hacer `git commit`, `git push` ni deploy.
- **NUNCA** rotar tokens o cambiar configuraciones.
- Solo usar herramientas de lectura: `grep_search`, `find_by_name`, `view_file`, `run_command` (solo comandos read-only como `git log`, `npm audit`, `curl`).
- Las consultas a Supabase Management API son de solo lectura (endpoints GET de advisors).
