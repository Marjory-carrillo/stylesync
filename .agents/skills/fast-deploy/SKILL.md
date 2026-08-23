---
name: fast-deploy
description: >-
  Activa esta skill cuando el usuario pida "haz deploy", "deploy", "git push", "sube cambios",
  "despliega", "actualiza producción" o similar. Ejecuta el pipeline ultra-rápido consolidado de
  guardado en Git, push a GitHub y despliegue instantáneo a Vercel en un solo paso optimizado.
---

# Fast Deploy — Pipeline Ultra-Rápido de CitaLink

Esta skill optimiza al máximo el tiempo de despliegue a producción eliminando redundancias y pasos bloqueantes locales.

---

## ⚡ Estrategia de Ejecución en 1 Solo Paso

En lugar de correr `npm run build` localmente (que en Windows tarda 2 minutos analizando tipos) y luego múltiples comandos y timers individuales, ejecuta el script consolidado o la secuencia encadenada:

### Comando de Despliegue Directo:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Message "<mensaje de commit claro y conciso>"
```

O en una sola línea encadenada:
```powershell
git add . ; git commit -m "<mensaje de commit>" ; git push origin main ; vercel --prod --yes
```

---

## 🚀 Ventajas del Fast Deploy
1. **Compilación en la Nube (3x más rápida)**: Vercel ejecuta `tsc -b && vite build` en servidores Linux de alto rendimiento en ~9 segundos.
2. **Cero Esperas Redundantes**: No se hacen compilaciones dobles (local + nube).
3. **Paso Único**: Un solo comando encadenado ejecuta Git add, Git commit, Git push y Vercel deploy.
4. **Verificación Inmediata**: Vercel devuelve el estado `READY` y la URL pública `https://www.citalink.app`.
