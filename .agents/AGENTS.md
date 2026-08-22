# Reglas de CitaLink

- **Idioma**: Responder y explicar siempre en español.
- **Automatización de Deploy/Push**: Cuando el usuario solicite un "git push", "deploy" o similar, el asistente debe:
  1. Ejecutar `npm run build` para verificar que compile correctamente.
  2. Hacer `git add .` y `git commit -m "<mensaje de commit adecuado>"` para guardar los cambios locales.
  3. Hacer `git push` a GitHub.
  4. Realizar el despliegue a Vercel con `vercel --prod --yes` si es necesario, siguiendo el flujo de [.agent/workflows/deploy.md](file:///c:/Users/ADMIN/OneDrive/Desktop/CITA-LINK%20SASS/.agent/workflows/deploy.md).
- **Imágenes — Optimización Safari/iOS**: Toda etiqueta `<img>` que se cree o modifique debe incluir siempre:
  - `decoding="async"` — Para que Safari no congele la pantalla mientras decodifica la imagen.
  - `loading="lazy"` — Para imágenes fuera de la vista inicial (below the fold). No aplicar en imágenes del hero/splash que necesitan cargarse inmediatamente.
- **Iconos Genéricos de Servicios (Multi-Rubro)**:
  - Usar siempre `Sparkles` ✨ de `lucide-react` para representar servicios, catálogo de citas y tarjetas de agenda.
  - Usar `Scissors` únicamente dentro de selectores explícitos donde el usuario elija la categoría específica "Barbería".
- **Bundling & Chunks en Vite (`vite.config.ts`)**:
  - Mantener siempre la división modular de vendor chunks (`vendor-react`, `vendor-supabase`, `vendor-charts`, `vendor-pdf-ocr`, `vendor-i18n`, `vendor-misc`).
  - Nunca empaquetar todo `node_modules` en un único archivo `vendor.js` monolítico para permitir descargas paralelas en redes móviles.
- **Rendimiento CSS & Scroll iOS**:
  - Nunca usar `background-attachment: fixed` en `html`, `body` o contenedores con scroll (causa repaints continuos en Safari iOS).
  - Los fondos degradados fijos deben ir en `body::before` con aceleración GPU (`will-change: transform`, `transform: translateZ(0)`).
- **Control de Zoom y DOM (`useAppZoom.ts`)**:
  - Siempre detectar iOS al inicio de la función antes de manipular estilos. En iOS/iPadOS no aplicar CSS `zoom` para prevenir dobles reflows y congelamientos.
- **Robustez de Carga & SplashScreen**:
  - Todo fallback de tiempo (`safetyTimer`) o bloque `catch`/`finally` en la inicialización de sesión debe garantizar la limpieza de `loadingAuth`, `loadingTenant` y `loadingConfig` para evitar estados de SplashScreen infinito.
  - El Service Worker (`public/sw.js`) debe mantener la estrategia *Network-First* en navegación sin pre-cachear `index.html`.
