[CmdletBinding()]
param(
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 3001,
    [string]$ServiceSuffix = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ServiceProcessId([string]$ServiceName) {
    $output = & sc.exe queryex $ServiceName 2>$null
    if ($LASTEXITCODE -ne 0) { return 0 }
    $match = $output | Select-String -Pattern 'PID\s*:\s*(\d+)'
    if (-not $match) { return 0 }
    return [int]$match.Matches[0].Groups[1].Value
}

function Get-ListeningProcessIds([int]$Port) {
    try {
        return @(
            Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
                Select-Object -ExpandProperty OwningProcess -Unique
        )
    } catch {
        $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
        return @(
            & netstat.exe -ano -p tcp |
                ForEach-Object {
                    if ($_ -match $pattern) { [int]$Matches[1] }
                } |
                Sort-Object -Unique
        )
    }
}

$checks = @(
    @{ Port=$BackendPort; Service="SistemaControlPagosBackend$ServiceSuffix" },
    @{ Port=$FrontendPort; Service="SistemaControlPagosFrontend$ServiceSuffix" }
)
foreach ($check in $checks) {
    $listenerPids = @(Get-ListeningProcessIds $check.Port)
    foreach ($listenerPid in $listenerPids) {
        $servicePid = Get-ServiceProcessId $check.Service
        if ($listenerPid -ne $servicePid -or $servicePid -eq 0) {
            throw "El puerto $($check.Port) está ocupado por otro proceso (PID $listenerPid). Cierre la aplicación que lo utiliza y vuelva a intentar."
        }
    }
}
Write-Host "Puertos $FrontendPort y $BackendPort disponibles."
