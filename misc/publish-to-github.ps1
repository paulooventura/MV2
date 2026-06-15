# Publish Mind & Venture web build to GitHub (+ GitHub Pages).
# Usage:
#   powershell -ExecutionPolicy Bypass -File misc\publish-to-github.ps1 -RepoUrl "https://github.com/YOU/mind-and-venture.git"
param(
  [Parameter(Mandatory=$true)]
  [string]$RepoUrl
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Error "Missing $name. Install Git from https://git-scm.com/download/win"
    exit 1
  }
}

Require-Cmd git

$lfs = Get-Command git-lfs -ErrorAction SilentlyContinue
if ($lfs) {
  git lfs install 2>$null | Out-Null
  Write-Host "Git LFS ready (large .wav/.mp3 files)."
} else {
  Write-Warning "Git LFS not installed — push may fail or be very slow (~600MB audio)."
  Write-Warning "Install from https://git-lfs.com then re-run this script."
}

if (-not (Test-Path .git)) {
  git init
  git branch -M main
}

$remote = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0) {
  git remote add origin $RepoUrl
} elseif ($remote -ne $RepoUrl) {
  git remote set-url origin $RepoUrl
}

git add -A
$status = git status --porcelain
if (-not $status) {
  Write-Host "Nothing new to commit."
} else {
  git commit -m "Publish full web build for GitHub Pages."
}

Write-Host ""
Write-Host "Pushing to $RepoUrl ..."
git push -u origin main

Write-Host ""
Write-Host "=== NEXT: turn on GitHub Pages ==="
Write-Host "1. Open your repo on GitHub.com"
Write-Host "2. Settings -> Pages"
Write-Host "3. Source: Deploy from branch -> main -> / (root) -> Save"
Write-Host "4. Wait ~1-2 min. Game URL:"
Write-Host "   https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/"
Write-Host ""
Write-Host "Open that URL on your phone — same game as local, over HTTPS."
