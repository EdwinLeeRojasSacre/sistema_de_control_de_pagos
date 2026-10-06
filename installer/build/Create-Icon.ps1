[CmdletBinding()]
param(
    [string]$SourcePng = (Join-Path $PSScriptRoot "..\..\frontend\public\images\insignia-jardin-85.png"),
    [string]$DestinationIco = (Join-Path $PSScriptRoot "..\assets\SistemaControlPagos.ico")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$destinationDirectory = Split-Path -Parent $DestinationIco
if (-not (Test-Path -LiteralPath $destinationDirectory)) {
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
}

$source = [System.Drawing.Image]::FromFile($SourcePng)
try {
    $frames = @()
    foreach ($size in @(16, 32, 48, 64, 128, 256)) {
        $bitmap = New-Object System.Drawing.Bitmap $size, $size
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
                $width = [int][Math]::Round($source.Width * $scale)
                $height = [int][Math]::Round($source.Height * $scale)
                $graphics.DrawImage($source, [int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height)
            } finally { $graphics.Dispose() }
            $stream = New-Object System.IO.MemoryStream
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames += ,$stream.ToArray()
            $stream.Dispose()
        } finally { $bitmap.Dispose() }
    }

    $output = [System.IO.File]::Create($DestinationIco)
    $writer = New-Object System.IO.BinaryWriter $output
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
        $offset = 6 + (16 * $frames.Count)
        for ($index = 0; $index -lt $frames.Count; $index++) {
            $size = @(16, 32, 48, 64, 128, 256)[$index]
            $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
            $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$index].Length); $writer.Write([uint32]$offset)
            $offset += $frames[$index].Length
        }
        foreach ($frame in $frames) { $writer.Write($frame) }
    } finally { $writer.Dispose(); $output.Dispose() }
} finally { $source.Dispose() }

Write-Host "Icono generado desde la insignia institucional: $DestinationIco"
