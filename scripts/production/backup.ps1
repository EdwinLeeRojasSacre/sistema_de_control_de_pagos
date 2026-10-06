[CmdletBinding()]
param(
    [string]$DataRoot = "C:\ProgramData\SistemaControlPagos",
    [string]$DatabaseHost = "127.0.0.1",
    [int]$DatabasePort = 5432,
    [Parameter(Mandatory = $true)][string]$DatabaseName,
    [Parameter(Mandatory = $true)][string]$DatabaseUser,
    [string]$Destination = "",
    [string]$VoucherPath = "",
    [string]$PgDumpExecutable = "pg_dump"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$DataRoot = Get-FullPath $DataRoot
if ([string]::IsNullOrWhiteSpace($VoucherPath)) {
    $VoucherPath = Join-Path $DataRoot "storage\vouchers"
}
$VoucherPath = Get-FullPath $VoucherPath
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = Join-Path $DataRoot "backups\$timestamp"
}
$Destination = Get-FullPath $Destination

if (Test-Path -LiteralPath $Destination) {
    throw "El destino del backup ya existe: $Destination"
}
if (-not (Test-Path -LiteralPath $VoucherPath -PathType Container)) {
    throw "No existe el almacenamiento de vouchers: $VoucherPath"
}
Assert-CommandAvailable -Name $PgDumpExecutable

Ensure-Directory -Path $Destination
$databaseFile = Join-Path $Destination "database.dump"
$voucherDestination = Join-Path $Destination "vouchers"

Write-Host "Respaldando PostgreSQL..."
$dumpArguments = @(
    "--format=custom",
    "--file=$databaseFile",
    "--host=$DatabaseHost",
    "--port=$DatabasePort",
    "--username=$DatabaseUser",
    "--dbname=$DatabaseName",
    "--no-owner",
    "--no-privileges"
)
& $PgDumpExecutable @dumpArguments
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump terminó con código $LASTEXITCODE."
}

Write-Host "Respaldando vouchers..."
Ensure-Directory -Path $voucherDestination
Get-ChildItem -LiteralPath $VoucherPath -Force | Copy-Item -Destination $voucherDestination -Recurse -Force

$voucherFiles = @(Get-ChildItem -LiteralPath $voucherDestination -File -Recurse)
$manifest = [ordered]@{
    product = "Sistema de Control de Pagos"
    formatVersion = 1
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    database = [ordered]@{
        format = "PostgreSQL custom"
        file = "database.dump"
        sha256 = (Get-FileHash -LiteralPath $databaseFile -Algorithm SHA256).Hash
    }
    vouchers = [ordered]@{
        directory = "vouchers"
        fileCount = $voucherFiles.Count
    }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Destination "manifest.json") -Encoding UTF8

Write-Host "Backup completado correctamente en: $Destination"
Write-Host "La contraseña de PostgreSQL no fue incluida en argumentos, logs ni manifest."
exit 0
