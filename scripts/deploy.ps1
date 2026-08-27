param(
    [string]$Message = "chore: update & auto-deploy"
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 [1/3] Guardando cambios locales con Git..." -ForegroundColor Cyan
git add .
git commit -m "$Message"

Write-Host "⚡ [2/2] Desplegando directamente en Vercel Producción..." -ForegroundColor Cyan
vercel --prod --yes
