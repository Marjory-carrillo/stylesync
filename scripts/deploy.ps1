param(
    [string]$Message = "chore: update & auto-deploy"
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 [1/3] Guardando cambios locales con Git..." -ForegroundColor Cyan
git add .
git commit -m "$Message"

Write-Host "🔄 [2/3] Lanzando sincronización con GitHub en paralelo..." -ForegroundColor Cyan
$pushProcess = Start-Process git -ArgumentList "push origin main" -WorkingDirectory $PSScriptRoot\.. -NoNewWindow -PassThru

Write-Host "⚡ [3/3] Desplegando en Vercel Producción simultáneamente..." -ForegroundColor Cyan
vercel --prod --yes

# Asegurar que el push terminó
if ($pushProcess -and !$pushProcess.HasExited) {
    $pushProcess.WaitForExit(10000)
    Write-Host "✅ Sincronización con GitHub completada." -ForegroundColor Green
}
