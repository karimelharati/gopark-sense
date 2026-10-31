$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableNode = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\node'
if (Test-Path -LiteralPath (Join-Path $portableNode 'node.exe')) {
    $env:PATH = $portableNode + ';' + $env:PATH
}
if (-not (Test-Path -LiteralPath 'dist\server\wrangler.json')) {
    throw 'Build the app first with npm.cmd run build. See README.md.'
}
& npm.cmd start -- --port 4173
