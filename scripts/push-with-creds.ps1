# scripts/push-with-creds.ps1
# Push to GitHub using a token stored in a LOCAL FILE (not in the chat).
#
# Why: GitHub appears to invalidate tokens that have been pasted into chat
# channels / logs. Storing the token in a file the AI never sees keeps it safe.
#
# Usage:
#   1. In github.com -> Settings -> Developer settings -> Personal access tokens,
#      generate a token (classic, scope: `repo`, or fine-grained with `Contents: Read+Write`).
#   2. Copy the token to clipboard (Ctrl+C).
#   3. In PowerShell, run:
#        notepad .git-token
#      paste, save, close.
#   4. Run:
#        .\scripts\push-with-creds.ps1 "your commit message"
#   5. After the push succeeds, REVOKE the token at
#        https://github.com/settings/tokens
#      and delete the local file:
#        Remove-Item .git-token -Force

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tokenFile = Join-Path $projectRoot ".git-token"

if (-not (Test-Path $tokenFile)) {
  Write-Host "ERROR: .git-token does not exist. Create it with: notepad .git-token" -ForegroundColor Red
  exit 1
}

$token = (Get-Content $tokenFile -Raw).Trim()
if ($token.Length -lt 20) {
  Write-Host "ERROR: .git-token is empty or too short" -ForegroundColor Red
  exit 1
}

# Validate token against GitHub API
try {
  $headers = @{ Authorization = "Bearer $token"; "User-Agent" = "push-with-creds" }
  $resp = Invoke-WebRequest -Uri "https://api.github.com/user" -Headers $headers -Method GET -UseBasicParsing -TimeoutSec 15
  if ($resp.StatusCode -ne 200) {
    Write-Host "ERROR: Invalid token (HTTP $($resp.StatusCode)). Regenerate at github.com/settings/tokens" -ForegroundColor Red
    exit 1
  }
  $user = ($resp.Content | ConvertFrom-Json).login
  Write-Host "OK: Token valid for user: $user" -ForegroundColor Green
} catch {
  Write-Host "ERROR: Could not validate token: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Build the authenticated remote URL
$remote = git remote get-url origin
$remotePattern = "^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?$"
if ($remote -notmatch $remotePattern) {
  Write-Host "ERROR: origin is not https://github.com/<owner>/<repo>. Aborting." -ForegroundColor Red
  exit 1
}
$owner = $Matches[1]
$repo = $Matches[2]
$authUrl = "https://x-access-token:${token}@github.com/${owner}/${repo}.git"

# Make sure we don't leak the token into the persistent remote config
$prevUrl = git remote get-url origin

try {
  git remote set-url origin $authUrl
  git add -A
  $status = git status --porcelain
  if ($status) {
    Write-Host "Committing current changes:" -ForegroundColor Cyan
    git diff --cached --stat
    $commitMsg = "deploy: sync local changes"
    if ($args.Count -gt 0 -and $args[0]) { $commitMsg = $args[0] }
    git commit -m "$commitMsg" | Out-Null
  }
  $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
  if (-not $currentBranch) { $currentBranch = "main" }
  $hasUpstream = $false
  try {
    $up = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
    if ($up) { $hasUpstream = $true }
  } catch { $hasUpstream = $false }
  Write-Host "Pushing branch '$currentBranch' to origin..." -ForegroundColor Cyan
  if ($hasUpstream) {
    git push origin $currentBranch
  } else {
    Write-Host "  (no upstream yet, using -u)" -ForegroundColor DarkGray
    git push -u origin $currentBranch
  }
  Write-Host "OK: Push successful" -ForegroundColor Green
} catch {
  Write-Host "ERROR: Push failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  # Restore the clean URL (no token) regardless of outcome
  git remote set-url origin $prevUrl | Out-Null
  Write-Host "OK: Remote restored to: $prevUrl" -ForegroundColor Green
}

# Clean up the token file
Remove-Item $tokenFile -Force
Write-Host "OK: .git-token deleted. REVOKE THE TOKEN at https://github.com/settings/tokens" -ForegroundColor Yellow
