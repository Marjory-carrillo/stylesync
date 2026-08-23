param(
    [string]$Message = "chore: update & auto-deploy"
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 [1/3] Guardando cambios locales con Git..." -ForegroundColor Cyan
git add .
git commit -m "$Message"

Write-Host "🔄 [2/3] Sincronizando con GitHub (Push)..." -ForegroundColor Cyan
try {
    $pushJob = Start-Job -ScriptBlock { git push origin main }
    $done = Wait-Job $pushJob -Timeout 15
    if ($done) {
        Receive-Job $pushJob
        Write-Host "✅ Push a GitHub completado." -ForegroundColor Green
    } else {
        Stop-Job $pushJob
        Write-Host "⚠️ Git push tardó más de 15s. Continuando inmediatamente con Vercel..." -ForegroundColor Yellow
    }
    Remove-Job $pushJob -Force
} catch {
    Write-Host "⚠️ Continuando con Vercel..." -ForegroundColor Yellow
}

Write-Host "⚡ [3/3] Desplegando directamente en Vercel Producción..." -ForegroundColor Cyan
vercel --prod --yes
