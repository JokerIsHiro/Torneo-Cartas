$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed"
  }
}

$currentBranch = (& git branch --show-current).Trim()
$status = & git status --porcelain

if ($status) {
  Write-Host "No se puede publicar: tienes cambios sin commitear." -ForegroundColor Yellow
  Write-Host "Haz commit o guarda los cambios antes de lanzar este comando."
  exit 1
}

Write-Host "Publicando dev en main..." -ForegroundColor Cyan

Invoke-Git @("fetch", "origin")
Invoke-Git @("checkout", "main")
Invoke-Git @("pull", "--ff-only", "origin", "main")
Invoke-Git @("merge", "dev")
Invoke-Git @("push", "origin", "main")

Write-Host "Main actualizado y subido. GitHub Actions desplegara Firebase Hosting." -ForegroundColor Green
Write-Host "Rama actual: main. Volviendo a la rama $currentBranch"
Invoke-Git @("checkout", "dev")
