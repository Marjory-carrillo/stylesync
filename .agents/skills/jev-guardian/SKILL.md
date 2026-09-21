---
name: jev-guardian
description: Guardián de seguridad con Jev (TypeSafe AI) que evalúa la intención del usuario y el riesgo de rotura de código antes de aplicar cualquier cambio.
---

# Skill: Guardián Jev (TypeSafe AI) & Bucle de Auto-Corrección

Esta skill define el protocolo obligatorio de evaluación previa y refinamiento iterativo con el modelo **Jev (TypeSafe AI)** antes de realizar cualquier modificación de código en CitaLink.

## Protocolo Obligatorio del Bucle Jev

Cada vez que el usuario solicite un cambio o arreglo:

### 1. Análisis y Diseño de la Propuesta (v1)
- El asistente analiza la solicitud del usuario y diseña la solución técnica inicial.

### 2. Evaluación con Jev
- Se ejecuta la evaluación en tiempo real con Jev:
  ```powershell
  node .\scripts\jev_evaluate.mjs "<petición del usuario>" "<propuesta técnica>" "archivo1.tsx" "archivo2.ts"
  ```

### 3. Bucle de Auto-Corrección con Jev (*Iterative Refinement Loop*)
- El asistente **analiza rigurosamente la respuesta de Jev**:
  * Si `will_break_code > 0.20` o `risk_level > 0` (Medio, Alto o Crítico) o `needs_prior_warning === true`:
    * El asistente detecta qué riesgo o efecto colateral identificó Jev.
    * **Modifica y blinda la propuesta técnica** (ej. aislando componentes, agregando salvaguardas, evitando tocar APIs que reinicien estados).
    * **Vuelve a enviar la propuesta mejorada a Jev** para una nueva evaluación.
  * Este ciclo se repite sucesivamente (v1 -> v2 -> v3) hasta que Jev certifique que el arreglo es seguro, calibrado y con riesgo mínimo.

### 4. Entrega del Dictamen Certificado al Usuario
- **ANTES de tocar una sola línea de código**, el asistente entrega al usuario:
  * 🎯 **Intención Detectada**: (Confirmación de lo que el usuario realmente busca).
  * 🔄 **Iteraciones realizadas**: Cuántas revisiones tomó blindar la propuesta con Jev.
  * 🛡️ **Dictamen Final de Jev**: (Probabilidad de rotura mínima, severidad baja, impacto en APIs externas controlado).
  * 📝 **Plan de Acción Blindado**: Los cambios exactos que se aplicarán.

### 5. Confirmación y Ejecución
- Con la aprobación del usuario, se aplica el código ya validado y verificado por Jev.
