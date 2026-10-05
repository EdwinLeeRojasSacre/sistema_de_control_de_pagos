[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [string]$DataRoot = "C:\ProgramData\SistemaControlPagos",
    [string]$ArtifactRoot = "",
    [string]$ConfigPath = "",
    [string]$DatabaseHost = "127.0.0.1",
    [int]$DatabasePort = 5432,
    [Parameter(Mandatory = $true)][string]$DatabaseName,
    [Parameter(Mandatory = $true)][string]$DatabaseUser,
    [string]$VoucherPath = "",
    [string]$PgRestoreExecutable = "pg_restore",
    [string]$BackendUrl = "",
    [string]$FrontendUrl = "http://127.0.0.1:3000",
    [int]$FrontendPort = 3000,
    [switch]$UseCurrentEnvironment,
    [switch]$ConfirmRestore,
    [switch]$SkipSafetyBackup,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$BackupPath = Get-FullPath $BackupPath
$DataRoot = Get-FullPath $DataRoot
if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
    $ArtifactRoot = Join-Path $PSScriptRoot "..\..\artifacts\production"
}
$ArtifactRoot = Get-FullPath $ArtifactRoot
if ([string]::IsNullOrWhiteSpace($VoucherPath)) {
    $VoucherPath = Join-Path $DataRoot "storage\vouchers"
}
$VoucherPath = Get-FullPath $VoucherPath
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $DataRoot "config\backend.env"
}

$databaseFile = Join-Path $BackupPath "database.dump"
$voucherSource = Join-Path $BackupPath "vouchers"
$manifestPath = Join-Path $BackupPath "manifest.json"
foreach ($required in @($databaseFile, $manifestPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Backup incompleto; falta: $required"
    }
}
if (-not (Test-Path -LiteralPath $voucherSource -PathType Container)) {
    throw "Backup incompleto; falta el directorio de vouchers."
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.product -ne "Sistema de Control de Pagos" -or [int]$manifest.formatVersion -ne 1) {
    throw "El manifest no pertenece a un backup compatible."
}
$actualHash = (Get-FileHash -LiteralPath $databaseFile -Algorithm SHA256).Hash
if ($actualHash -ne [string]$manifest.database.sha256) {
    throw "El checksum del backup PostgreSQL no coincide con el manifest."
}

$dataPrefix = $DataRoot.TrimEnd("\") + "\"
if (-not $VoucherPath.StartsWith($dataPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Por seguridad, VoucherPath debe estar contenido dentro de DataRoot."
}

Write-Host "Backup validado correctamente: $BackupPath"
if ($ValidateOnly) {
    Write-Host "Validación estática completada; no se detuvieron procesos ni se restauraron datos."
    exit 0
}
if (-not $ConfirmRestore) {
    throw "La restauración requiere el parámetro explícito -ConfirmRestore."
}

Assert-CommandAvailable -Name $PgRestoreExecutable

if (-not $SkipSafetyBackup) {
    Write-Host "Creando backup preventivo antes de restaurar..."
    & (Join-Path $PSScriptRoot "backup.ps1") -DataRoot $DataRoot -DatabaseHost $DatabaseHost -DatabasePort $DatabasePort -DatabaseName $DatabaseName -DatabaseUser $DatabaseUser -VoucherPath $VoucherPath
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo completar el backup preventivo."
    }
}

& (Join-Path $PSScriptRoot "stop.ps1") -DataRoot $DataRoot
if ($LASTEXITCODE -ne 0) {
    throw "No se pudieron detener los procesos controlados."
}

Write-Host "Restaurando PostgreSQL..."
$restoreArguments = @(
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--host=$DatabaseHost",
    "--port=$DatabasePort",
    "--username=$DatabaseUser",
    "--dbname=$DatabaseName",
    $databaseFile
)
& $PgRestoreExecutable @restoreArguments
if ($LASTEXITCODE -ne 0) {
    throw "pg_restore terminó con código $LASTEXITCODE. La aplicación permanece detenida."
}

Write-Host "Restaurando vouchers..."
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$previousVoucherPath = "$VoucherPath.pre-restore-$timestamp"
if (Test-Path -LiteralPath $VoucherPath) {
    Move-Item -LiteralPath $VoucherPath -Destination $previousVoucherPath
}
try {
    Copy-Item -LiteralPath $voucherSource -Destination $VoucherPath -Recurse
}
catch {
    $failedVoucherPath = "$VoucherPath.failed-$timestamp"
    if (Test-Path -LiteralPath $VoucherPath) {
        Move-Item -LiteralPath $VoucherPath -Destination $failedVoucherPath
    }
    if (Test-Path -LiteralPath $previousVoucherPath) {
        Move-Item -LiteralPath $previousVoucherPath -Destination $VoucherPath
    }
    throw
}

$startParameters = @{
    ArtifactRoot = $ArtifactRoot
    DataRoot = $DataRoot
    ConfigPath = $ConfigPath
    BackendUrl = $BackendUrl
    FrontendUrl = $FrontendUrl
    FrontendPort = $FrontendPort
}
if ($UseCurrentEnvironment) {
    $startParameters.UseCurrentEnvironment = $true
}
& (Join-Path $PSScriptRoot "start.ps1") @startParameters
if ($LASTEXITCODE -ne 0) {
    throw "Los datos fueron restaurados, pero la aplicación no superó el arranque."
}

Write-Host "Restauración completada. Los vouchers anteriores se conservaron en: $previousVoucherPath"
exit 0
