[CmdletBinding()]
param(
    [string]$IsccPath = "",
    [switch]$SkipProductBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$manifest = Get-Content -Raw -LiteralPath (Join-Path $root "installer\vendor-manifest.json") | ConvertFrom-Json
$nodeArchive = Join-Path $root "installer\vendor\node\node-v24.20.0-win-x64.zip"
$nodeExe = Join-Path $root "installer\vendor\node\v24.20.0\node.exe"
$winswExe = Join-Path $root "installer\vendor\winsw\2.12.0\WinSW-x64.exe"
foreach ($item in @(@($nodeArchive, [string]$manifest.node.sha256), @($winswExe, [string]$manifest.winsw.sha256))) {
    if (-not (Test-Path -LiteralPath $item[0])) { throw "Falta el binario requerido: $($item[0])" }
    if ((Get-FileHash -LiteralPath $item[0] -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item[1]) { throw "Checksum inválido: $($item[0])" }
}
if ((Get-FileHash -LiteralPath $nodeExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5') { throw "Checksum inválido para node.exe." }

if (-not $SkipProductBuild) {
    & (Join-Path $root "scripts\production\build.ps1") -SourceRoot $root -FrontendApiUrl "http://localhost:3001"
}
& (Join-Path $PSScriptRoot "Build-Launcher.ps1")

if ([string]::IsNullOrWhiteSpace($IsccPath)) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 7\ISCC.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 7\ISCC.exe")
    )
    $IsccPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $IsccPath -or -not (Test-Path -LiteralPath $IsccPath)) { throw "No se encontró ISCC.exe. Instale Inno Setup estable o use -IsccPath." }
& $IsccPath /Qp (Join-Path $root "installer\inno\SistemaControlPagos.iss")
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del instalador." }

$setup = Join-Path $root "installer\output\SistemaControlPagos-Setup-1.0.0.exe"
$signature = Get-AuthenticodeSignature -LiteralPath $setup
Write-Host "Instalador generado: $setup"
Write-Host "SHA-256: $((Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash)"
Write-Host "Firma Authenticode: $($signature.Status)"
