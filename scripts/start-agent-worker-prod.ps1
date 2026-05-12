param(
  [switch]$Once,
  [switch]$AutoDeploy
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $repoRoot '.env.worker.production'

function Set-DefaultEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $currentValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ([string]::IsNullOrWhiteSpace($currentValue)) {
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
  }
}

function Import-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
      continue
    }

    if ($trimmed -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      continue
    }

    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

Import-EnvFile -Path $envFile

Set-DefaultEnv -Name 'AGENT_API_BASE' -Value 'https://us-atl-06d422c8.vibetheftauto.xyz'
Set-DefaultEnv -Name 'AGENT_WORK_ROOT' -Value 'D:\agent-work'
Set-DefaultEnv -Name 'GIT_REMOTE' -Value 'https://github.com/younghans/vibe-theft-auto.git'
Set-DefaultEnv -Name 'GIT_BASE_BRANCH' -Value 'main'
Set-DefaultEnv -Name 'DEPLOY_ENABLED' -Value 'true'
Set-DefaultEnv -Name 'BACKEND_DEPLOY_COMMAND' -Value 'npm run deploy:colyseus'
Set-DefaultEnv -Name 'BACKEND_DEPLOY_STRATEGY' -Value 'command'
Set-DefaultEnv -Name 'BACKEND_VERIFY_URL' -Value 'https://us-atl-06d422c8.vibetheftauto.xyz/health'
Set-DefaultEnv -Name 'FRONTEND_VERIFY_URL' -Value 'https://www.vibetheftauto.xyz/'

if ($AutoDeploy) {
  [Environment]::SetEnvironmentVariable('AUTO_DEPLOY', 'true', 'Process')
}

$workerToken = [Environment]::GetEnvironmentVariable('AGENT_WORKER_TOKEN', 'Process')
if ([string]::IsNullOrWhiteSpace($workerToken) -or $workerToken -eq '<production worker token>') {
  Write-Error @"
Missing AGENT_WORKER_TOKEN.

Create $envFile with:
AGENT_WORKER_TOKEN=your-production-worker-token

That file is ignored by git. After that, run:
npm run worker:prod
"@
}

$workerArgs = @('scripts/agent-worker.mjs')
if ($Once) {
  $workerArgs += '--once'
}

Push-Location $repoRoot
try {
  & node @workerArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
