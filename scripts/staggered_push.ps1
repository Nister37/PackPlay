# Staggered Git Push Script
param (
    [string]$RepoPath = (Get-Location).Path,
    [string]$RemoteBranch = "main",
    [string[]]$Commits,
    [int]$MinDelayMinutes = 10,
    [int]$MaxDelayMinutes = 30,
    [switch]$Immediate,
    [switch]$DryRun
)

Set-Location $RepoPath
Write-Output "[$((Get-Date).ToString('u'))] Starting staggered push for repo: $RepoPath on branch $RemoteBranch"

if (-not $Commits -or $Commits.Count -eq 0) {
    # If no commits provided, discover unpushed commits on current branch
    $unpushed = git rev-list "origin/${RemoteBranch}..HEAD" --reverse
    if (-not $unpushed) {
        Write-Output "No unpushed commits found against origin/$RemoteBranch."
        return
    }
    $Commits = $unpushed
}

Write-Output "Commits queued for push: $($Commits.Count)"
for ($i = 0; $i -lt $Commits.Count; $i++) {
    $commit = $Commits[$i]
    $commitInfo = git log -1 --oneline $commit
    Write-Output "[$((Get-Date).ToString('u'))] ($($i+1)/$($Commits.Count)) Pushing commit: $commitInfo"

    if (-not $DryRun) {
        git push origin "${commit}:refs/heads/${RemoteBranch}"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push $commit. Aborting pipeline."
            exit $LASTEXITCODE
        }
    } else {
        Write-Output "  [DRY RUN] git push origin ${commit}:refs/heads/${RemoteBranch}"
    }

    if ($i -lt ($Commits.Count - 1) -and -not $Immediate) {
        $delaySec = Get-Random -Minimum ($MinDelayMinutes * 60) -Maximum ($MaxDelayMinutes * 60)
        $delayMin = [math]::Round($delaySec / 60, 1)
        Write-Output "[$((Get-Date).ToString('u'))] Pausing for $delayMin minutes ($delaySec seconds) before next commit..."
        Start-Sleep -Seconds $delaySec
    }
}

Write-Output "[$((Get-Date).ToString('u'))] All commits successfully pushed!"
