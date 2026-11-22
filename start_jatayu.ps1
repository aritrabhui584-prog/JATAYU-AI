# JATAYU AI — Single-Port Startup Script (Windows PowerShell)
# Launches unified Command & Control Platform on http://127.0.0.1:8000

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  JATAYU AI — Intelligent Disaster Prediction System     " -ForegroundColor Cyan
Write-Host "  Unified Single-Port Deployment (Port 8000)             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check frontend build
$FrontendDist = Join-Path $ScriptDir "frontend\dist\index.html"
if (-not (Test-Path $FrontendDist)) {
    Write-Host "[1/3] Building frontend distribution..." -ForegroundColor Yellow
    Push-Location (Join-Path $ScriptDir "frontend")
    npm run build
    Pop-Location
} else {
    Write-Host "[1/3] Frontend build verified (frontend/dist ready)." -ForegroundColor Green
}

# 2. Check Python venv
$VenvPython = Join-Path $ScriptDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "[2/3] Virtual environment not found at backend\.venv! Creating..." -ForegroundColor Yellow
    python -m venv (Join-Path $ScriptDir "backend\.venv")
    & $VenvPython -m pip install -r (Join-Path $ScriptDir "backend\requirements.txt")
} else {
    Write-Host "[2/3] Python environment verified (backend/.venv ready)." -ForegroundColor Green
}

# 3. Launch Unified Server
Write-Host "[3/3] Launching Unified Server on http://127.0.0.1:8000..." -ForegroundColor Green
Write-Host ""
Write-Host "  ➜ Operations Command Center:  http://127.0.0.1:8000/" -ForegroundColor White
Write-Host "  ➜ Interactive Swagger Docs:   http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  ➜ Health Check Endpoint:      http://127.0.0.1:8000/api/health" -ForegroundColor White
Write-Host "  ➜ Official SITREP (PDF):      http://127.0.0.1:8000/api/priority/export/sitrep.pdf" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to terminate." -ForegroundColor Gray
Write-Host ""

Push-Location (Join-Path $ScriptDir "backend")
& ".\.venv\Scripts\uvicorn.exe" app.main:app --host 0.0.0.0 --port 8000
Pop-Location
