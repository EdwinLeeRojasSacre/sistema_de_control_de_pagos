[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$DataRoot,
    [string]$ServiceSuffix = "",
    [int]$FrontendPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$backendId = "SistemaControlPagosBackend$ServiceSuffix"
$frontendId = "SistemaControlPagosFrontend$ServiceSuffix"
$services = @(
    @{ Id=$backendId; Display="Sistema de Control de Pagos - Backend$ServiceSuffix"; Template="SistemaControlPagosBackend.xml"; Folder="backend" },
    @{ Id=$frontendId; Display="Sistema de Control de Pagos - Frontend$ServiceSuffix"; Template="SistemaControlPagosFrontend.xml"; Folder="frontend" }
)
foreach ($service in $services) {
    $directory = Join-Path $ApplicationRoot ("services\" + $service.Folder)
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $executable = Join-Path $directory ($service.Id + ".exe")
    $xmlPath = Join-Path $directory ($service.Id + ".xml")
    Copy-Item -LiteralPath (Join-Path $ApplicationRoot "tools\WinSW-x64.exe") -Destination $executable -Force
    $xml = Get-Content -Raw -LiteralPath (Join-Path $ApplicationRoot ("templates\" + $service.Template))
    $xml = $xml.Replace("{{SERVICE_ID}}", $service.Id).Replace("{{DISPLAY_NAME}}", $service.Display).Replace("{{NODE_EXECUTABLE}}", (Join-Path $ApplicationRoot "runtime\node\node.exe")).Replace("{{APPLICATION_ROOT}}", $ApplicationRoot).Replace("{{DATA_ROOT}}", $DataRoot).Replace("{{FRONTEND_PORT}}", [string]$FrontendPort).Replace("{{BACKEND_SERVICE_ID}}", $backendId)
    [IO.File]::WriteAllText($xmlPath, $xml, (New-Object Text.UTF8Encoding($false)))
    & sc.exe query $service.Id 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { & $executable refresh } else { & $executable install }
    if ($LASTEXITCODE -ne 0) { throw "No se pudo instalar o actualizar el servicio $($service.Id)." }
}
foreach ($service in $services) {
    $executable = Join-Path $ApplicationRoot ("services\" + $service.Folder + "\" + $service.Id + ".exe")
    & $executable start
    if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar el servicio $($service.Id)." }
}
