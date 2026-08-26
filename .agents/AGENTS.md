# Reglas de CitaLink

- **Idioma**: Responder y explicar siempre en español.
- **Automatización de Deploy/Push (Fast Deploy en Segundo Plano)**: Cuando el usuario solicite un "git push", "deploy", "sube los cambios" o similar, el asistente debe ejecutar el pipeline consolidado en un solo paso en segundo plano:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Message "<mensaje de commit adecuado>"
  ```
  O la secuencia encadenada: `git add . ; git commit -m "<mensaje>" ; git push origin main ; vercel --prod --yes`.
  Vercel compila en la nube en ~9-18 segundos, ejecutándose de forma asíncrona en segundo plano y notificando al usuario inmediatamente cuando la URL de producción (`www.citalink.app`) esté lista y activa.
- **Imágenes — Optimización Safari/iOS**: Toda etiqueta `<img>` que se cree o modifique debe incluir siempre:
  - `decoding="async"` — Para que Safari no congele la pantalla mientras decodifica la imagen.
  - `loading="lazy"` — Para imágenes fuera de la vista inicial (below the fold). No aplicar en imágenes del hero/splash que necesitan cargarse inmediatamente.
- **Iconos Genéricos de Servicios (Multi-Rubro)**:
  - Usar siempre `Sparkles` ✨ de `lucide-react` para representar servicios, catálogo de citas y tarjetas de agenda.
  - Usar `Scissors` únicamente dentro de selectores explícitos donde el usuario elija la categoría específica "Barbería".
- **Bundling & Chunks en Vite (`vite.config.ts`)**:
  - Mantener el empaquetado de `node_modules` en un chunk `vendor` seguro para evitar bloqueos por dependencias circulares en React (`React.useState undefined`).
- **Rendimiento CSS & Scroll iOS**:
  - Nunca usar `background-attachment: fixed` en `html`, `body` o contenedores con scroll (causa repaints continuos en Safari iOS).
  - Los fondos degradados fijos deben ir en `body::before` con aceleración GPU (`will-change: transform`, `transform: translateZ(0)`).
- **Control de Zoom y DOM (`useAppZoom.ts`)**:
  - Escala unificada al 85% (`0.85`) en `document.documentElement` con `minHeight: 100vh` para todas las plataformas (Android, iOS Safari y Escritorio).
- **Robustez de Carga & SplashScreen**:
  - Todo fallback de tiempo (`safetyTimer`) o bloque `catch`/`finally` en la inicialización de sesión debe garantizar la limpieza de `loadingAuth`, `loadingTenant` y `loadingConfig` para evitar estados de SplashScreen infinito.
  - El Service Worker (`public/sw.js`) debe mantener la estrategia *Network-First* en navegación sin pre-cachear `index.html`.
