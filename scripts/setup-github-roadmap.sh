#!/usr/bin/env bash
set -euo pipefail

OWNER="${GH_OWNER:-Piskriek}"
REPO="${GH_REPO:-HeavyMetal2}"
PROJECT_TITLE="FIDELITY: SetMix Multiverse — 1.0 Release Roadmap"
MILESTONE_TITLE="v1.0 Feature Complete"

echo "==> [1/4] Verifying GitHub CLI authentication & project scopes..."
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh CLI not authenticated. Run: gh auth login -s project,repo"
  exit 1
fi

echo "==> [2/4] Ensuring Milestone '$MILESTONE_TITLE' exists on $OWNER/$REPO..."
MILESTONE_NUM=$(gh api "repos/$OWNER/$REPO/milestones" --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number" || true)
if [ -z "$MILESTONE_NUM" ]; then
  MILESTONE_NUM=$(gh api -X POST "repos/$OWNER/$REPO/milestones" \
    -f title="$MILESTONE_TITLE" \
    -f state="open" \
    -f description="Full feature-complete 1.0 release of FIDELITY: The SetMix Multiverse (Plans 40-43 + Rule 8a)" \
    -f due_on="2026-11-05T23:59:59Z" \
    --jq ".number")
  echo "Created Milestone #$MILESTONE_NUM ($MILESTONE_TITLE)"
else
  echo "Found existing Milestone #$MILESTONE_NUM ($MILESTONE_TITLE)"
fi

echo "==> [3/4] Creating GitHub Projects v2 Board: '$PROJECT_TITLE'..."
PROJECT_NUM=$(gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" || true)
if [ -z "$PROJECT_NUM" ]; then
  PROJECT_NUM=$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq ".number")
  echo "Created Project #$PROJECT_NUM"
else
  echo "Found existing Project #$PROJECT_NUM"
fi

gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "Phase" --data-type "SINGLE_SELECT" \
  --single-select-options "Phase 1: Foundation,Phase 2: Tiles & Matstack,Phase 3: Raycast & BYOA,Phase 4: Kits & Motion,Phase 5: Endgame & 1.0" 2>/dev/null || true

gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "Plan" --data-type "SINGLE_SELECT" \
  --single-select-options "Core,Plan 40 (BYOA),Plan 41 (Tiles/Matstack),Plan 42 (Stargate/Endgame),Plan 43 (Motion/Logic),1.0 Polish" 2>/dev/null || true

gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "Weight" --data-type "NUMBER" 2>/dev/null || true
gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "Start Date" --data-type "DATE" 2>/dev/null || true
gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "Target Date" --data-type "DATE" 2>/dev/null || true

echo "==> [4/4] Seeding & syncing Roadmap Jobs into Milestone #$MILESTONE_NUM and Project #$PROJECT_NUM..."
create_or_sync_job() {
  local code="$1"
  local title="$2"
  local state="$3" # done | todo | in_progress
  local body="$4"

  local existing_url
  existing_url=$(gh issue list --repo "$OWNER/$REPO" --state all --search "[$code] in:title" --json url --jq ".[0].url // empty" || true)

  if [ -z "$existing_url" ]; then
    existing_url=$(gh issue create --repo "$OWNER/$REPO" \
      --title "[$code] $title" \
      --body "$body" \
      --milestone "$MILESTONE_TITLE" \
      --label "roadmap" || true)
    echo "Created Issue: [$code] -> $existing_url"
  else
    echo "Existing Issue: [$code] -> $existing_url"
  fi

  if [ -n "$existing_url" ]; then
    gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$existing_url" >/dev/null 2>&1 || true

    if [ "$state" = "done" ]; then
      gh issue close "$existing_url" --repo "$OWNER/$REPO" --reason "completed" >/dev/null 2>&1 || true
    fi
  fi
}

# Landed Jobs (12/19 = 68.4% Weighted)
create_or_sync_job "JOB-01" "Monorepo Core, Three.js Play Scene & Lab Room" "done" "Base play scene and lab room testbed."
create_or_sync_job "JOB-02" "5-Rung Recursive Preset Schema & Cartridge Serialization" "done" "Rung 1-5 preset hierarchy. Test piece and trim palette landed in ca7ce35f."
create_or_sync_job "JOB-05" "Base @hm/texgraph & @hm/matstack Evaluators + Noise Atlas" "done" "Deterministic seed evaluation."
create_or_sync_job "JOB-16" "Beam Rifle Core Firing Loop & Reticle Dispatch" "done" "Base Beam Rifle firing loop."
create_or_sync_job "JOB-03" "TICKET-41: Procedural Tile Library (6 Periodic Nodes + 20 Shelf Tiles)" "done" "Landed in PR #68 (97c96788, 2800ff39). 44 tests passing, <25ms @ 128x128."
create_or_sync_job "JOB-04" "Rule 8a Matstack Fixes, Bleed Suppression & Coplanar Edge Dedup" "done" "Landed in PR #68 (959a74c8). Abrasion on top, coat/aniso write, mask-mesh.ts coplanar dedup."
create_or_sync_job "JOB-04b" "6-Zone Material Coverage Engine (packages/matstack/src/coverage.ts)" "done" "Landed in PR #68 (959a74c8). Deterministic 6-zone coverage reporting."
create_or_sync_job "JOB-17" "Universal Cartridge Targetability & 2-Tier AABB Raycasting" "done" "Landed in PR #68 (7935d767). Zero-alloc rayBoxEntry(), Build->Mesh->Triangle hierarchy."
create_or_sync_job "JOB-06" "Plan 40: Bring Your Own Agent (BYOA) Studio API & MCP Stdio Relay" "done" "Landed in PR #68 (00c3bea0). studio-agent.ts, studio-skill.md, stdio relay, 46 tests."
create_or_sync_job "JOB-18" "Studio Undo/Redo Proposal Staging & Refusal Payloads" "done" "Landed in PR #68 (00c3bea0). Atomic proposal staging preserving human undo stack."
create_or_sync_job "JOB-07" "Plan 42 (Part 1): Modular STARGATE_KIT Assembly, Iris Shield & Earth Endgame" "done" "Landed in PR #68 (fc28d1b0, df841a73, f49a851d, fec761fa). 43 parts, world v5 save, triplanar weathering."
create_or_sync_job "JOB-19" "Plan 43: Deterministic Motion & Logic Presets + Lazy AABB Dirty-Flagging" "done" "Landed in PR #68 (9ca3e08b). Pure evaluateMotion(simTime, stage), stageAnimRateHz, wiregraph iris logic, lazy AABB."

# Remaining Jobs to 1.0 Feature Complete (7/19 = 31.6% Weighted)
create_or_sync_job "JOB-20" "Recursive Sprite, Audio Stem and Stage Skin Preset Factories" "in_progress" "In active generation on PR #68. 8-angle shareware sprites, soundlab synth patches, pxdc/sndc cartridges."
create_or_sync_job "JOB-06b" "Plan 40 Upgrade: studio.kit.audit (Anatomy Geometry/Orbit Audit) & Contact-Sheet Look" "todo" "Add solidClearances, terminals/looseEnds=0, hingeBendRadius, and 4-frame contact sheets."
create_or_sync_job "JOB-08" "Plan 42 (Part 2): Stargate Event Horizon WebGL Shader & Attack/Decay Envelopes" "todo" "Seamless world-space portal shader with monotonic attack/decay envelopes and zero pop."
create_or_sync_job "JOB-09" "Plan 42 (Part 3): Earth Endgame Biome, Portal Telemetry & Win Loop" "todo" "Earth Endgame sector, power routing puzzle, and endgame completion state."
create_or_sync_job "JOB-21" "Monster Mash Exploration Loop & Multi-Cartridge Synergy" "todo" "Full gameplay loop combining material and motion/logic cartridges across rooms."
create_or_sync_job "JOB-22" "60 FPS Frame-Budget Audit & 380-Part Stress Benchmark" "todo" "Automated headless benchmark verifying >=60 FPS at 1440p and 0 raycast allocations."
create_or_sync_job "JOB-23" "1.0 Release Packaging, studio-skill.compact.md & CI Gate Lock" "todo" "Caveman-style token-compressed skill guide and CI auditOrExit + coverage lock."

echo "==> Done! View your GitHub Project Roadmap and Milestone progress bar on GitHub."
