[CmdletBinding()]
param(
    [string]$BackendUrl = "http://127.0.0.1:3001",
    [string]$FrontendUrl = "http://127.0.0.1:3000",
    [int]$Attempts = 1,
    [int]$DelaySeconds = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri ($BackendUrl.TrimEnd("/") + "/health") -Method Get -TimeoutSec 10
        if ($health.status -ne "ok" -or $health.database -ne "ok") {
            throw "El backend respondió con estado no saludable."
        }

        $frontend = Invoke-WebRequest -Uri $FrontendUrl -Method Get -TimeoutSec 10 -UseBasicParsing
        if ([int]$frontend.StatusCode -lt 200 -or [int]$frontend.StatusCode -ge 400) {
            throw "El frontend respondió HTTP $($frontend.StatusCode)."
        }

        Write-Host "Health check correcto: backend, PostgreSQL y frontend disponibles."
        exit 0
    }
    catch {
        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
            continue
        }
        Write-Error "Health check fallido: $($_.Exception.Message)"
        exit 1
    }
}
