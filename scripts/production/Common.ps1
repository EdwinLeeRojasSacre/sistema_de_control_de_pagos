Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Assert-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontró el comando requerido: $Name"
    }
}

function Assert-NodeVersion {
    param([version]$MinimumVersion = [version]"20.19.0")
    Assert-CommandAvailable -Name "node"
    Assert-CommandAvailable -Name "npm"
    $rawVersion = (& node --version).Trim().TrimStart("v")
    $currentVersion = [version]$rawVersion
    if ($currentVersion -lt $MinimumVersion) {
        throw "Node.js $MinimumVersion o superior es requerido. Versión encontrada: $currentVersion"
    }
    Write-Host "Node.js $currentVersion y npm $(& npm --version) detectados."
}

function Import-EnvironmentFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No existe el archivo de configuración: $Path"
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2 -or $parts[0] -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
            throw "Línea inválida en el archivo de configuración: $($parts[0])"
        }
        $value = $parts[1].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        [Environment]::SetEnvironmentVariable($parts[0], $value, "Process")
    }
}

function Assert-RequiredEnvironment {
    param([Parameter(Mandatory = $true)][string[]]$Names)
    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name, "Process")
        if ([string]::IsNullOrWhiteSpace($value)) {
            throw "Falta la variable de entorno requerida: $name"
        }
    }
}

function Get-ControlRecord {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    try {
        return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    }
    catch {
        throw "El archivo de control no es válido: $Path"
    }
}

function Test-ControlledProcess {
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][string]$ExpectedMarker
    )
    $process = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }
    $markerMatches = [string]$Record.marker -like "*$ExpectedMarker"
    $pathMatches = [string]$process.Path -eq [string]$Record.executable
    $startMatches = $process.StartTime.ToUniversalTime().Ticks -eq [long]$Record.processStartTicks
    return $markerMatches -and $pathMatches -and $startMatches
}

function Write-ControlRecord {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Parameter(Mandatory = $true)][string]$Component,
        [Parameter(Mandatory = $true)][string]$Marker
    )
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    [ordered]@{
        pid = $ProcessId
        component = $Component
        marker = $Marker
        executable = $process.Path
        processStartTicks = $process.StartTime.ToUniversalTime().Ticks
        startedAt = (Get-Date).ToString("o")
    } | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}
