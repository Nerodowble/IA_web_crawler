$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$cloudflared = Join-Path $env:LOCALAPPDATA 'Programs\cloudflared\cloudflared.exe'
$tokenFile = Join-Path $project '.remote-access-token'
$token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()

if (-not $token) { throw 'Token remoto ausente em .remote-access-token.' }
if (-not (Test-Path -LiteralPath $cloudflared)) { throw "cloudflared não encontrado: $cloudflared" }

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$ready = $false
if ($listener) {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2 | Out-Null
    $ready = $true
  } catch { throw 'A porta 3000 está ocupada por outro serviço.' }
} else {
  $node = (Get-Command node -ErrorAction Stop).Source
  Start-Process -FilePath $node -ArgumentList 'src/server.js' -WorkingDirectory $project `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $project '.server.log') `
    -RedirectStandardError (Join-Path $project '.server-error.log') | Out-Null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch { Start-Sleep -Seconds 1 }
  }
}
if (-not $ready) { throw 'A API não iniciou. Consulte .server-error.log.' }

$outLog = Join-Path $project '.cloudflared.log'
$errLog = Join-Path $project '.cloudflared-error.log'
if (-not (Get-Process -Name cloudflared -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $cloudflared -ArgumentList 'tunnel --no-autoupdate --url http://127.0.0.1:3000' `
    -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog | Out-Null
}

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  foreach ($log in @($outLog, $errLog)) {
    if (Test-Path -LiteralPath $log) {
      $content = [string](Get-Content -LiteralPath $log -Raw)
      $url = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com').Value
      if ($url) { break }
    }
  }
  if (-not $url) { Start-Sleep -Seconds 1 }
}
if (-not $url) { throw 'O túnel não gerou endereço. Consulte .cloudflared-error.log.' }

Write-Host "API remota: $url/api/chat"
Write-Host "Token Bearer salvo em: $tokenFile"
Write-Host 'Deixe este computador ligado; Ctrl+C nesta janela não encerra o serviço em segundo plano.'
