# Reglas de CitaLink

- **Idioma**: Responder y explicar siempre en español.
- **Automatización de Deploy (Fast Deploy en Segundo Plano)**: Cuando el usuario solicite un "git push", "deploy", "sube los cambios" o similar, el asistente debe ejecutar el pipeline consolidado en segundo plano:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Message "<mensaje de commit adecuado>"
  ```
  Vercel compila en la nube en ~9-18 segundos, ejecutándose de forma asíncrona en segundo plano y notificando al usuario inmediatamente cuando la URL de producción (`www.citalink.app`) esté lista y activa.
  - **Sincronización con GitHub**: Siempre que termine el despliegue a Vercel, recordarle al usuario ejecutar `git push origin main` en su terminal para mantener el repositorio remoto de GitHub 100% al día.
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
- **Estándares SQL y RLS en Supabase (Rendimiento y Seguridad)**:
  - **InitPlan Caching (`auth_rls_initplan`)**: Todo llamado a funciones de autenticación en políticas RLS (`auth.uid()`, `auth.jwt()`, `auth.role()`, `auth.email()`) DEBE ir envuelto obligatoriamente en una subconsulta escalar: `(select auth.uid())`, `(select auth.role())`, etc. Nunca invocar la función sola para garantizar que PostgreSQL la evalúe 1 sola vez por consulta y no fila por fila.
  - **Vistas con `security_invoker`**: Toda vista (`CREATE VIEW`) debe incluir siempre `WITH (security_invoker = on)` o su respectivo `ALTER VIEW ... SET (security_invoker = on);` para no saltarse las reglas RLS de las tablas base.
  - **Metadatos y Roles Seguros**: Nunca usar `auth.jwt() -> 'user_metadata'` para validar roles o permisos de administrador en RLS (ya que es editable por el cliente). Usar `app_metadata`, funciones con validación estricta de correo o tablas de roles protegidas.
  - **Políticas Idempotentes**: Todo script SQL que cree políticas RLS debe incluir antes el respectivo `DROP POLICY IF EXISTS "<nombre>"` para evitar errores `42710 (already exists)`.
  - **Search Path Seguro en Funciones (`function_search_path_mutable`)**: Toda función de base de datos (`CREATE FUNCTION`) DEBE incluir explícitamente `SET search_path = public, extensions;` para evitar manipulaciones de resolución de esquemas.
  - **No usar `USING (true)` en Modificaciones (`rls_policy_always_true`)**: Nunca usar `USING (true)` ni `WITH CHECK (true)` en operaciones `UPDATE`, `DELETE` o `ALL`. Toda modificación de datos debe validar `tenant_id IN (SELECT public.get_user_tenants())` o `public.is_super_admin()`. La expresión `true` solo es admisible en lecturas de catálogo público o envíos de prospectos en landing.
  - **Desacople de Acciones en RLS (`multiple_permissive_policies`)**: Nunca declarar una política `FOR ALL` en una tabla que ya tiene lectura pública (`FOR SELECT`). Separar las acciones de escritura en `FOR INSERT`, `FOR UPDATE` y `FOR DELETE` para evitar evaluaciones `OR` redundantes.
  - **Autorización Obligatoria en Funciones `SECURITY DEFINER` (`definer_tenant_check`)**: Toda función marcada con `SECURITY DEFINER` que modifique o elimine datos por `p_tenant_id` o `p_id` y sea ejecutable por `authenticated` DEBE validar internamente la pertenencia del usuario al tenant (`v_tenant_id IN (SELECT public.get_user_tenants()) OR public.is_super_admin()`). Nunca confiar en los parámetros enviados por el cliente.
  - **Validación de Integridad en Políticas INSERT (`with_check_scoped`)**: En tablas con inserción pública (`leads`, `reviews`, `system_errors`, etc.), evitar usar `WITH CHECK (true)`. Definir siempre condiciones de validación mínima (ej: `WITH CHECK (name IS NOT NULL AND length(trim(name)) > 0)`, `WITH CHECK (rating >= 1 AND rating <= 5)`), eliminando la advertencia `rls_policy_always_true` y previniendo registros vacíos.
  - **Políticas de Storage sin Enumeración Global (`storage_no_global_list`)**: En buckets públicos de imágenes (`logos`, `services`, `stylists`), no crear políticas `FOR SELECT ON storage.objects USING (bucket_id = '...')` que permitan a cualquier usuario listar todos los archivos del bucket. El acceso a imágenes públicas se hace por URL directa de CDN (`getPublicUrl`), manteniendo el listado restringido a la carpeta del propio tenant.
  - **Aislamiento de Extensiones de Red (`pg_net`)**: Toda base de datos debe revocar la ejecución de funciones de red a usuarios anónimos o clientes: `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC, anon, authenticated;`.
  - **Eliminación de Sobrecargas Obsoletas**: Al actualizar funciones RPC en Supabase, siempre ejecutar `DROP FUNCTION IF EXISTS public.<funcion>(<argumentos_viejos>);` para evitar ambigüedades en PostgREST y duplicidad de advertencias en el Security Advisor.
- **Control Exclusivo de Ejecución SQL**: El asistente NUNCA debe ejecutar sentencias de modificación o scripts SQL directamente en la base de datos de Supabase. Siempre debe entregar el bloque SQL formateado, verificado y explicado para que el usuario sea quien tenga el control total y lo ejecute manualmente en el SQL Editor.
