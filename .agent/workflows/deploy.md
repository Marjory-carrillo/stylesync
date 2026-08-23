---
description: Deploy completo - build, push, y deploy a Vercel + Supabase Edge Functions
---

# Deploy Completo CitaLink

## Pre-requisitos
- Vercel CLI instalado globalmente (`npm install -g vercel`)
- Logueado en Vercel con `marjory-carrillo` (carrillomarjory7@gmail.com)
- Proyecto vinculado: `vercel link --project citalink --yes`

## Pasos (Pipeline Rápido en 1 Solo Paso)

// turbo-all

1. Si se modificaron Edge Functions de Supabase, deployarlas primero:
```powershell
npx supabase functions deploy <nombre-funcion> 2>&1
```
Las funciones disponibles: `verify-otp`, `notify-admin`, `send-sms`

2. Ejecutar el pipeline consolidado (Git add, Git commit, Git push y Vercel deploy en un solo paso):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Message "<mensaje descriptivo>"
```
O directamente:
```powershell
git add . ; git commit -m "<mensaje descriptivo>" ; git push origin main ; vercel --prod --yes
```

3. Verificar que el deploy en Vercel muestre `Production:` y quede en estado `READY`.

4. Recordar al usuario hacer **Ctrl+Shift+R** (hard refresh) en el navegador para limpiar caché.

## Notas Importantes
- La cuenta de Vercel es `marjory-carrillo` (carrillomarjory7@gmail.com)
- El proyecto en Vercel se llama `citalink`
- URL de producción: `https://cita-link.vercel.app`
- Si Vercel CLI no está autenticado, correr `vercel login` y autorizar con la cuenta correcta
- Si el build falla por variables no usadas (TS6133), agregar `// @ts-ignore` arriba de la línea
- Supabase project ref: ver `supabase/.temp/project-ref`
