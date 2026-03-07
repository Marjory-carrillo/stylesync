# PLAN DE IMPLEMENTACION - CITA-LINK

**Fecha:** 2026-03-05
**Tiempo Total Estimado:** 146-210 horas (4-6 semanas)

## FASE 1: SEGURIDAD CRITICA (Semana 1-2) - 18-24 horas

### 1.1 Reparar Row Level Security (RLS)
- [ ] Auditar tablas y estado RLS
- [ ] Crear script de migracion seguro
- [ ] Crear politicas de seguridad por tenant
- [ ] Crear tabla user_tenants
- [ ] Actualizar store.tsx
- [ ] Testing manual de flujos
- [ ] Eliminar permisos excesivos

### 1.2 Implementar Validacion (Zod)
- [ ] Instalar Zod
- [ ] Crear esquemas de validacion
- [ ] Integrar en formularios
- [ ] Reemplazar "as any"

### 1.3 Sanitizacion de Inputs
- [ ] Revisar inputs de usuario
- [ ] Implementar escape HTML
- [ ] Validar URLs

## FASE 2: REFACTORIZACION (Semana 3-5) - 42-62 horas

### 2.1 Dividir Monolito Store
Crear contexts:
- AuthContext
- TenantContext
- BookingContext
- ClientContext
- ServiceContext

### 2.2 Implementar React Query
- [ ] Instalar TanStack Query
- [ ] Configurar QueryClient
- [ ] Crear hooks personalizados
- [ ] Migrar queries Supabase

### 2.3 Lazy Loading
- [ ] Configurar lazy loading en rutas
- [ ] Crear skeletons
- [ ] Optimizar imports

## FASE 3: PERFORMANCE (Semana 6-7) - 20-28 horas

### 3.1 Optimizacion Componentes
- [ ] Agregar useMemo
- [ ] React.memo para componentes pesados
- [ ] useCallback para handlers
- [ ] Virtualizar listas largas

### 3.2 Manejo de Errores
- [ ] Crear Error Boundary
- [ ] Manejo de errores de red
- [ ] Paginas de error especificas
- [ ] Retry automatico

## FASE 4: TESTING (Semana 8-10) - 38-56 horas

### 4.1 Testing Unitario
- [ ] Instalar Vitest
- [ ] Configurar Testing Library
- [ ] Tests para utilidades
- [ ] Tests para componentes
- [ ] GitHub Actions CI

### 4.2 TypeScript Strict
- [ ] Actualizar tsconfig.json
- [ ] Corregir errores
- [ ] Eliminar @ts-ignore

### 4.3 E2E Testing
- [ ] Instalar Playwright
- [ ] Tests flujo de reserva
- [ ] Tests flujo admin

## FASE 5: MEJORAS UX (Semana 11-12) - 28-40 horas

### 5.1 Accesibilidad
- [ ] Auditoria axe-core
- [ ] Atributos ARIA
- [ ] Contraste WCAG AA

### 5.2 UI/UX
- [ ] Toasts consistentes
- [ ] Confirmaciones destructivas
- [ ] Estados vacios
- [ ] Tooltips

### 5.3 i18n
- [ ] Instalar i18next
- [ ] Extraer strings
- [ ] Normalizar codigo

## DEPENDENCIAS

FASE 1 (Seguridad)
    |
    |-------------------------------|
    |                               |
    v                               v
FASE 2 (Arquitectura)         FASE 5 (UX)
    |
    |---------------|
    |               |
    v               v
FASE 3 (Perf)   FASE 4 (Testing)

## RIESGOS PRINCIPALES

1. RLS rompe funcionalidad - Mitigacion: Staging environment
2. Refactor introduce bugs - Mitigacion: Migracion gradual
3. Tests E2E flaky - Mitigacion: Timeouts generosos
4. Scope creep - Mitigacion: Seguir plan estricto

## METRICAS DE EXITO

- Cobertura tests > 60%
- Lighthouse Performance > 90
- Bundle inicial < 200KB
- Cero vulnerabilidades criticas

## COMANDOS RAPIDOS

npm install zod @tanstack/react-query react-i18next i18next
npm install -D vitest @testing-library/react @playwright/test vite-bundle-visualizer
npm install react-window

---
Documento creado por Claude Code - 2026-03-05
