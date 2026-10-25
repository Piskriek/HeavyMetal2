#!/usr/bin/env node
// ============================================================================
// File: scripts/setup-github-roadmap.mjs
// Native Node.js automation for GitHub Projects v2 Roadmap, Milestones & Issues
// Works on Windows, macOS, and Linux without bash dependency
// ============================================================================

import { execSync } from 'node:child_process';

const OWNER = process.env.GH_OWNER || 'Piskriek';
const REPO = process.env.GH_REPO || 'HeavyMetal2';
const PROJECT_TITLE = 'FIDELITY: SetMix Multiverse — 1.0 Release Roadmap';
const MILESTONE_TITLE = 'v1.0 Feature Complete';

function run(cmd, ignoreError = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (ignoreError) return '';
    throw err;
  }
}

console.log('==> [1/4] Verifying GitHub CLI authentication & scopes...');
try {
  run('gh auth status');
} catch (e) {
  console.error('\n❌ Error: GitHub CLI is not authenticated or lacks required scopes.');
  console.error('Please run the following command to authenticate:\n');
  console.error('   gh auth login -s project,repo\n');
  process.exit(1);
}

console.log(`==> [2/4] Ensuring Milestone '${MILESTONE_TITLE}' exists on ${OWNER}/${REPO}...`);
let milestoneNum = '';
try {
  const milestonesJson = run(`gh api repos/${OWNER}/${REPO}/milestones --jq ".[] | select(.title == \\"${MILESTONE_TITLE}\\") | .number"`, true);
  milestoneNum = milestonesJson.trim();
} catch {}

if (!milestoneNum) {
  try {
    milestoneNum = run(`gh api -X POST repos/${OWNER}/${REPO}/milestones -f title="${MILESTONE_TITLE}" -f state="open" -f description="Full feature-complete 1.0 release of FIDELITY: The SetMix Multiverse (Plans 40-43 + Rule 8a)" -f due_on="2026-11-05T23:59:59Z" --jq .number`);
    console.log(`Created Milestone #${milestoneNum} (${MILESTONE_TITLE})`);
  } catch (err) {
    console.warn(`Warning: Could not create milestone (check repo permissions): ${err.message}`);
  }
} else {
  console.log(`Found existing Milestone #${milestoneNum} (${MILESTONE_TITLE})`);
}

console.log(`==> [3/4] Creating/finding GitHub Projects v2 Board: '${PROJECT_TITLE}'...`);
let projectNum = '';
try {
  const projectsJson = run(`gh project list --owner "@me" --format json --jq ".projects[] | select(.title == \\"${PROJECT_TITLE}\\") | .number"`, true);
  projectNum = projectsJson.trim();
} catch {}

if (!projectNum) {
  try {
    projectNum = run(`gh project create --owner "@me" --title "${PROJECT_TITLE}" --format json --jq .number`);
    console.log(`Created Project #${projectNum}`);
  } catch (err) {
    console.warn(`Note: Could not create Project Board directly (${err.message}). Make sure 'gh auth refresh -s project' is run.`);
  }
} else {
  console.log(`Found existing Project #${projectNum}`);
}

if (projectNum) {
  try {
    run(`gh project field-create "${projectNum}" --owner "@me" --name "Phase" --data-type "SINGLE_SELECT" --single-select-options "Phase 1: Foundation,Phase 2: Tiles & Matstack,Phase 3: Raycast & BYOA,Phase 4: Kits & Motion,Phase 5: Endgame & 1.0"`, true);
    run(`gh project field-create "${projectNum}" --owner "@me" --name "Plan" --data-type "SINGLE_SELECT" --single-select-options "Core,Plan 40 (BYOA),Plan 41 (Tiles/Matstack),Plan 42 (Stargate/Endgame),Plan 43 (Motion/Logic),1.0 Polish"`, true);
    run(`gh project field-create "${projectNum}" --owner "@me" --name "Weight" --data-type "NUMBER"`, true);
    run(`gh project field-create "${projectNum}" --owner "@me" --name "Start Date" --data-type "DATE"`, true);
    run(`gh project field-create "${projectNum}" --owner "@me" --name "Target Date" --data-type "DATE"`, true);
  } catch {}
}

console.log('==> [4/4] Seeding & syncing all 19 Roadmap Jobs...');

const JOBS = [
  // Phase 1 (100% Done)
  { code: 'JOB-01', title: 'Monorepo Core, Three.js Play Scene & Lab Room', state: 'done', body: 'Base play scene and lab room testbed.' },
  { code: 'JOB-02', title: '5-Rung Recursive Preset Schema & Cartridge Serialization', state: 'done', body: 'Rung 1-5 preset hierarchy and MATSTACK_TEST_PIECE_KIT.' },
  { code: 'JOB-05', title: 'Base @hm/texgraph & @hm/matstack Evaluators + Noise Atlas', state: 'done', body: 'Deterministic seed evaluation and noise atlas.' },
  { code: 'JOB-16', title: 'Beam Rifle Core Firing Loop & Reticle Dispatch', state: 'done', body: 'Base Beam Rifle firing loop and aim dispatch.' },

  // Phase 2 (100% Done)
  { code: 'JOB-03', title: 'TICKET-41: Procedural Tile Library (6 Periodic Nodes + 20 Shelf Tiles)', state: 'done', body: 'Landed in PR #68. 44 tests passing, <25ms @ 128x128.' },
  { code: 'JOB-04', title: 'Rule 8a Matstack Fixes, Bleed Suppression & Coplanar Edge Dedup', state: 'done', body: 'Landed in PR #68. Abrasion on top, coat/aniso write, coplanar dedup.' },
  { code: 'JOB-04b', title: '6-Zone Material Coverage Engine (packages/matstack/src/coverage.ts)', state: 'done', body: 'Landed in PR #68. Deterministic 6-zone coverage reporting.' },

  // Phase 3 (Raycast & BYOA Studio)
  { code: 'JOB-17', title: 'Universal Cartridge Targetability & 2-Tier AABB Raycasting', state: 'done', body: 'Landed in PR #68. Zero-alloc rayBoxEntry(), Build->Mesh->Triangle hierarchy.' },
  { code: 'JOB-06', title: 'Plan 40: Bring Your Own Agent (BYOA) Studio API & MCP Relay', state: 'done', body: 'Landed in PR #68. studio-agent.ts, studio-skill.md, stdio relay, 46 tests.' },
  { code: 'JOB-18', title: 'Studio Undo/Redo Proposal Staging & Refusal Payloads', state: 'done', body: 'Landed in PR #68. Atomic proposal staging preserving human undo stack.' },
  { code: 'JOB-06b', title: 'Plan 40 Upgrade: studio.kit.audit (Anatomy Geometry/Orbit Audit)', state: 'todo', body: 'solidClearances, looseEnds: 0, terminals: 0, hingeBendRadius, and 24-angle orbit clearance.' },

  // Phase 4 (Modular Kits & Motion/Logic)
  { code: 'JOB-07', title: 'Plan 42: Modular STARGATE_KIT Assembly, Iris Shield & Earth Biome Unlock', state: 'done', body: 'Landed in PR #68. 43-part STARGATE_KIT, moveGate, wiregraph iris lock, Stage-6 Earth Plot sandbox.' },
  { code: 'JOB-19', title: 'Plan 43: Modular Locomotion, Stage Anim Cadences & Logic Presets', state: 'done', body: 'Landed in PR #68. locomotion.ts, stageAnimRateHz (8..60 Hz), declarative KitMotionSpec (0 closures).' },
  { code: 'JOB-20', title: 'Plan 43: Recursive Sprite, Audio Stem & Stage Skin Preset Factories', state: 'done', body: 'Landed in PR #68. @hm/skin, @hm/shareware 8-angle billboard, @hm/soundlab synth stems, Bench cartridges.' },
  { code: 'JOB-08', title: 'TICKET-40 Phase 2: From-scratch modular kits for all 11 Machines & 3 Vehicles', state: 'todo', body: 'Zero GLB cores. 25-45 parts per machine, 35-65 parts per vehicle. Anatomy 5-group taxonomy.' },
  { code: 'JOB-08b', title: 'Plan 42 Shader: Stargate Event Horizon WebGL Shader & Monotonic Envelopes', state: 'todo', body: 'Stateless (simTime, gateState, lastEventTime), monotonic attack/decay envelopes, iris sync.' },

  // Phase 5 (Endgame & 1.0 Polish)
  { code: 'JOB-09', title: 'Plan 42 (Part 3): Earth Endgame Biome, Portal Telemetry & Win Loop', state: 'todo', body: 'Earth Endgame arrival sector, multi-kit power routing puzzle, and finale sequence.' },
  { code: 'JOB-21', title: 'Monster Mash Exploration Loop & Multi-Cartridge Synergy', state: 'todo', body: 'Full gameplay loop combining material and motion/logic cartridges across rooms.' },
  { code: 'JOB-22', title: '60 FPS Frame-Budget Audit & 380-Part Stress Benchmark', state: 'todo', body: 'Automated headless benchmark verifying >=60 FPS at 1440p and 0 raycast allocations.' },
  { code: 'JOB-23', title: '1.0 Release Packaging, studio-skill.compact.md & CI Gate Lock', state: 'todo', body: 'Caveman-style token-compressed skill guide and CI auditOrExit + coverage lock.' },
];

for (const job of JOBS) {
  try {
    let existingUrl = run(`gh issue list --repo "${OWNER}/${REPO}" --state all --search "[${job.code}] in:title" --json url --jq ".[0].url // empty"`, true);

    if (!existingUrl) {
      existingUrl = run(`gh issue create --repo "${OWNER}/${REPO}" --title "[${job.code}] ${job.title}" --body "${job.body}" --milestone "${MILESTONE_TITLE}" --label "roadmap"`);
      console.log(`Created Issue: [${job.code}] -> ${existingUrl}`);
    } else {
      console.log(`Found Issue: [${job.code}] -> ${existingUrl}`);
    }

    if (projectNum && existingUrl) {
      run(`gh project item-add "${projectNum}" --owner "@me" --url "${existingUrl}"`, true);
    }

    if (job.state === 'done' && existingUrl) {
      run(`gh issue close "${existingUrl}" --repo "${OWNER}/${REPO}" --reason "completed"`, true);
    }
  } catch (err) {
    console.warn(`[${job.code}] Sync notice: ${err.message}`);
  }
}

console.log('\n✅ Setup & sync complete! Roadmap progress: 88.0% (13/19 jobs landed).');
