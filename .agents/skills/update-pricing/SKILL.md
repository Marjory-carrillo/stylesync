---
name: update-pricing
description: >-
  Activa esta skill cuando el usuario pida "cambiar precios", "actualizar planes",
  "subir precios", "bajar precios", "modificar precios de suscripción", "agregar precio anual"
  o cualquier ajuste tarifario en CitaLink. Contiene el mapa completo de archivos, base de datos,
  pasos en Stripe y checklist para no empezar de cero.
---

# Update Pricing — Guía Maestra de Actualización de Precios en CitaLink

Esta skill documenta el proceso exacto y de extremo a extremo para modificar cualquier precio o plan en CitaLink, asegurando coherencia total entre el panel administrativo, la landing page, Stripe y la base de datos de Supabase.

---

## 📌 Estructura de Planes Actual de CitaLink

| Plan | Código Interno | Profesionales Base | Sucursales | Extras Disponibles |
| :--- | :---: | :---: | :---: | :--- |
| **Esencial** | `lite` | 1 | 1 | No expandible |
| **Pro** | `pro` | 2 | 1 | + Profesionales adicionales |
| **Business** | `business` | 2 por sucursal | 2 | + Profesionales y + Sucursales |

* **Add-ons**:
  * `extraEmployeePrice`: Costo recurrente mensual por cada profesional extra.
  * `extraBranchPrice`: Costo recurrente mensual por cada sucursal adicional.

---

## ⚡ Paso 1: Configurar en Stripe (Catálogo y Variables)

> [!IMPORTANT]
> En Stripe los precios son **inmutables**. Nunca intentes editar un precio existente. Debes **crear un nuevo precio** bajo el mismo producto y obtener su identificador único (`price_...`).

### 1.1 Crear o Ajustar Precios en Stripe Dashboard
1. Ingresa a [Stripe Dashboard](https://dashboard.stripe.com) (hazlo primero en **Modo de Prueba / Test Mode** y luego en **Modo Real / Live Mode**).
2. Ve a **Catálogo de productos** (*Product Catalog*).
3. Selecciona el producto correspondiente (o créalo si es nuevo):
   - `Plan Esencial CitaLink`
   - `Plan Pro CitaLink`
   - `Plan Business CitaLink`
   - `Profesional Adicional CitaLink`
   - `Sucursal Adicional CitaLink`
4. Haz clic en **Añadir otro precio** (*Add another price*):
   - **Moneda**: MXN (Pesos Mexicanos) u otra si aplica.
   - **Monto**: El nuevo precio (ej. $299.00).
   - **Facturación**: *Recurrente* (*Recurring*).
   - **Intervalo**: *Mensual* (o *Anual* si aplica).
5. Copia el nuevo **Price ID** que empieza con `price_...` (ej: `price_1Pabc123...`).

### 1.2 Actualizar los Secrets en Supabase
El backend (`create-checkout-session` y `stripe-webhook`) lee los Price IDs desde las variables de entorno de Supabase Edge Functions:

| Variable | Uso | Price ID Oficial (MXN) |
| :--- | :--- | :--- |
| `STRIPE_PRICE_LITE` | Plan Esencial mensual ($299) | `price_1UGlcgDjXQfhXvVPL9220CLL` |
| `STRIPE_PRICE_PRO` | Plan Pro mensual ($599) | `price_1UGldEDjXQfhXvVPBfofOnaz` |
| `STRIPE_PRICE_BUSINESS` | Plan Business mensual ($1,049) | `price_1UGlk5DjXQfhXvVPT0f4BYjW` |
| `STRIPE_PRICE_EXTRA_EMPLOYEE` | Profesional extra mensual ($199) | `price_1UGlkbDjXQfhXvVPms1XkTQz` |
| `STRIPE_PRICE_EXTRA_BRANCH` | Sucursal extra mensual ($549) | `price_1TrmNeDjXQfhXvVPYehmfJdw` |

Para actualizarlas:
* **Desde el navegador**: Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard) > **Project Settings** > **Edge Functions** > pestaña **Secrets** y actualiza el valor del secret correspondiente.
* **Desde el CLI de Supabase**:
  ```bash
  supabase secrets set STRIPE_PRICE_LITE=price_nuevo_id STRIPE_PRICE_PRO=price_nuevo_id
  ```

### 1.3 Configurar el Portal del Cliente de Stripe (Customer Portal)
1. En Stripe Dashboard, ve a **Configuración** > **Portal de clientes** (*Customer Portal*).
2. En la sección **Suscripciones**:
   - Asegúrate de marcar los nuevos Price IDs creados para que los clientes existentes puedan hacer Upgrade/Downgrade al nuevo precio.
   - Desmarca o archiva los Price IDs viejos para que no aparezcan a nuevos clientes.

---

## 🗄️ Paso 2: Actualizar en Supabase (Base de Datos)

En la tabla `public.global_configs` residen los precios de referencia para facturación manual y reportes.

Ejecutar en el **SQL Editor de Supabase**:
```sql
-- 1. Asegurar columna si no existe
ALTER TABLE public.global_configs 
ADD COLUMN IF NOT EXISTS business_plan_price NUMERIC(10,2) DEFAULT 1049.00;

-- 2. Actualizar precios
UPDATE public.global_configs
SET basic_plan_price = 299.00,
    premium_plan_price = 599.00,
    business_plan_price = 1049.00
WHERE id = 'main';
```

---

## 💻 Paso 3: Mapa Exhaustivo de Archivos en el Frontend

Cuando cambies precios, estos son los archivos exactos a modificar:

### 3.1 Configuración Central (Fuentes de Verdad)
1. `src/lib/pricingConfig.ts`:
   - Modificar `COUNTRY_PRESETS.MX.plans`: `lite.monthly`, `pro.monthly`, `business.monthly`.
   - Modificar `extraEmployeePrice` y `extraBranchPrice`.
2. `src/lib/planLimits.ts`:
   - Modificar `PLAN_CONFIG`: `lite.price`, `pro.price`, `business.price`.
   - Modificar `extraEmployeePrice` y `extraBranchPrice`.
   - Verificar `canAddEmployee` (límites en trial y cuotas).
3. `src/lib/store/useGlobalStore.ts`:
   - Modificar `basic_plan_price` y `premium_plan_price` en el estado inicial de Zustand.

### 3.2 Landing Page Pública
1. `src/pages/Landing.tsx`:
   - Tarjetas de precios en la sección `#pricing` (Esencial, Pro, Business).
   - Precios tachados (descuento visual de referencia).
   - Características de los planes (ej: `+$199/mes por profesional extra`).
   - Sección de Preguntas Frecuentes (FAQ) sobre colaboradores extra.

### 3.3 Módulos de Administración y Suscripción
1. `src/pages/admin/Staff.tsx`:
   - Textos de upgrade a Pro (`$599/mes`).
   - Textos de aviso de empleado extra (`+$199/mes`).
   - Cálculo del cupo máximo visible (`inTrial ? 4 : effectiveMaxEmployees`).
2. `src/components/PaymentBlockedScreen.tsx`:
   - Tarjetas de reactivación de cuenta vencida (`$299`, `$599`).
3. `src/pages/admin/Dashboard.tsx`:
   - Modal de upgrade / reactivación y banners informativos.
4. `src/pages/admin/GlobalSettings.tsx`:
   - Valores fallback de los campos de edición de precios.
5. `src/pages/Terms.tsx`:
   - Términos y condiciones legales (sección de Precios y Pagos).
6. `src/components/OnboardingWizard.tsx`:
   - Banner informativo en el paso de creación de equipo.

### 3.4 Paneles de Métricas y SuperAdmin
1. `src/pages/admin/SuperAdminPanel.tsx`:
   - Precios base para cálculo de MRR (`basePrice = 299`, `599`, `1049`).
   - Cálculo de extras: `totalExtraEmployees * 199` y `totalExtraBranches * 549`.
   - Badges y selectores de plan en el modal de clientes.
2. `src/pages/admin/CitalinkClients.tsx`:
   - Badges de precio y selectores para altas manuales.
3. `src/pages/admin/SuperAdminCosts.tsx`:
   - Cálculo de costos e ingresos estimados.
4. `src/pages/admin/SalesTracker.tsx`:
   - Respuestas tipo en el speech de ventas y cálculo de proyecciones.

---

## 🔍 Paso 4: Checklist de Validación y Despliegue

1. **Búsqueda global con grep**:
   Verifica que no queden referencias a los precios anteriores:
   ```bash
   # Buscar precio viejo de Esencial
   git grep "349" src/
   # Buscar precio viejo de Pro
   git grep "649" src/
   # Buscar precio viejo de Business
   git grep "1249" src/
   # Buscar precio viejo de extra
   git grep "249" src/
   ```
2. **Chequeo de Tipos (Build)**:
   ```powershell
   npx tsc -b
   ```
3. **Despliegue a Producción**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Message "Ajuste de precios oficiales de planes"
   ```
4. **Sincronización remota con GitHub**:
   ```powershell
   git push origin main
   ```
