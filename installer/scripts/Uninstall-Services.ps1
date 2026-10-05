[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$ApplicationRoot, [string]$ServiceSuffix = "")

$ErrorActionPreference = "Continue"
foreach ($item in @(@("frontend", "SistemaControlPagosFrontend$ServiceSuffix"), @("backend", "SistemaControlPagosBackend$ServiceSuffix"))) {
    $executable = Join-Path $ApplicationRoot ("services\" + $item[0] + "\" + $item[1] + ".exe")
    if (Test-Path -LiteralPath $executable) {
        & $executable stop | Out-Null
        & $executable uninstall | Out-Null
    }
}
exit 0
