---
description: Diagnóstico y Reparación de Envíos en Twilio y WhatsApp
---

# Workflow de Diagnóstico de Twilio WhatsApp

Este workflow detalla los pasos a seguir cuando los mensajes de WhatsApp en Twilio se muestran como "SENT" pero no llegan al dispositivo, o si la API local marca error al procesar las plantillas usando Edge Functions.

## 1. Verificación de Formato de Número para México (+52)

Si el mensaje aparece como "Sent" en Twilio pero no se entrega, el problema número 1 a descartar es la adición indebida del dígito `1` después del código de país `+52`.
Actualmente Meta rechaza la entrega o causa problemas de enrutamiento con Twilio si le envías `whatsapp:+521...` a un perfil de WhatsApp configurado sin él.

1. **Revisa la función normalizadora:**
   Los números a 10 dígitos deben formatearse como `whatsapp:+52XXXXXXXXXX`.
   Ejemplo de función correcta (TypeScript):
   ```typescript
   function normalizeToWA(phone: string): string {
       const digits = phone.replace(/\D/g, '');
       // Si trae el 521, remover el 1
       if (digits.startsWith('521') && digits.length === 13) return `whatsapp:+52${digits.slice(3)}`;
       if (digits.startsWith('52') && digits.length === 12) return `whatsapp:+${digits}`;
       return `whatsapp:+52${digits.slice(-10)}`;
   }
   ```
2. Asegúrate de compilar y hacer un redeploy de la *Edge Function* tras esta modificación.

## 2. Validación de SID de Template (Error 21656)

El error `The ContentVariables you are using are not valid` (`21656`) suele indicar que el SID asignado no concuerda con las variables proporcionadas, o bien, hubo una discrepancia o regeneración del SID de contenido en Twilio tras una modificación.

### Extracción Segura de SIDs mediante PowerShell
Este paso te permitirá ver en tiempo real los nombres y SIDs aprobados. Ejecuta lo siguiente desde la terminal:

```powershell
// turbo
$TWILIO_ACCOUNT_SID = $env:VITE_TWILIO_ACCOUNT_SID   # Lee de tu .env local
$TWILIO_AUTH_TOKEN  = $env:VITE_TWILIO_AUTH_TOKEN     # Lee de tu .env local
$credentials = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($TWILIO_ACCOUNT_SID):$($TWILIO_AUTH_TOKEN)"))
$res = Invoke-RestMethod -Uri "https://content.twilio.com/v1/Content?PageSize=100" -Method Get -Headers @{ "Authorization" = "Basic $credentials" } -UseBasicParsing
$res.contents | ForEach-Object { 
  $vars = if ($_.variables) { $_.variables.psobject.properties.name -join "," } else { "none" }
  "$($_.friendly_name)|SID:$($_.sid)|VARS:$vars"
}
```

3. El comando te listará todos los templates con variables, asegúrate de sobreescribir los SIDs en tu código (ejemplo: `notify-admin/index.ts`).

## 3. Discrepancia del Orden de "ContentVariables"

Asegúrate de comprobar que el objeto JSON del `ContentVariables` concuerda de forma idéntica con Twilio:
- Todas las variables existen (ej. `{'1': 'Nombre', '2': 'Servicio'}`).
- No envies números u objetos si se espera un string (Usa `JSON.stringify` limpio).
- Evita pasar variables adicionales no documentadas o dejar variables en `undefined` u omitidas.

## 4. Comprobación y Logs
1. Desplegar Edge Functions:
   `npx supabase functions deploy notify-admin --project-ref [TUNOMBREDEPROYECTO]`
2. Supervisar:
   `npx supabase functions logs notify-admin --project-ref [TUNOMBREDEPROYECTO]`
   
Si el problema se repite, este flow te permite garantizar el rastreo de números, la existencia del SID real activo, y la validación de la carga útil a transferir por la Content API.
