# Despliegue: BD (Prisma) + git push + Vercel
# Requisito: DATABASE_URL de producción en el entorno o en .env
#
# Ejemplos:
#   .\scripts\deploy-production.ps1
#   .\scripts\deploy-production.ps1 -NoVercel
#   $env:DATABASE_URL = "postgresql://..."; .\scripts\deploy-production.ps1

param(
    [switch] $NoDb,
    [switch] $NoSupabase,
    [switch] $NoGit,
    [switch] $NoVercel,
    [string] $Branch = "",
    [switch] $AcceptDataLoss
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$nodeArgs = @("scripts/deploy-production.mjs")
if ($NoDb) { $nodeArgs += "--no-db" }
if ($NoSupabase) { $nodeArgs += "--no-supabase" }
if ($NoGit) { $nodeArgs += "--no-git" }
if ($NoVercel) { $nodeArgs += "--no-vercel" }
if ($Branch) { $nodeArgs += @("--branch", $Branch) }
if ($AcceptDataLoss) { $nodeArgs += "--accept-data-loss" }

& node @nodeArgs
exit $LASTEXITCODE
