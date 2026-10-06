[CmdletBinding()]
param(
    [string]$SourceRoot = "",
    [string]$ArtifactRoot = "",
    [string]$FrontendApiUrl = "http://localhost:3001"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Falló '$Command $($Arguments -join ' ')' en $WorkingDirectory"
        }
    }
    finally {
        Pop-Location
    }
}

function Copy-BuildInput {
    param(
        [Parameter(Mandatory = $true)][string]$From,
        [Parameter(Mandatory = $true)][string]$To,
        [Parameter(Mandatory = $true)][string[]]$Names
    )
    Ensure-Directory -Path $To
    foreach ($name in $Names) {
        $source = Join-Path $From $name
        if (-not (Test-Path -LiteralPath $source)) {
            throw "No existe el insumo de build requerido: $source"
        }
        Copy-Item -LiteralPath $source -Destination $To -Recurse -Force
    }
}

if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
    $SourceRoot = Join-Path $PSScriptRoot "..\.."
}
$SourceRoot = Get-FullPath $SourceRoot
$artifactsParent = Get-FullPath (Join-Path $SourceRoot "artifacts")
if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
    $ArtifactRoot = Join-Path $artifactsParent "production"
}
$ArtifactRoot = Get-FullPath $ArtifactRoot
if (-not $ArtifactRoot.StartsWith($artifactsParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Por seguridad, ArtifactRoot debe estar dentro de $artifactsParent"
}

$buildRoot = Join-Path $artifactsParent ".build-production"
$backendSource = Join-Path $SourceRoot "backend"
$frontendSource = Join-Path $SourceRoot "frontend"
$backendBuild = Join-Path $buildRoot "backend"
$frontendBuild = Join-Path $buildRoot "frontend"

Assert-NodeVersion
Ensure-Directory -Path $artifactsParent
foreach ($safeTarget in @($buildRoot, $ArtifactRoot)) {
    if (Test-Path -LiteralPath $safeTarget) {
        Remove-Item -LiteralPath $safeTarget -Recurse -Force
    }
}

Write-Host "Preparando workspace de build aislado..."
Copy-BuildInput -From $backendSource -To $backendBuild -Names @(
    "package.json",
    "package-lock.json",
    "nest-cli.json",
    "prisma.config.ts",
    "tsconfig.json",
    "tsconfig.build.json",
    "src",
    "prisma"
)
Copy-BuildInput -From $frontendSource -To $frontendBuild -Names @(
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
    "tsconfig.json",
    "app",
    "src",
    "public"
)

Write-Host "Instalando dependencias reproducibles y compilando backend..."
Invoke-Checked -WorkingDirectory $backendBuild -Command "npm" -Arguments @("ci")
Invoke-Checked -WorkingDirectory $backendBuild -Command "npx" -Arguments @("--no-install", "prisma", "generate")
Invoke-Checked -WorkingDirectory $backendBuild -Command "npm" -Arguments @("run", "build")

Write-Host "Instalando dependencias reproducibles y compilando frontend..."
Invoke-Checked -WorkingDirectory $frontendBuild -Command "npm" -Arguments @("ci")
$previousApiUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_API_URL", "Process")
try {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_API_URL", $FrontendApiUrl, "Process")
    Invoke-Checked -WorkingDirectory $frontendBuild -Command "npm" -Arguments @("run", "build")
}
finally {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_API_URL", $previousApiUrl, "Process")
}

$backendEntry = Join-Path $backendBuild "dist\main.js"
$frontendEntry = Join-Path $frontendBuild ".next\standalone\server.js"
foreach ($artifact in @($backendEntry, $frontendEntry)) {
    if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) {
        throw "No se generó el artefacto esperado: $artifact"
    }
}

Ensure-Directory -Path $ArtifactRoot
$stagedBackend = Join-Path $ArtifactRoot "backend"
$stagedFrontend = Join-Path $ArtifactRoot "frontend"
$stagedMigrationTools = Join-Path $ArtifactRoot "migration-tools"
Ensure-Directory -Path $stagedBackend
Ensure-Directory -Path $stagedFrontend
Ensure-Directory -Path $stagedMigrationTools

Copy-Item -LiteralPath (Join-Path $backendBuild "dist") -Destination $stagedBackend -Recurse
Copy-Item -LiteralPath (Join-Path $backendBuild "prisma") -Destination $stagedBackend -Recurse
Copy-Item -LiteralPath (Join-Path $backendBuild "package.json") -Destination $stagedBackend
Copy-Item -LiteralPath (Join-Path $backendBuild "package-lock.json") -Destination $stagedBackend

Write-Host "Instalando dependencias runtime del backend en staging..."
Invoke-Checked -WorkingDirectory $stagedBackend -Command "npm" -Arguments @("ci", "--omit=dev", "--omit=peer", "--ignore-scripts")
Invoke-Checked -WorkingDirectory $stagedBackend -Command "npm" -Arguments @("uninstall", "prisma", "--omit=dev", "--ignore-scripts")
$generatedPrisma = Join-Path $backendBuild "node_modules\.prisma"
if (-not (Test-Path -LiteralPath $generatedPrisma -PathType Container)) {
    throw "No se encontró el cliente Prisma generado: $generatedPrisma"
}
Copy-Item -LiteralPath $generatedPrisma -Destination (Join-Path $stagedBackend "node_modules") -Recurse -Force

Copy-Item -LiteralPath (Join-Path $SourceRoot "installer\migration-tools\package.json") -Destination $stagedMigrationTools
Copy-Item -LiteralPath (Join-Path $SourceRoot "installer\migration-tools\package-lock.json") -Destination $stagedMigrationTools
Write-Host "Preparando Prisma CLI temporal para migraciones del instalador..."
Invoke-Checked -WorkingDirectory $stagedMigrationTools -Command "npm" -Arguments @("ci", "--omit=dev", "--ignore-scripts")
$sourcePrismaEngines = Join-Path $backendBuild "node_modules\@prisma\engines"
$targetPrismaEngines = Join-Path $stagedMigrationTools "node_modules\@prisma\engines"
foreach ($engineName in @("schema-engine-windows.exe", "query_engine-windows.dll.node")) {
    $enginePath = Join-Path $sourcePrismaEngines $engineName
    if (-not (Test-Path -LiteralPath $enginePath -PathType Leaf)) { throw "No se generó el motor Prisma requerido: $engineName" }
    Copy-Item -LiteralPath $enginePath -Destination $targetPrismaEngines -Force
}

Copy-Item -Path (Join-Path $frontendBuild ".next\standalone\*") -Destination $stagedFrontend -Recurse -Force
Copy-Item -LiteralPath (Join-Path $frontendBuild "public") -Destination $stagedFrontend -Recurse
Ensure-Directory -Path (Join-Path $stagedFrontend ".next")
Copy-Item -LiteralPath (Join-Path $frontendBuild ".next\static") -Destination (Join-Path $stagedFrontend ".next") -Recurse

$backendPackage = Get-Content -Raw -LiteralPath (Join-Path $backendBuild "package.json") | ConvertFrom-Json
[ordered]@{
    product = "Sistema de Control de Pagos"
    version = [string]$backendPackage.version
    builtAt = (Get-Date).ToUniversalTime().ToString("o")
    nodeVersion = (& node --version).Trim()
    frontendApiUrl = $FrontendApiUrl
    backendEntry = "backend\dist\main.js"
    frontendEntry = "frontend\server.js"
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ArtifactRoot "manifest.json") -Encoding UTF8

Remove-Item -LiteralPath $buildRoot -Recurse -Force
Write-Host "Staging productivo generado correctamente en: $ArtifactRoot"
exit 0
