$ErrorActionPreference = "Stop"
$project = Split-Path $PSScriptRoot -Parent
Set-Location $project
$ref = Read-Host "Enter your Supabase project reference (the part before .supabase.co)"
Write-Host "A browser will open for Supabase login if needed." -ForegroundColor Cyan
npx.cmd supabase login
npx.cmd supabase link --project-ref $ref
Write-Host "Before continuing, set Razorpay secrets using the command shown in LIVE_DEPLOYMENT_GUIDE.md." -ForegroundColor Yellow
$continue = Read-Host "Have you set all three Razorpay secrets? Type YES to deploy"
if ($continue -ne "YES") { Write-Host "Stopped. No functions were deployed."; exit 1 }
npx.cmd supabase functions deploy create-razorpay-order --no-verify-jwt
npx.cmd supabase functions deploy verify-razorpay-payment --no-verify-jwt
npx.cmd supabase functions deploy razorpay-webhook --no-verify-jwt
Write-Host "All Version 2 Edge Functions are deployed." -ForegroundColor Green
Write-Host "Webhook URL: https://$ref.supabase.co/functions/v1/razorpay-webhook"
