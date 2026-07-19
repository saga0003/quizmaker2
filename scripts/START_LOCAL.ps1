$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "Starting ScholarOS Version 2..." -ForegroundColor Cyan
npm.cmd run dev
