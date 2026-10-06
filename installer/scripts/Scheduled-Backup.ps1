[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [string]$DataRoot = "C:\ProgramData\SistemaControlPagos"
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $DataRoot "config\backend.env"
$databaseLine = Get-Content -LiteralPath $configPath | Where-Object { $_ -like 'DATABASE_URL=*' } | Select-Object -First 1
$postgresqlBinLine = Get-Content -LiteralPath $configPath | Where-Object { $_ -like 'POSTGRESQL_BIN=*' } | Select-Object -First 1
if (-not $databaseLine) { throw "No se encontró DATABASE_URL en la configuración protegida." }
$value = $databaseLine.Substring('DATABASE_URL='.Length).Trim().Trim('"')
$uri = [Uri]$value
$credentials = $uri.UserInfo.Split(':', 2)
$databaseName = $uri.AbsolutePath.TrimStart('/')
[Environment]::SetEnvironmentVariable('PGPASSWORD', [Uri]::UnescapeDataString($credentials[1]), 'Process')
try {
    $pgDump = if ($postgresqlBinLine) { Join-Path ($postgresqlBinLine.Substring('POSTGRESQL_BIN='.Length).Trim().Trim('"')) 'pg_dump.exe' } else { 'pg_dump' }
    & (Join-Path $ApplicationRoot "scripts\backup.ps1") -DataRoot $DataRoot -DatabaseHost $uri.Host -DatabasePort $uri.Port -DatabaseName $databaseName -DatabaseUser ([Uri]::UnescapeDataString($credentials[0])) -PgDumpExecutable $pgDump
    if ($LASTEXITCODE -ne 0) { throw "El respaldo programado falló." }
} finally { [Environment]::SetEnvironmentVariable('PGPASSWORD', $null, 'Process') }
