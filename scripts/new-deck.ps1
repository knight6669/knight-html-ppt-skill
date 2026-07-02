# knight-html-ppt-skill :: new-deck.ps1 - scaffold a new deck from templates/deck.html
#
# Usage:
#   .\scripts\new-deck.ps1 my-talk
#   .\scripts\new-deck.ps1 my-talk C:\work\slides
#
# Creates <parent>\<name>\index.html and rewrites shared asset paths so the
# generated deck can live inside or outside this skill directory.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Name,

  [Parameter(Position = 1)]
  [string]$ParentDir = "examples"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-HtmlRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FromDir,

    [Parameter(Mandatory = $true)]
    [string]$ToPath
  )

  $fromFull = [System.IO.Path]::GetFullPath($FromDir)
  $toFull = [System.IO.Path]::GetFullPath($ToPath)

  if (-not $fromFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $fromFull += [System.IO.Path]::DirectorySeparatorChar
  }

  $fromUri = [System.Uri]::new($fromFull)
  $toUri = [System.Uri]::new($toFull)
  $relative = $fromUri.MakeRelativeUri($toUri).ToString()
  return [System.Uri]::UnescapeDataString($relative).Replace("\", "/")
}

if ([string]::IsNullOrWhiteSpace($Name)) {
  throw "Deck name is required."
}

if ($Name.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
  throw "Deck name contains invalid file name characters: $Name"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillRoot = Split-Path -Parent $scriptDir
$template = Join-Path $skillRoot "templates\deck.html"

if (-not (Test-Path -LiteralPath $template -PathType Leaf)) {
  throw "Template not found at $template"
}

if ([System.IO.Path]::IsPathRooted($ParentDir)) {
  $parentPath = $ParentDir
} else {
  $parentPath = Join-Path $skillRoot $ParentDir
}

$outDir = Join-Path $parentPath $Name
if (Test-Path -LiteralPath $outDir) {
  throw "Output directory already exists: $outDir"
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$assetsDir = Join-Path $skillRoot "assets"
$assetsHref = (Get-HtmlRelativePath -FromDir $outDir -ToPath $assetsDir).TrimEnd("/") + "/"

$html = Get-Content -LiteralPath $template -Raw -Encoding UTF8
$html = $html `
  -replace 'href="\.\./assets/', "href=`"$assetsHref" `
  -replace 'src="\.\./assets/', "src=`"$assetsHref" `
  -replace 'data-theme-base="\.\./assets/', "data-theme-base=`"$assetsHref"

$outFile = Join-Path $outDir "index.html"
Set-Content -LiteralPath $outFile -Value $html -Encoding UTF8

Write-Host "created $outFile"
Write-Host ""
Write-Host "next steps:"
Write-Host "  Start-Process `"$outFile`""
Write-Host "  # press T to cycle themes, V to edit, Left/Right to navigate, O for overview"
Write-Host ""
Write-Host "  # render to PNG:"
Write-Host "  $scriptDir\render.ps1 `"$outFile`" all"
