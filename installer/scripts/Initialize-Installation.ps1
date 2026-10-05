[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$DataRoot,
    [Parameter(Mandatory = $true)][string]$PostgreSqlBin,
    [int]$BackendPort = 3001,
    [int]$FrontendPort = 3000,
    [switch]$SkipAcl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Environment([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) { throw "Falta el dato requerido: $Name" }
    return $value
}
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "La inicialización no pudo completarse (código $LASTEXITCODE)." }
}
function Quote-EnvValue([string]$Value) { return '"' + $Value.Replace('"', '\"') + '"' }
function Import-EnvFile([string]$Path) {
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -ne 2) { continue }
        $value = $parts[1].Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($parts[0], $value, 'Process')
    }
}

$applicationRoot = [IO.Path]::GetFullPath($ApplicationRoot)
$dataRoot = [IO.Path]::GetFullPath($DataRoot)
$configDirectory = Join-Path $dataRoot "config"
$configPath = Join-Path $configDirectory "backend.env"
foreach ($directory in @($configDirectory, (Join-Path $dataRoot "logs\backend"), (Join-Path $dataRoot "logs\frontend"), (Join-Path $dataRoot "storage\vouchers"), (Join-Path $dataRoot "backups"))) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$freshInstallation = -not (Test-Path -LiteralPath $configPath -PathType Leaf)
if ($freshInstallation) {
    $databaseHost = Require-Environment "SCP_DB_HOST"
    $databasePort = Require-Environment "SCP_DB_PORT"
    $databaseName = Require-Environment "SCP_DB_NAME"
    $databaseUser = Require-Environment "SCP_DB_USER"
    $databasePassword = Require-Environment "SCP_DB_PASSWORD"
    if ($databaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,62}$') { throw "El nombre de base de datos no es válido." }
    $parsedPort = 0
    if (-not [int]::TryParse($databasePort, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) { throw "El puerto PostgreSQL no es válido." }

    $psql = Join-Path $PostgreSqlBin "psql.exe"
    $createdb = Join-Path $PostgreSqlBin "createdb.exe"
    if (-not (Test-Path -LiteralPath $psql) -or -not (Test-Path -LiteralPath $createdb)) { throw "No se encontraron las herramientas de PostgreSQL." }
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $databasePassword, "Process")
    $existingOutput = & $psql --host=$databaseHost --port=$parsedPort --username=$databaseUser --dbname=postgres --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = '$databaseName';"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo validar la conexión con PostgreSQL." }
    $existing = ($existingOutput | Out-String).Trim()
    if ($existing -ne "1") {
        Invoke-Checked $createdb @("--host=$databaseHost", "--port=$parsedPort", "--username=$databaseUser", "--encoding=UTF8", $databaseName)
        Write-Host "Base de datos creada correctamente."
    }

    $databaseUrl = "postgresql://$([Uri]::EscapeDataString($databaseUser)):$([Uri]::EscapeDataString($databasePassword))@${databaseHost}:${parsedPort}/${databaseName}?schema=sgpe"
    $random = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($random) } finally { $generator.Dispose() }
    $jwtSecret = [Convert]::ToBase64String($random).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $lines = @(
        "NODE_ENV=production", "PORT=$BackendPort", "FRONTEND_ORIGIN=http://localhost:$FrontendPort",
        "DATABASE_URL=$(Quote-EnvValue $databaseUrl)", "JWT_SECRET=$(Quote-EnvValue $jwtSecret)", "JWT_EXPIRES_IN=8h",
        "VOUCHER_STORAGE_PATH=$(Quote-EnvValue (Join-Path $dataRoot 'storage\vouchers'))",
        "POSTGRESQL_BIN=$(Quote-EnvValue ([IO.Path]::GetFullPath($PostgreSqlBin)))"
    )
    [IO.File]::WriteAllLines($configPath, $lines, (New-Object Text.UTF8Encoding($false)))
} else {
    Write-Host "Configuración existente detectada; se preservan base de datos, JWT y administrador."
    Import-EnvFile $configPath
    $databaseUrl = Require-Environment "DATABASE_URL"
    $uri = [Uri]$databaseUrl
    $credentials = $uri.UserInfo.Split(':', 2)
    $databaseHost = $uri.Host
    $parsedPort = $uri.Port
    $databaseName = $uri.AbsolutePath.TrimStart('/')
    $databaseUser = [Uri]::UnescapeDataString($credentials[0])
    $databasePassword = [Uri]::UnescapeDataString($credentials[1])
    $configuredBin = [Environment]::GetEnvironmentVariable('POSTGRESQL_BIN', 'Process')
    if ($configuredBin) { $PostgreSqlBin = $configuredBin }
    $psql = Join-Path $PostgreSqlBin "psql.exe"
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $databasePassword, "Process")
}

try {
    if (-not $SkipAcl) {
        & icacls.exe $dataRoot /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-19:(OI)(CI)RX" | Out-Null
        & icacls.exe (Join-Path $dataRoot "logs") /grant:r "*S-1-5-19:(OI)(CI)M" | Out-Null
        & icacls.exe (Join-Path $dataRoot "storage") /grant:r "*S-1-5-19:(OI)(CI)M" | Out-Null
        & icacls.exe (Join-Path $dataRoot "backups") /grant:r "*S-1-5-19:(OI)(CI)M" | Out-Null
        & icacls.exe $configPath /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" "*S-1-5-19:R" | Out-Null
    }

    $node = Join-Path $applicationRoot "runtime\node\node.exe"
    $prisma = Join-Path $applicationRoot "migration-tools\node_modules\prisma\build\index.js"
    $schema = Join-Path $applicationRoot "backend\prisma\schema.prisma"
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $databaseUrl, "Process")
    Invoke-Checked $node @($prisma, "migrate", "deploy", "--schema", $schema)
    if (Test-Path -LiteralPath (Join-Path $applicationRoot "migration-tools")) {
        Remove-Item -LiteralPath (Join-Path $applicationRoot "migration-tools") -Recurse -Force
    }

    $adminCountOutput = & $psql --host=$databaseHost --port=$parsedPort --username=$databaseUser --dbname=$databaseName --tuples-only --no-align --command="SELECT COUNT(*) FROM sgpe.users u JOIN sgpe.roles r ON r.id=u.role_id JOIN sgpe.persons p ON p.id=u.person_id WHERE r.code='ADMINISTRADOR' AND u.is_active AND r.is_active AND p.is_active;"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo validar el administrador inicial." }
    $adminCount = ($adminCountOutput | Out-String).Trim()
    if ($adminCount -eq "0") {
        foreach ($name in @('SETUP_ADMIN_FIRST_NAME','SETUP_ADMIN_LAST_NAME_FATHER','SETUP_ADMIN_DOCUMENT_TYPE','SETUP_ADMIN_DOCUMENT_NUMBER','SETUP_ADMIN_EMAIL','SETUP_ADMIN_USERNAME','SETUP_ADMIN_PASSWORD')) { [void](Require-Environment $name) }
        Invoke-Checked $node @((Join-Path $applicationRoot "backend\dist\setup-admin\setup-admin.cli.js"))
    }
} finally {
    foreach ($name in @('PGPASSWORD','DATABASE_URL','JWT_SECRET','SCP_DB_PASSWORD','SETUP_ADMIN_PASSWORD')) { [Environment]::SetEnvironmentVariable($name, $null, "Process") }
}

Write-Host "Inicialización completada correctamente."
