$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "ScholarOS Version 4 - Hostinger build" -ForegroundColor Cyan
if (-not (Test-Path ".\package.json")) { throw "package.json not found. Open the terminal in the Version 4 project folder." }
if (-not (Test-Path ".\.env.local")) { throw ".env.local not found. Copy your working Version 3 Supabase settings first." }
$envText = Get-Content ".\.env.local" -Raw
if ($envText -match "YOUR_PROJECT|REPLACE_ME|your-project|your-anon-key") { throw ".env.local still contains placeholders." }

npm.cmd install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
$env:NEXT_TELEMETRY_DISABLED = "1"
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Next.js build failed." }

$required = @(
  "out\index.html",
  "out\login\index.html",
  "out\products\index.html",
  "out\admin\questions\import\index.html",
  "out\admin\papers\index.html",
  "out\admin\papers\new\index.html",
  "out\admin\papers\preview\index.html",
  "out\school\papers\index.html",
  "out\student\tests\index.html",
  "out\student\tests\take\index.html",
  "out\student\results\index.html",
  "out\templates\rankmint-question-template.xlsx",
  "out\templates\rankmint-image-format-test.csv",
  "out\templates\rankmint-image-format-test.zip"
)
foreach ($item in $required) { if (-not (Test-Path $item)) { throw "Build validation failed: missing $item" } }
$css = Get-ChildItem ".\out\_next" -Recurse -Filter "*.css" -ErrorAction SilentlyContinue
if (-not $css) { throw "Build validation failed: compiled CSS is missing." }

@'
DirectoryIndex index.html
Options -Indexes -MultiViews
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteCond %{DOCUMENT_ROOT}/$1/index.html -f
RewriteRule ^(.+?)/?$ $1/index.html [L]
</IfModule>
<IfModule mod_mime.c>
AddType text/css .css
AddType application/javascript .js
AddType font/woff2 .woff2
AddType image/avif .avif
AddType image/webp .webp
AddType image/svg+xml .svg
</IfModule>
ErrorDocument 404 /404.html
'@ | Set-Content ".\out\.htaccess" -Encoding UTF8

"ScholarOS Version 4 deployment package" | Set-Content ".\out\deployment-check.txt" -Encoding UTF8
$zip = Join-Path $root "rankmint-tests-v4-hostinger-upload.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $root "out"), $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "Hostinger files are in: $root\out" -ForegroundColor Yellow
Write-Host "ZIP created: $zip" -ForegroundColor Yellow
Write-Host "Your proven method remains safest: upload every item inside out directly into the active subdomain public_html." -ForegroundColor Cyan
