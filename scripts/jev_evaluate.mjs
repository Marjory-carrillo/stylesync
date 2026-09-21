// scripts/jev_evaluate.mjs
// Motor de evaluación de impacto y guardián con Jev (TypeSafe AI)
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.TYPESAFE_API_KEY || 'apikey_270f95de7e42c7e4ae0840be673896d4a32_209cba121c3f591aa36b91298a1b7d01aeb3bfaf91f7e4f887f8d7079a7084e1';

export async function evaluateWithJev({ userPrompt, proposedChange, affectedFiles = [] }) {
  const state = `[PETICIÓN DEL USUARIO]:
"${userPrompt}"

[PROPUESTA DE SOLUCIÓN / CAMBIO TÉCNICO]:
"${proposedChange}"

[ARCHIVOS O MÓDULOS INVOLUCRADOS]:
${affectedFiles.length > 0 ? affectedFiles.join(', ') : 'No especificados'}`;

  const payload = {
    state,
    model: 'jev-latest',
    questions: {
      user_intent: {
        type: 'choice',
        instructions: '¿Cuál es la intención primaria y real del usuario?',
        criteria: {
          bugfix: 'Corregir un error, fallo técnico o comportamiento no deseado',
          feature: 'Añadir nueva funcionalidad o extender capacidades',
          ui_tweak: 'Ajuste visual, estilos, texto o diseño sin alterar lógica de negocio',
          external_config: 'Ajuste en servicios externos (WhatsApp Meta, Stripe, Supabase)',
          refactor: 'Reestructuración o limpieza de código existente'
        }
      },
      will_break_code: {
        type: 'noul',
        instructions: '¿Existe riesgo de que esta propuesta rompa código existente, contratos de API, dependencias circulares o flujos en producción?',
        criteria: {
          true: 'Hay riesgo de romper pantallas, dependencias, compilación o flujos activos',
          false: 'Es un cambio aislado, seguro y sin efectos secundarios destructivos'
        }
      },
      affects_external_services: {
        type: 'noul',
        instructions: '¿Afecta servicios externos críticos (Meta Cloud API, Twilio, Stripe, Supabase RLS/Auth)?',
        criteria: {
          true: 'Modifica llamadas, tokens, plantillas en revisión o políticas RLS externas',
          false: 'Es un cambio exclusivamente interno de la aplicación'
        }
      },
      risk_level: {
        type: 'score',
        instructions: '¿Cuál es el nivel general de riesgo técnico de este cambio?',
        criteria: ['Bajo (Seguro)', 'Medio (Requiere atención)', 'Alto (Peligro de regresión)', 'Crítico (Puede tumbar producción)']
      },
      needs_prior_warning: {
        type: 'noul',
        instructions: '¿Se le debe advertir al usuario sobre efectos secundarios o tiempos de espera antes de aplicar el cambio?',
        criteria: {
          true: 'Requiere advertencia obligatoria previa (ej. plantillas en revisión, pérdida de datos)',
          false: 'No requiere advertencias especiales'
        }
      }
    }
  };

  try {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      success: true,
      raw: data,
      answers: data.answers
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecución directa desde CLI
if (process.argv[1] && process.argv[1].endsWith('jev_evaluate.mjs')) {
  const userPrompt = process.argv[2] || 'Prueba de cambio';
  const proposedChange = process.argv[3] || 'Modificar componente';
  const affectedFiles = process.argv.slice(4);

  evaluateWithJev({ userPrompt, proposedChange, affectedFiles }).then(res => {
    console.log(JSON.stringify(res, null, 2));
  });
}
