# Run only IDs that failed in the ORIGINAL full-suite JSON, twice, without overwriting that JSON.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$logs = Join-Path $repoRoot 'Envidence - Group08/logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Push-Location $projectRoot
try {
  $grep = & node scripts/list-failed-ids.mjs
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($grep)) {
    Write-Error 'Khong tim duoc failed IDs. Hay chay full suite truoc va giu file JSON.'
    exit 2
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  for ($i=1; $i -le 2; $i++) {
    $log = Join-Path $logs "rerun-failed-$stamp-round-$i.log"
    Write-Host "Rerun round $i – pattern: $grep"
    & npx playwright test --grep "$grep" --workers=1 --project=chromium --reporter=line 2>&1 | Tee-Object -FilePath $log
    $code = $LASTEXITCODE
    Write-Host "Round $i exit code: $code; log: $log"
  }
  Write-Host 'Review both rerun logs and original JSON; fill logs/FLAKY_RERUN_LOG.md'
}
finally { Pop-Location }
