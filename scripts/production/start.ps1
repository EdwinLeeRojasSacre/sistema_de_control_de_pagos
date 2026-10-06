[CmdletBinding()]
param(
    [string]$ArtifactRoot = "",
    [string]$DataRoot = "C:\ProgramData\SistemaControlPagos",
    [string]$ConfigPath = "",
    [string]$BackendUrl = "",
    [string]$FrontendUrl = "http://127.0.0.1:3000",
    [int]$FrontendPort = 3000,
    [int]$HealthAttempts = 20,
    [switch]$UseCurrentEnvironment
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
    $ArtifactRoot = Join-Path $PSScriptRoot "..\..\artifacts\production"
}
$ArtifactRoot = Get-FullPath $ArtifactRoot
$DataRoot = Get-FullPath $DataRoot
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $DataRoot "config\backend.env"
}
$ConfigPath = Get-FullPath $ConfigPath

$backendEntry = Join-Path $ArtifactRoot "backend\dist\main.js"
$frontendEntry = Join-Path $ArtifactRoot "frontend\server.js"
foreach ($entry in @($backendEntry, $frontendEntry)) {
    if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
        throw "No existe el artefacto productivo requerido: $entry"
    }
}

Assert-NodeVersion
if (-not $UseCurrentEnvironment) {
    Import-EnvironmentFile -Path $ConfigPath
}
Assert-RequiredEnvironment -Names @("DATABASE_URL", "JWT_SECRET", "PORT", "VOUCHER_STORAGE_PATH")
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")

if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    $BackendUrl = "http://127.0.0.1:$($env:PORT)"
}

foreach ($directory in @(
    (Join-Path $DataRoot "config"),
    (Join-Path $DataRoot "storage\vouchers"),
    (Join-Path $DataRoot "logs"),
    (Join-Path $DataRoot "backups"),
    (Join-Path $DataRoot "runtime")
)) {
    Ensure-Directory -Path $directory
}

$runtimeRoot = Join-Path $DataRoot "runtime"
$logsRoot = Join-Path $DataRoot "logs"
$backendControl = Join-Path $runtimeRoot "backend.pid.json"
$frontendControl = Join-Path $runtimeRoot "frontend.pid.json"

foreach ($item in @(
    @{ Path = $backendControl; Marker = $backendEntry; Name = "backend" },
    @{ Path = $frontendControl; Marker = $frontendEntry; Name = "frontend" }
)) {
    $record = Get-ControlRecord -Path $item.Path
    if ($null -ne $record) {
        if (Test-ControlledProcess -Record $record -ExpectedMarker $item.Marker) {
            throw "El $($item.Name) ya está ejecutándose con PID $($record.pid)."
        }
        Remove-Item -LiteralPath $item.Path -Force
    }
}

$nodeExecutable = (Get-Command node).Source
$startedProcesses = @()
try {
    Write-Host "Iniciando backend productivo..."
    $backendStart = @{
        FilePath = $nodeExecutable
        ArgumentList = @('"' + $backendEntry + '"')
        WorkingDirectory = (Join-Path $ArtifactRoot "backend")
        RedirectStandardOutput = (Join-Path $logsRoot "backend.out.log")
        RedirectStandardError = (Join-Path $logsRoot "backend.err.log")
        WindowStyle = "Hidden"
        PassThru = $true
    }
    $backendProcess = Start-Process @backendStart
    $startedProcesses += $backendProcess
    Write-ControlRecord -Path $backendControl -ProcessId $backendProcess.Id -Component "backend" -Marker $backendEntry

    Write-Host "Iniciando frontend productivo..."
    $previousPort = [Environment]::GetEnvironmentVariable("PORT", "Process")
    $previousHostname = [Environment]::GetEnvironmentVariable("HOSTNAME", "Process")
    try {
        [Environment]::SetEnvironmentVariable("PORT", [string]$FrontendPort, "Process")
        [Environment]::SetEnvironmentVariable("HOSTNAME", "127.0.0.1", "Process")
        $frontendStart = @{
            FilePath = $nodeExecutable
            ArgumentList = @('"' + $frontendEntry + '"')
            WorkingDirectory = (Join-Path $ArtifactRoot "frontend")
            RedirectStandardOutput = (Join-Path $logsRoot "frontend.out.log")
            RedirectStandardError = (Join-Path $logsRoot "frontend.err.log")
            WindowStyle = "Hidden"
            PassThru = $true
        }
        $frontendProcess = Start-Process @frontendStart
    }
    finally {
        [Environment]::SetEnvironmentVariable("PORT", $previousPort, "Process")
        [Environment]::SetEnvironmentVariable("HOSTNAME", $previousHostname, "Process")
    }
    $startedProcesses += $frontendProcess
    Write-ControlRecord -Path $frontendControl -ProcessId $frontendProcess.Id -Component "frontend" -Marker $frontendEntry

    & (Join-Path $PSScriptRoot "health-check.ps1") -BackendUrl $BackendUrl -FrontendUrl $FrontendUrl -Attempts $HealthAttempts -DelaySeconds 2
    if ($LASTEXITCODE -ne 0) {
        throw "Los procesos iniciaron, pero no superaron el health check."
    }

    Write-Host "Sistema iniciado correctamente."
    exit 0
}
catch {
    foreach ($process in $startedProcesses) {
        $running = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($null -ne $running) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    foreach ($control in @($backendControl, $frontendControl)) {
        if (Test-Path -LiteralPath $control) {
            Remove-Item -LiteralPath $control -Force
        }
    }
    throw
}
