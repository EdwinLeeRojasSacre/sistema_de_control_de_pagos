[CmdletBinding()]
param([string]$OutputDirectory = (Join-Path $PSScriptRoot "..\build-output\launcher"))

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$icon = Join-Path $PSScriptRoot "..\assets\SistemaControlPagos.ico"
& (Join-Path $PSScriptRoot "Create-Icon.ps1") -DestinationIco $icon

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) { throw "No se encontró el compilador C# de Windows." }

& $compiler /nologo /target:winexe /optimize+ "/win32icon:$icon" "/out:$OutputDirectory\SistemaControlPagos.exe" "/reference:System.dll" "/reference:System.Windows.Forms.dll" "/reference:System.Web.Extensions.dll" (Join-Path $PSScriptRoot "..\launcher\Program.cs")
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del launcher." }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "..\launcher\launcher.config.example.json") -Destination (Join-Path $OutputDirectory "launcher.config.json") -Force
Write-Host "Launcher generado: $OutputDirectory\SistemaControlPagos.exe"
