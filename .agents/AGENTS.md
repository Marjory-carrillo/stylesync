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
