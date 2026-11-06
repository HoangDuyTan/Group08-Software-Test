# PowerShell script: run from anywhere; requires npm ci and Playwright Chromium installed.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$logFolder = Join-Path $repoRoot 'Envidence - Group08/logs'
New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
if (-not (Test-Path (Join-Path $projectRoot 'node_modules/@playwright/test'))) {
  Write-Error 'Chua co node_modules. Hay chay: cd "Automation Testing Project - Group08"; npm ci; npx playwright install chromium'
  exit 2
}
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $logFolder "group-suite-$runId.log"
$meta = Join-Path $logFolder "group-suite-$runId-metadata.txt"
$start = Get-Date
$gitCommit = 'snapshot/not-available'
try { $gitCommit = (& git -C $repoRoot rev-parse HEAD 2>$null) } catch {}
@(
  "Run ID: $runId",
  "Started: $($start.ToString('o'))",
  "Project: $projectRoot",
  "Git commit: $gitCommit",
  "Node: $(node --version)",
  "NPM: $(npm --version)",
  'Browser: Chromium',
  'Workers: 1; Retries: 0',
  'Target: https://didongviet.vn/'
) | Set-Content -Path $meta -Encoding UTF8
Push-Location $projectRoot
try {
  & npx playwright test --workers=1 --project=chromium 2>&1 | Tee-Object -FilePath $log
  $code = $LASTEXITCODE
  $end = Get-Date
  @(
    "Ended: $($end.ToString('o'))",
    "ElapsedSeconds: $([math]::Round(($end - $start).TotalSeconds,2))",
    "ExitCode: $code",
    "ConsoleLog: $log"
  ) | Add-Content -Path $meta -Encoding UTF8
  # Convert JSON results into a human-readable group summary, if present.
  & node 'scripts/summarize-report.mjs'
  Write-Host "See Test Report - Group08/html-report/index.html and the log: $log"
  exit $code
}
finally { Pop-Location }
