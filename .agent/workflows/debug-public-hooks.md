---
description: Diagnóstico de fallos silenciosos en Hooks (Zustand/Auth) y payloads HTTP en Edge Functions
---

# 🔍 Skill: Depuración de Fallos Silenciosos en Hooks Públicos y Webhooks

Esta guía documenta la resolución de un problema crítico que tomaba días identificar: **la pérdida silenciosa de datos desde páginas públicas (clientes anonimos) hacia Edge Functions**.

## 🚨 El Problema (Síntoma)
- El cliente daba clic a un botón en el FrontEnd y el proceso de éxito en pantalla finalizaba.
- En Twilio NO había ningún registro de mensaje procesado (ni siquiera error `failed`).
- Al revisar Edge Functions o el código parecía funcional. 
- Al ejecutar comandos aislados de POST la Edge Function funcionaba perfecto.

## 🕵️‍♂️ Causa Raíz (Análisis Forense)
1. **`JSON.stringify` ignora valores `undefined`**: La variable `admin_phone` nunca viajaba en el Body HTTP porque evaluaba a `undefined`.
2. **Dependencias Fantasma de Sesión**: La función encargada de traer los datos locales (`useTenantData()`) internamente jalaba el `tenantId` de la sesión del usuario (`useAuthStore()`). Al ser una página pública (`Booking.tsx`), el cliente NO está logueado, por ende `tenantId` era `null`.
3. **El Estado vacío**: Al no tener ID, el hook devolvía `null` instantáneamente y dejaba todas las constantes de configuración (como teléfono del admin) vacías.
4. **Edge Function "No-Crash"**: La propia Edge Function intentaba buscar en su Base de Datos local el número perdido al no recibirlo, pero fallaba (por falta de tokens o Timeouts) y devolvía `{ success: false, error: 'No phone' }` **ocultándolo de los logs del sistema del FrontEnd debido a que la Promesa del `fetch` estaba atada a de tipo Fire-And-Forget (`.catch(() => {})`)**.

## 🛠️ Procedimiento de Solución Rápida
Si una variable de la base de datos se pierde al enviarse hacia Edge Functions/Supabase:

1. **Revisa las dependencias del Hook en React**: 
   Abre el origen del Hook (`src/lib/store/queries/useAlgo.ts`).
   Observa si pide: `const { tenantId } = useAuthStore();`.
   **Solución**: Cambia la firma del Hook para que acepte un ID manual como "override":
   ```typescript
   export const useAlgo = (overrideTenantId?: string) => {
       const userTenantId = useAuthStore(state => state.tenantId);
       const tenantId = overrideTenantId || userTenantId;
       // ...
   }
   ```
2. **Envía explícitamente el parámetro en componentes públicos**:
   En el componente `Booking.tsx` ahora invoca:
   `const { data } = useTenantData(tenant_id_de_la_url);`
3. **Simula el Tráfico de Red (Payload Exacto)**: 
   Nunca simules peticiones manuales con toda la data rellena si estás depurando fallos silenciosos. Haz un volcado de red (`console.log(payload)`) o revisa la pestaña de Network del Browser. Si falta un campo en el JSON final, ¡es problema de estado local!
4. **Fallas en Fallbacks de Edge Functions**:
   El comando `supabase.from('table').single()` devolverá `error` si no encuentra resultados. ¡Siempre verifica el `tenantError` en la consola antes de forzar validaciones silenciosas!
