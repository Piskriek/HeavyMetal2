# ============================================================================
# File: scripts/setup-github-roadmap.ps1
# Native PowerShell script for GitHub Projects v2 Roadmap, Milestones & Issues
# ============================================================================

$OWNER = if ($env:GH_OWNER) { $env:GH_OWNER } else { "Piskriek" }
$REPO = if ($env:GH_REPO) { $env:GH_REPO } else { "HeavyMetal2" }
$PROJECT_TITLE = "FIDELITY: SetMix Multiverse — 1.0 Release Roadmap"
$MILESTONE_TITLE = "v1.0 Feature Complete"

Write-Host "==> [1/4] Verifying GitHub CLI authentication & scopes..." -ForegroundColor Cyan
try {
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "gh CLI not authenticated. Please run: gh auth login -s project,repo"
        exit 1
    }
} catch {
    Write-Error "gh CLI not installed or failed to check auth."
    exit 1
}

Write-Host "==> [2/4] Ensuring Milestone '$MILESTONE_TITLE' exists on $OWNER/$REPO..." -ForegroundColor Cyan
$milestoneNum = gh api "repos/$OWNER/$REPO/milestones" --jq ".[] | select(.title == `"$MILESTONE_TITLE`") | .number" 2>$null
if (-not $milestoneNum) {
    $milestoneNum = gh api -X POST "repos/$OWNER/$REPO/milestones" `
        -f title="$MILESTONE_TITLE" `
        -f state="open" `
        -f description="Full feature-complete 1.0 release of FIDELITY: The SetMix Multiverse (Plans 40-43 + Rule 8a)" `
        -f due_on="2026-11-05T23:59:59Z" `
        --jq ".number"
    Write-Host "Created Milestone #$milestoneNum ($MILESTONE_TITLE)" -ForegroundColor Green
} else {
    Write-Host "Found existing Milestone #$milestoneNum ($MILESTONE_TITLE)" -ForegroundColor Green
}

Write-Host "==> [3/4] Creating/finding GitHub Projects v2 Board: '$PROJECT_TITLE'..." -ForegroundColor Cyan
$projectNum = gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title == `"$PROJECT_TITLE`") | .number" 2>$null
if (-not $projectNum) {
    try {
        $projectNum = gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq ".number"
        Write-Host "Created Project #$projectNum" -ForegroundColor Green
    } catch {
        Write-Warning "Could not create Project Board. Make sure to run: gh auth refresh -s project"
    }
} else {
    Write-Host "Found existing Project #$projectNum" -ForegroundColor Green
}

if ($projectNum) {
    gh project field-create "$projectNum" --owner "$OWNER" --name "Phase" --data-type "SINGLE_SELECT" --single-select-options "Phase 1: Foundation,Phase 2: Tiles & Matstack,Phase 3: Raycast & BYOA,Phase 4: Kits & Motion,Phase 5: Endgame & 1.0" 2>$null
    gh project field-create "$projectNum" --owner "$OWNER" --name "Plan" --data-type "SINGLE_SELECT" --single-select-options "Core,Plan 40 (BYOA),Plan 41 (Tiles/Matstack),Plan 42 (Stargate/Endgame),Plan 43 (Motion/Logic),1.0 Polish" 2>$null
    gh project field-create "$projectNum" --owner "$OWNER" --name "Weight" --data-type "NUMBER" 2>$null
    gh project field-create "$projectNum" --owner "$OWNER" --name "Start Date" --data-type "DATE" 2>$null
    gh project field-create "$projectNum" --owner "$OWNER" --name "Target Date" --data-type "DATE" 2>$null
}

Write-Host "==> [4/4] Running setup via Node runner..." -ForegroundColor Cyan
node scripts/setup-github-roadmap.mjs
