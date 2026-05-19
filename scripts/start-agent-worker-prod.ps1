param(
  [switch]$Once,
  [switch]$AutoDeploy,
  [switch]$Check
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

function Add-CodexCandidate {
  param(
    [Parameter(Mandatory = $true)]$Candidates,
    [Parameter(Mandatory = $true)]$Seen,
    [string]$Candidate
  )

  if ([string]::IsNullOrWhiteSpace($Candidate)) {
    return
  }

  $trimmed = $Candidate.Trim()
  if ($Seen.Add($trimmed)) {
    [void]$Candidates.Add($trimmed)
  }
}

function Test-CodexCommand {
  param([Parameter(Mandatory = $true)][string]$Command)

  try {
    $output = & $Command --version 2>&1
    if ($LASTEXITCODE -ne 0) {
      return $false
    }

    return -not [string]::IsNullOrWhiteSpace(($output | Out-String))
  } catch {
    return $false
  }
}

function Add-CommandCandidate {
  param(
    [Parameter(Mandatory = $true)]$Candidates,
    [Parameter(Mandatory = $true)]$Seen,
    [string]$Candidate
  )

  if ([string]::IsNullOrWhiteSpace($Candidate)) {
    return
  }

  $trimmed = $Candidate.Trim()
  if ($Seen.Add($trimmed)) {
    [void]$Candidates.Add($trimmed)
  }
}

function Test-GitCommand {
  param([Parameter(Mandatory = $true)][string]$Command)

  try {
    $output = & $Command --version 2>&1
    if ($LASTEXITCODE -ne 0) {
      return $false
    }

    return ($output | Out-String) -match '^git version '
  } catch {
    return $false
  }
}

function Resolve-GitCommand {
  $candidates = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $configuredCommand = [Environment]::GetEnvironmentVariable('GIT_COMMAND', 'Process')

  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $configuredCommand

  foreach ($candidate in @(
    'C:\Program Files\Git\cmd\git.exe',
    'C:\Program Files\Git\bin\git.exe',
    'C:\Program Files (x86)\Git\cmd\git.exe',
    'C:\Program Files (x86)\Git\bin\git.exe'
  )) {
    Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
  }

  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe')
    Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate (Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\git.exe')
  }

  try {
    foreach ($candidate in @(where.exe git 2>$null)) {
      Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
    }
  } catch {}

  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate 'git.exe'
  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate 'git.cmd'
  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate 'git'

  foreach ($candidate in $candidates) {
    if (Test-GitCommand -Command $candidate) {
      return $candidate
    }

    if (
      -not [string]::IsNullOrWhiteSpace($configuredCommand) -and
      $candidate -eq $configuredCommand
    ) {
      Write-Warning "Configured GIT_COMMAND did not respond to '--version'; trying auto-discovery."
    }
  }

  $candidateList = ($candidates | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
  Write-Error @"
Could not find a working Git command.

Install Git for Windows or set GIT_COMMAND in $envFile to an executable that supports:
  git --version

Tried:
$candidateList
"@
}

function Get-NodeCommandVersion {
  param([Parameter(Mandatory = $true)][string]$Command)

  try {
    $output = & $Command --version 2>&1
    if ($LASTEXITCODE -ne 0) {
      return ''
    }

    return ($output | Select-Object -First 1).ToString().Trim()
  } catch {
    return ''
  }
}

function Resolve-NodeCommand {
  $candidates = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $configuredCommand = [Environment]::GetEnvironmentVariable('NODE_COMMAND', 'Process')
  $fallbackCommand = ''
  $fallbackVersion = ''

  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $configuredCommand

  foreach ($candidate in @(
    'D:\tools\node22\node.exe',
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe'
  )) {
    Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
  }

  try {
    foreach ($candidate in @(where.exe node 2>$null)) {
      Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
    }
  } catch {}

  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate 'node.exe'
  Add-CommandCandidate -Candidates $candidates -Seen $seen -Candidate 'node'

  foreach ($candidate in $candidates) {
    $version = Get-NodeCommandVersion -Command $candidate
    if ([string]::IsNullOrWhiteSpace($version)) {
      if (
        -not [string]::IsNullOrWhiteSpace($configuredCommand) -and
        $candidate -eq $configuredCommand
      ) {
        Write-Warning "Configured NODE_COMMAND did not respond to '--version'; trying auto-discovery."
      }
      continue
    }

    if ([string]::IsNullOrWhiteSpace($fallbackCommand)) {
      $fallbackCommand = $candidate
      $fallbackVersion = $version
    }

    if ($version -match '^v22\.') {
      return $candidate
    }

    if (
      -not [string]::IsNullOrWhiteSpace($configuredCommand) -and
      $candidate -eq $configuredCommand
    ) {
      Write-Warning "Configured NODE_COMMAND reports $version, but this project expects Node 22.x; trying auto-discovery."
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($fallbackCommand)) {
    Write-Warning "Could not find Node 22.x; using $fallbackCommand ($fallbackVersion). Worker builds may differ from production."
    return $fallbackCommand
  }

  $candidateList = ($candidates | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
  Write-Error @"
Could not find a working Node.js command.

Install Node 22.x or set NODE_COMMAND in $envFile to an executable that supports:
  node --version

Tried:
$candidateList
"@
}

function Resolve-CodexCommand {
  $candidates = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $configuredCommand = [Environment]::GetEnvironmentVariable('CODEX_COMMAND', 'Process')

  Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate $configuredCommand

  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    Add-CodexCandidate `
      -Candidates $candidates `
      -Seen $seen `
      -Candidate (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin\codex.exe')
  }

  try {
    $pathCandidates = @(where.exe codex 2>$null)
    foreach ($candidate in ($pathCandidates | Where-Object { $_ -match '\.exe$' })) {
      Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
    }
    foreach ($candidate in ($pathCandidates | Where-Object { $_ -notmatch '\.exe$' })) {
      Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate $candidate
    }
  } catch {}

  try {
    $npmRoot = (& npm root -g 2>$null | Select-Object -First 1)
    if (-not [string]::IsNullOrWhiteSpace($npmRoot)) {
      $codexPackageRoot = Join-Path $npmRoot '@openai\codex'
      if (Test-Path -LiteralPath $codexPackageRoot) {
        Get-ChildItem -LiteralPath $codexPackageRoot -Filter codex.exe -Recurse -File -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -match '\\vendor\\' } |
          Sort-Object FullName |
          ForEach-Object {
            Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate $_.FullName
          }
      }

      $npmPrefix = Split-Path -Parent $npmRoot
      Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate (Join-Path $npmPrefix 'codex.cmd')
      Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate (Join-Path $npmPrefix 'codex')
    }
  } catch {}

  Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate 'codex.exe'
  Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate 'codex.cmd'
  Add-CodexCandidate -Candidates $candidates -Seen $seen -Candidate 'codex'

  foreach ($candidate in $candidates) {
    if (Test-CodexCommand -Command $candidate) {
      return $candidate
    }

    if (
      -not [string]::IsNullOrWhiteSpace($configuredCommand) -and
      $candidate -eq $configuredCommand
    ) {
      Write-Warning "Configured CODEX_COMMAND did not respond to '--version'; trying auto-discovery."
    }
  }

  $candidateList = ($candidates | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
  Write-Error @"
Could not find a working Codex CLI command.

Install Codex or set CODEX_COMMAND in $envFile to an executable that supports:
  codex --version

Tried:
$candidateList
"@
}

function Test-TruthyEnv {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  return @('1', 'true', 'yes') -contains $value.ToLowerInvariant()
}

function Test-BackendDeployGitManaged {
  $strategy = [Environment]::GetEnvironmentVariable('BACKEND_DEPLOY_STRATEGY', 'Process')
  return @('git', 'git-integration', 'colyseus-git') -contains $strategy.ToLowerInvariant()
}

function Test-ColyseusBackendDeployCommand {
  $command = [Environment]::GetEnvironmentVariable('BACKEND_DEPLOY_COMMAND', 'Process')
  $normalized = $command.ToLowerInvariant()
  return $normalized.Contains('deploy:colyseus') `
    -or $normalized.Contains('deploy-colyseus-noninteractive.mjs') `
    -or $normalized.Contains('@colyseus/cloud')
}

function Test-ColyseusDeployCredentials {
  $applicationId = [Environment]::GetEnvironmentVariable('COLYSEUS_APPLICATION_ID', 'Process')
  if ([string]::IsNullOrWhiteSpace($applicationId)) {
    $applicationId = [Environment]::GetEnvironmentVariable('COLYSEUS_APP_ID', 'Process')
  }

  $token = [Environment]::GetEnvironmentVariable('COLYSEUS_DEPLOY_TOKEN', 'Process')
  if ([string]::IsNullOrWhiteSpace($token)) {
    $token = [Environment]::GetEnvironmentVariable('COLYSEUS_TOKEN', 'Process')
  }

  if (-not [string]::IsNullOrWhiteSpace($applicationId) -and -not [string]::IsNullOrWhiteSpace($token)) {
    return $true
  }

  $colyseusConfigPath = Join-Path $repoRoot '.colyseus-cloud.json'
  if (-not (Test-Path -LiteralPath $colyseusConfigPath)) {
    return $false
  }

  try {
    $envName = [Environment]::GetEnvironmentVariable('COLYSEUS_DEPLOY_ENV', 'Process')
    if ([string]::IsNullOrWhiteSpace($envName)) {
      $envName = [Environment]::GetEnvironmentVariable('COLYSEUS_ENV', 'Process')
    }
    if ([string]::IsNullOrWhiteSpace($envName)) {
      $envName = 'production'
    }

    $config = (Get-Content -LiteralPath $colyseusConfigPath -Raw | ConvertFrom-Json).$envName
    return -not [string]::IsNullOrWhiteSpace($config.applicationId) `
      -and -not [string]::IsNullOrWhiteSpace($config.token)
  } catch {
    return $false
  }
}

Import-EnvFile -Path $envFile

Set-DefaultEnv -Name 'AGENT_API_BASE' -Value 'https://us-atl-06d422c8.vibetheftauto.xyz'
Set-DefaultEnv -Name 'AGENT_WORK_ROOT' -Value 'D:\agent-work'
Set-DefaultEnv -Name 'GIT_REMOTE' -Value 'https://github.com/younghans/vibe-theft-auto.git'
Set-DefaultEnv -Name 'GIT_BASE_BRANCH' -Value 'main'
Set-DefaultEnv -Name 'AGENT_START_DRAINED' -Value 'false'
Set-DefaultEnv -Name 'AGENT_CODE_CONCURRENCY' -Value '2'
Set-DefaultEnv -Name 'DEPLOY_ENABLED' -Value 'true'
Set-DefaultEnv -Name 'BACKEND_DEPLOY_COMMAND' -Value 'npm run deploy:colyseus'
Set-DefaultEnv -Name 'BACKEND_DEPLOY_STRATEGY' -Value 'command'
Set-DefaultEnv -Name 'BACKEND_VERIFY_URL' -Value 'https://us-atl-06d422c8.vibetheftauto.xyz/health'
Set-DefaultEnv -Name 'FRONTEND_VERIFY_URL' -Value 'https://www.vibetheftauto.xyz/'

if ($AutoDeploy) {
  [Environment]::SetEnvironmentVariable('AUTO_DEPLOY', 'true', 'Process')
}

$codexCommand = Resolve-CodexCommand
[Environment]::SetEnvironmentVariable('CODEX_COMMAND', $codexCommand, 'Process')
Write-Host "Using Codex command: $codexCommand"

$gitCommand = Resolve-GitCommand
[Environment]::SetEnvironmentVariable('GIT_COMMAND', $gitCommand, 'Process')
$gitCommandDirectory = Split-Path -Parent $gitCommand
if (-not [string]::IsNullOrWhiteSpace($gitCommandDirectory) -and (Test-Path -LiteralPath $gitCommandDirectory)) {
  $pathSeparator = [System.IO.Path]::PathSeparator
  $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'Process')
  $pathEntries = @($currentPath -split [Regex]::Escape([string]$pathSeparator) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if (-not ($pathEntries | Where-Object { $_ -ieq $gitCommandDirectory })) {
    [Environment]::SetEnvironmentVariable('PATH', "$gitCommandDirectory$pathSeparator$currentPath", 'Process')
  }
}
Write-Host "Using Git command: $gitCommand"

$nodeCommand = Resolve-NodeCommand
[Environment]::SetEnvironmentVariable('NODE_COMMAND', $nodeCommand, 'Process')
$nodeCommandDirectory = Split-Path -Parent $nodeCommand
if (-not [string]::IsNullOrWhiteSpace($nodeCommandDirectory) -and (Test-Path -LiteralPath $nodeCommandDirectory)) {
  $pathSeparator = [System.IO.Path]::PathSeparator
  $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'Process')
  $pathEntries = @($currentPath -split [Regex]::Escape([string]$pathSeparator) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if (-not ($pathEntries | Where-Object { $_ -ieq $nodeCommandDirectory })) {
    [Environment]::SetEnvironmentVariable('PATH', "$nodeCommandDirectory$pathSeparator$currentPath", 'Process')
  }
}
Write-Host "Using Node command: $nodeCommand"

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

$deployEnabled = (Test-TruthyEnv -Name 'DEPLOY_ENABLED') -or (Test-TruthyEnv -Name 'AUTO_DEPLOY')
if (
  $deployEnabled -and
  -not (Test-BackendDeployGitManaged) -and
  (Test-ColyseusBackendDeployCommand) -and
  -not (Test-ColyseusDeployCredentials)
) {
  Write-Warning @"
Backend deploys are enabled through the Colyseus CLI, but this worker has no Colyseus deploy credentials.
Backend deploy approvals will fail before pushing main until COLYSEUS_APPLICATION_ID and COLYSEUS_DEPLOY_TOKEN
are set, a local .colyseus-cloud.json is added, or BACKEND_DEPLOY_STRATEGY=git is configured.
"@
}

if ($Check) {
  Write-Host 'Worker startup check passed.'
  exit 0
}

$workerArgs = @('scripts/agent-worker.mjs')
if ($Once) {
  $workerArgs += '--once'
}

Push-Location $repoRoot
try {
  & $nodeCommand @workerArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
