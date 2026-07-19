param(
  [string]$RepoUrl = "https://github.com/saga0003/quizmaker2.git",
  [string]$Branch = "import/scholaros-v4",
  [string]$TargetFolder = ""
)

$ErrorActionPreference = "Stop"
$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($TargetFolder)) {
  $TargetFolder = Join-Path (Split-Path $SourceRoot -Parent) "quizmaker2-v4-import"
}

Write-Host "ScholarOS safe GitHub import" -ForegroundColor Cyan
Write-Host "Source: $SourceRoot"
Write-Host "Target: $TargetFolder"
Write-Host "Branch: $Branch"

foreach ($command in @("git", "node", "npm")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command is not installed or is not available in PATH."
  }
}

if (Test-Path $TargetFolder) {
  throw "Target folder already exists. Remove it or choose another -TargetFolder. Nothing was changed."
}

# Never copy local credentials or generated Vercel state.
$forbidden = @(
  (Join-Path $SourceRoot ".env"),
  (Join-Path $SourceRoot ".env.local"),
  (Join-Path $SourceRoot ".env.production"),
  (Join-Path $SourceRoot ".vercel")
)
foreach ($item in $forbidden) {
  if (Test-Path $item) {
    throw "Unsafe local file/folder found: $item. Remove it before importing."
  }
}

Write-Host "Cloning the existing repository..." -ForegroundColor Yellow
git clone $RepoUrl $TargetFolder
Set-Location $TargetFolder

git switch -c $Branch

# Remove files tracked by the old application while preserving .git and history.
git rm -r .

Write-Host "Copying ScholarOS V4 into the repository root..." -ForegroundColor Yellow
Get-ChildItem -LiteralPath $SourceRoot -Force | Where-Object { $_.Name -ne ".git" } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $TargetFolder -Recurse -Force
}

# Remove generated/transfer-only files even if they appear in a future package.
Remove-Item -LiteralPath (Join-Path $TargetFolder "tsconfig.tsbuildinfo") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $TargetFolder "public\scholaros-v4-source.tar.gz") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $TargetFolder ".vercel") -Recurse -Force -ErrorAction SilentlyContinue

# Ensure only safe example environment files can be committed.
$gitignorePath = Join-Path $TargetFolder ".gitignore"
$gitignore = Get-Content $gitignorePath -Raw
if ($gitignore -notmatch "(?m)^!\.env\.example$") {
  Add-Content $gitignorePath "`n# Keep safe configuration templates in Git`n!.env.example`n!supabase/.env.functions.example"
}

# Reject unexpectedly large files before Git staging.
$largeFiles = Get-ChildItem $TargetFolder -Recurse -File -Force |
  Where-Object { $_.FullName -notlike "*\.git\*" -and $_.Length -gt 90MB }
if ($largeFiles) {
  $largeFiles | ForEach-Object { Write-Host $_.FullName -ForegroundColor Red }
  throw "Files larger than 90 MB were found. Review them before continuing."
}

Write-Host "Installing locked dependencies..." -ForegroundColor Yellow
npm ci

Write-Host "Running lint and production build..." -ForegroundColor Yellow
npm run check

# Generated folders are ignored; stage the actual source replacement.
git add -A

Write-Host "`nValidation passed. Nothing has been committed or pushed." -ForegroundColor Green
Write-Host "Review the files below:" -ForegroundColor Cyan
git status --short
Write-Host "`nSummary:" -ForegroundColor Cyan
git diff --cached --stat
Write-Host "`nAfter reviewing, run these commands from:" -ForegroundColor Cyan
Write-Host $TargetFolder
Write-Host 'git commit -m "Import ScholarOS V4 integrated platform"'
Write-Host "git push -u origin $Branch"
