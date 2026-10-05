[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [string]$TaskSuffix = "",
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$BackupTime = "02:00"
)

$ErrorActionPreference = "Stop"
$taskName = "SistemaControlPagosBackup$TaskSuffix"
$script = Join-Path $ApplicationRoot "scripts\Scheduled-Backup.ps1"
$action = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`" -ApplicationRoot `"$ApplicationRoot`""
& schtasks.exe /Create /TN $taskName /SC DAILY /ST $BackupTime /RU SYSTEM /RL HIGHEST /TR $action /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se pudo registrar la tarea de respaldo." }
