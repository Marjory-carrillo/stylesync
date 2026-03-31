---
description: Deploy completo - build, push, y deploy a Vercel + Supabase Edge Functions
---

# Deploy Completo CitaLink

## Pre-requisitos
- Vercel CLI instalado globalmente (`npm install -g vercel`)
- Logueado en Vercel con `marjory-carrillo` (carrillomarjory7@gmail.com)
- Proyecto vinculado: `vercel link --project citalink --yes`

## Pasos

// turbo-all

1. Verificar que el build pasa localmente:
```powershell
npm run build 2>&1 | Select-Object -Last 15
```

2. Si hay errores de TypeScript, corregirlos antes de continuar.

3. Si se modificaron Edge Functions de Supabase, deployarlas primero:
```powershell
npx supabase functions deploy <nombre-funcion> 2>&1
```
Las funciones disponibles: `verify-otp`, `notify-admin`, `send-sms`

4. Commit y push a GitHub:
```powershell
git add . ; git commit -m "<mensaje descriptivo>" ; git push
```

5. Deploy a Vercel producción:
```powershell
vercel --prod --yes 2>&1
```

6. Verificar que el deploy fue exitoso (buscar `✅ Production:` en el output).

7. Recordar al usuario hacer **Ctrl+Shift+R** (hard refresh) en el navegador para limpiar caché.

## Notas Importantes
- La cuenta de Vercel es `marjory-carrillo` (carrillomarjory7@gmail.com)
- El proyecto en Vercel se llama `citalink`
- URL de producción: `https://cita-link.vercel.app`
- Si Vercel CLI no está autenticado, correr `vercel login` y autorizar con la cuenta correcta
- Si el build falla por variables no usadas (TS6133), agregar `// @ts-ignore` arriba de la línea
- Supabase project ref: ver `supabase/.temp/project-ref`
