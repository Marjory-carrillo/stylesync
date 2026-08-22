---
name: parallel-subagents
description: >-
  Activa esta skill cuando el usuario pida ejecutar tareas en paralelo con subagentes,
  o cuando diga "pon a trabajar subagentes", "lanza subagentes", "hazlo en paralelo",
  "divide el trabajo", "modo equipo" o similar. Define la estrategia para dividir tareas
  grandes en subagentes concurrentes que trabajan simultáneamente.
---

# Subagentes en Paralelo — Skill de CitaLink

Cuando el usuario solicite trabajar con subagentes en paralelo, sigue esta estrategia:

---

## 1. Análisis y División de Tareas

Antes de lanzar subagentes, analiza la tarea y divídela en bloques **independientes**:

- Cada subagente debe poder trabajar **sin depender** del resultado de otro.
- Agrupa por **archivo o componente** para evitar conflictos de edición.
- Identifica las tareas que **sí dependen** entre sí y resérvalas para ejecución secuencial.

### Criterios para dividir:
| Tipo de Tarea | Subagentes Recomendados |
|---|---|
| Cambios en múltiples archivos independientes | 1 subagente por archivo o grupo de archivos |
| Investigación + Implementación | 1 subagente `research` para investigar, 1 subagente `self` para implementar |
| Refactoring masivo (ej: reemplazar ícono en 15 archivos) | 1-2 subagentes `self` divididos por carpeta |
| Optimización (ej: agregar atributos a 30 imágenes) | 1 subagente `self` con instrucciones claras de grep + edit |
| Tests + Implementación | 1 subagente implementa, otro escribe tests |

---

## 2. Configuración de Subagentes

### Tipos disponibles:
- **`self`**: Tiene TODAS las herramientas (lectura, escritura, comandos, subagentes propios). Úsalo para tareas de implementación.
- **`research`**: Solo herramientas de LECTURA (grep, view_file, search_web). Úsalo para investigación y auditoría.

### Modelos recomendados:
- **`inherit`** (default): Usa el mismo modelo del agente padre. Para tareas complejas.
- **`flash`**: Modelo más rápido y ligero. Para tareas simples (búsqueda, lectura, reemplazos mecánicos).
- **`pro`**: Modelo más potente. Para tareas que requieren razonamiento profundo o refactors complejos.

---

## 3. Formato del Prompt para Subagentes

Cada subagente debe recibir un prompt **ultra-específico** con:

1. **Ruta exacta del proyecto**: `c:/Users/ADMIN/OneDrive/Desktop/CITA-LINK SASS`
2. **Lista explícita de archivos** a modificar o investigar.
3. **Instrucción paso a paso** de qué hacer en cada archivo.
4. **Criterios de éxito** (qué buscar, qué reemplazar, qué verificar).
5. **Idioma**: Siempre responder en español.
6. **Reporte final**: Pedir un resumen de lo que se hizo al terminar.

### Ejemplo de prompt para subagente:
```
En el proyecto c:/Users/ADMIN/OneDrive/Desktop/CITA-LINK SASS:

1. Busca todas las etiquetas <img en los archivos .tsx bajo src/
2. Para cada <img> que NO tenga decoding="async", agrégalo.
3. También agrega loading="lazy" a las que estén en modales o listas.
4. Responde en español.
5. Al terminar, envíame un resumen con: archivos editados, cantidad de <img> actualizadas.
```

---

## 4. Lanzamiento

Usa `invoke_subagent` con un array de subagentes:

```
invoke_subagent con Subagents = [
  { TypeName: "self", Role: "Optimizador de imágenes", Prompt: "...", Model: "pro" },
  { TypeName: "research", Role: "Auditor de rendimiento", Prompt: "...", Model: "flash" },
  { TypeName: "self", Role: "Refactor de componentes", Prompt: "...", Model: "inherit" }
]
```

---

## 5. Mientras los Subagentes Trabajan

- **NO hacer polling** — el sistema te notifica automáticamente cuando terminan.
- Puedes **seguir trabajando** en tareas independientes mientras esperan.
- Si necesitas verificar estado, usa `manage_subagents` con Action `list`.

---

## 6. Después de que Terminen

1. **Revisar resultados** de cada subagente.
2. **Ejecutar `npm run build`** para verificar que todo compile.
3. **Resolver conflictos** si dos subagentes tocaron el mismo archivo (raro si se dividió bien).
4. **Informar al usuario** en español con un resumen consolidado.

---

## 7. Reglas de CitaLink para Subagentes

Los subagentes deben respetar las mismas reglas del proyecto:
- **Idioma**: Español siempre.
- **Imágenes**: Toda `<img>` debe incluir `decoding="async"` y `loading="lazy"` (excepto hero/splash).
- **Deploy**: Seguir el flujo build → git add → git commit → git push → vercel --prod --yes.
- **Iconos**: Usar `Sparkles` en vez de `Scissors` para servicios genéricos.
