param(
    [string]$CodexHome = "$env:USERPROFILE\.codex"
)

$ErrorActionPreference = "Stop"

$statePath = Join-Path $CodexHome ".codex-global-state.json"

if (-not (Test-Path -LiteralPath $statePath)) {
    throw "Codex state file not found: $statePath"
}

$codexProcesses = @(
    Get-Process | Where-Object {
        $_.ProcessName -match "^Codex($|Helper)" -or $_.Path -like "*\Codex.exe"
    }
)

if ($codexProcesses.Count -gt 0) {
    throw "Codex appears to still be running. Close Codex completely, then rerun this script."
}

$badRootPattern = '^(?<worktree>[A-Za-z]:\\.*\\\.codex\\worktrees\\[^\\]+\\[^\\]+)\\\?\\[A-Za-z]:\\'

$raw = Get-Content -LiteralPath $statePath -Raw -Encoding utf8
$state = $raw | ConvertFrom-Json

$backupPath = "$statePath.bak.$([DateTime]::Now.ToString('yyyyMMdd-HHmmss'))"
Copy-Item -LiteralPath $statePath -Destination $backupPath

function Resolve-WorkspaceRoot([string]$root) {
    if (-not $root) {
        return $null
    }

    if ($root -match $badRootPattern) {
        $candidate = $Matches['worktree']
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
        return $null
    }

    return $root
}

$removedRoots = @()
$repairedRoots = [ordered]@{}

if ($state.'electron-saved-workspace-roots') {
    $savedRoots = @($state.'electron-saved-workspace-roots')
    $normalizedRoots = New-Object System.Collections.Generic.List[string]

    foreach ($root in $savedRoots) {
        $resolved = Resolve-WorkspaceRoot $root
        if (-not $resolved) {
            $removedRoots += $root
            continue
        }
        if ($resolved -ne $root) {
            $repairedRoots[$root] = $resolved
        }
        if (-not $normalizedRoots.Contains($resolved)) {
            $normalizedRoots.Add($resolved)
        }
    }

    $state.'electron-saved-workspace-roots' = @($normalizedRoots)
}

if ($state.'active-workspace-roots') {
    $normalizedActiveRoots = New-Object System.Collections.Generic.List[string]

    foreach ($root in @($state.'active-workspace-roots')) {
        $resolved = Resolve-WorkspaceRoot $root
        if (-not $resolved) {
            continue
        }
        if (-not $normalizedActiveRoots.Contains($resolved)) {
            $normalizedActiveRoots.Add($resolved)
        }
    }

    $state.'active-workspace-roots' = @($normalizedActiveRoots)
}

if ($state.'electron-workspace-root-labels') {
    $keptLabels = [ordered]@{}
    foreach ($prop in $state.'electron-workspace-root-labels'.PSObject.Properties) {
        $resolved = Resolve-WorkspaceRoot $prop.Name
        if (-not $resolved) {
            continue
        }
        if (-not $keptLabels.Contains($resolved)) {
            $keptLabels[$resolved] = $prop.Value
        }
    }
    $state.'electron-workspace-root-labels' = [pscustomobject]$keptLabels
}

$atomState = $state.'electron-persisted-atom-state'
if ($atomState -and $atomState.'sidebar-collapsed-groups') {
    $keptGroups = [ordered]@{}
    foreach ($prop in $atomState.'sidebar-collapsed-groups'.PSObject.Properties) {
        $resolved = Resolve-WorkspaceRoot $prop.Name
        if (-not $resolved) {
            continue
        }
        if (-not $keptGroups.Contains($resolved)) {
            $keptGroups[$resolved] = $prop.Value
        }
    }
    $atomState.'sidebar-collapsed-groups' = [pscustomobject]$keptGroups
}

$updated = $state | ConvertTo-Json -Depth 100 -Compress
Set-Content -LiteralPath $statePath -Value $updated -Encoding utf8

Write-Host "Backed up state to: $backupPath"
if ($repairedRoots.Count -gt 0) {
    Write-Host "Repaired malformed worktree roots:"
    foreach ($entry in $repairedRoots.GetEnumerator()) {
        Write-Host " - $($entry.Key)"
        Write-Host "   -> $($entry.Value)"
    }
}
if ($removedRoots.Count -gt 0) {
    Write-Host "Removed malformed worktree roots:"
    $removedRoots | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" }
}
if ($repairedRoots.Count -eq 0 -and $removedRoots.Count -eq 0) {
    Write-Host "No malformed worktree roots were found."
}
Write-Host "You can reopen Codex now."
