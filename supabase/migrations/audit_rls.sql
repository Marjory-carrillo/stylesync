-- ============================================================
-- AUDITORÍA DE RLS — CITA-LINK
-- Ejecutar en Supabase SQL Editor para ver el estado de seguridad
-- ============================================================

-- 1. VER QUÉ TABLAS TIENEN RLS ACTIVADO O DESACTIVADO
SELECT 
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ACTIVADO' ELSE '❌ RLS DESACTIVADO ← RIESGO' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- 2. VER TODAS LAS POLÍTICAS EXISTENTES
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS operation,
    qual AS condicion_using,
    with_check AS condicion_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
