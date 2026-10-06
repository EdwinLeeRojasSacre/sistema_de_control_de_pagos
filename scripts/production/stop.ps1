[CmdletBinding()]
param(
    [string]$DataRoot = "C:\ProgramData\SistemaControlPagos",
    [int]$GraceSeconds = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$DataRoot = Get-FullPath $DataRoot
$runtimeRoot = Join-Path $DataRoot "runtime"
$targets = @(
    @{ Path = (Join-Path $runtimeRoot "frontend.pid.json"); Marker = "\frontend\server.js"; Name = "frontend" },
    @{ Path = (Join-Path $runtimeRoot "backend.pid.json"); Marker = "\backend\dist\main.js"; Name = "backend" }
)

foreach ($target in $targets) {
    $record = Get-ControlRecord -Path $target.Path
    if ($null -eq $record) {
        Write-Host "No hay archivo de control activo para $($target.Name)."
        continue
    }

    if (-not (Test-ControlledProcess -Record $record -ExpectedMarker $target.Marker)) {
        Write-Warning "El PID registrado para $($target.Name) ya no corresponde al sistema; no se detendrá ningún proceso."
        Remove-Item -LiteralPath $target.Path -Force
        continue
    }

    $processId = [int]$record.pid
    Write-Host "Deteniendo $($target.Name) (PID $processId)..."
    Stop-Process -Id $processId
    $deadline = (Get-Date).AddSeconds($GraceSeconds)
    while ((Get-Process -Id $processId -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        Stop-Process -Id $processId -Force
    }
    Remove-Item -LiteralPath $target.Path -Force
}

Write-Host "Procesos controlados del sistema detenidos."
exit 0
