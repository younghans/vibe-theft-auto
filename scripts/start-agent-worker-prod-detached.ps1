param(
  [switch]$AutoDeploy,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$launcher = Join-Path $PSScriptRoot 'start-agent-worker-prod.ps1'
$controlScript = Join-Path $repoRoot 'scripts\agent-worker-control.mjs'

function Invoke-WorkerStatus {
  Push-Location $repoRoot
  try {
    return (& node $controlScript status 2>&1 | Out-String)
  } finally {
    Pop-Location
  }
}

function Test-WorkerActive {
  param([string]$StatusText)

  return $StatusText -match '(?m)^worker:\s+active\b'
}

if ($Check) {
  $checkArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher, '-Check')
  if ($AutoDeploy) {
    $checkArgs += '-AutoDeploy'
  }

  & powershell @checkArgs
  exit $LASTEXITCODE
}

$currentStatus = Invoke-WorkerStatus
if (Test-WorkerActive -StatusText $currentStatus) {
  Write-Host 'Production worker is already active; not starting another instance.'
  Write-Host $currentStatus.TrimEnd()
  exit 0
}

$workerArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher)
if ($AutoDeploy) {
  $workerArgs += '-AutoDeploy'
}

Start-Process powershell `
  -ArgumentList $workerArgs `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Seconds 1
  $status = Invoke-WorkerStatus
  if (Test-WorkerActive -StatusText $status) {
    Write-Host 'Detached production worker started.'
    Write-Host $status.TrimEnd()
    exit 0
  }
} while ((Get-Date) -lt $deadline)

Write-Error "Detached production worker did not become active within 30 seconds. Last status:`n$status"
