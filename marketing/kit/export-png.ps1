# Renders each SVG in this folder to a PNG with headless Microsoft Edge.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File marketing\kit\export-png.ps1
# Needs internet for the Google Fonts @import (falls back to system fonts otherwise).
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$kit = $PSScriptRoot
$prof = Join-Path $env:TEMP "tally-kit-edge"
$jobs = @(
  @("social-square-en", 1080, 1080), @("social-square-zh", 1080, 1080),
  @("social-vertical-en", 1080, 1920), @("social-vertical-zh", 1080, 1920),
  @("og-image", 1200, 630)
)
foreach ($j in $jobs) {
  $n = $j[0]; $w = $j[1]; $h = $j[2]
  $src = "file:///" + ($kit -replace '\\', '/') + "/$n.svg"
  & $edge --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --force-device-scale-factor=1 --window-size="$w,$h" --virtual-time-budget=8000 --screenshot="$kit\$n.png" $src 2>$null | Out-Null
  Start-Sleep -Milliseconds 300
  Write-Output "exported $n.png"
}
$public = Join-Path (Split-Path (Split-Path $kit)) "public\og-image.png"
Copy-Item "$kit\og-image.png" $public -Force
Write-Output "copied og-image.png to public\"
