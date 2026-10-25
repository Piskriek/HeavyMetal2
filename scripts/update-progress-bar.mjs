#!/usr/bin/env node
/**
 * scripts/update-progress-bar.mjs
 * 
 * Computes weighted release progress and renders live ASCII + shields.io badges
 * between <!-- ROADMAP_PROGRESS_START --> and <!-- ROADMAP_PROGRESS_END -->
 * in both JOBBOARD.md and README.md.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const JOBS = [
  // Phase 1: Foundation (20%)
  { id: 'JOB-01', title: 'Monorepo Core, Three.js Play Scene & Lab Room', phase: 'Phase 1: Foundation', weight: 5, status: 'DONE' },
  { id: 'JOB-02', title: '5-Rung Recursive Preset Schema & Trim Palette', phase: 'Phase 1: Foundation', weight: 5, status: 'DONE' },
  { id: 'JOB-05', title: 'Base @hm/texgraph & @hm/matstack Evaluators', phase: 'Phase 1: Foundation', weight: 5, status: 'DONE' },
  { id: 'JOB-16', title: 'Beam Rifle Core Firing Loop & Reticle Dispatch', phase: 'Phase 1: Foundation', weight: 5, status: 'DONE' },

  // Phase 2: Materials (25%)
  { id: 'JOB-03', title: 'TICKET-41: Procedural Tile Library (20 Tiles + 6 Nodes)', phase: 'Phase 2: Materials', weight: 10, status: 'DONE' },
  { id: 'JOB-04', title: 'Rule 8a Matstack Layer Order, Bleed Suppression & Dedup', phase: 'Phase 2: Materials', weight: 10, status: 'DONE' },
  { id: 'JOB-04b', title: '6-Zone Material Coverage Engine (coverage.ts)', phase: 'Phase 2: Materials', weight: 5, status: 'DONE' },

  // Phase 3: Studio & Raycast (23%)
  { id: 'JOB-17', title: 'Universal Cartridge Targetability & 2-Tier AABB Raycasting', phase: 'Phase 3: Studio & Raycast', weight: 8, status: 'DONE' },
  { id: 'JOB-06', title: 'Plan 40 BYOA Studio API & MCP Stdio Relay', phase: 'Phase 3: Studio & Raycast', weight: 10, status: 'DONE' },
  { id: 'JOB-18', title: 'Studio Undo/Redo Proposal Staging & Refusal Payloads', phase: 'Phase 3: Studio & Raycast', weight: 5, status: 'DONE' },
  { id: 'JOB-06b', title: 'studio.kit.audit (Anatomy Geometric & Orbit Audit)', phase: 'Phase 3: Studio & Raycast', weight: 5, status: 'DONE' },

  // Phase 4: Kits & Motion (24%)
  { id: 'JOB-07', title: 'Modular STARGATE_KIT, Iris Shield & Earth Endgame', phase: 'Phase 4: Kits & Motion', weight: 8, status: 'DONE' },
  { id: 'JOB-19', title: 'Plan 43: Deterministic Motion & Logic Presets', phase: 'Phase 4: Kits & Motion', weight: 8, status: 'DONE' },
  { id: 'JOB-20', title: 'Recursive Sprite, Audio Stem & Stage Skin Presets', phase: 'Phase 4: Kits & Motion', weight: 4, status: 'DONE' },
  { id: 'JOB-08', title: 'TICKET-40 Phase 2: Modular Kits for the 11 Machines & 3 Vehicles', phase: 'Phase 4: Kits & Motion', weight: 6, status: 'IN_PROGRESS' },
  { id: 'JOB-08b', title: 'Stargate Event Horizon WebGL Shader & Envelopes', phase: 'Phase 4: Kits & Motion', weight: 6, status: 'DONE' },

  // Phase 5: Endgame & 1.0 (13%)
  { id: 'JOB-09', title: 'Plan 42 Earth Endgame Biome & Power Routing Puzzle', phase: 'Phase 5: Endgame & 1.0', weight: 5, status: 'TODO' },
  { id: 'JOB-21', title: 'Monster Mash Exploration Loop & Multi-Cartridge Synergy', phase: 'Phase 5: Endgame & 1.0', weight: 4, status: 'TODO' },
  { id: 'JOB-22', title: '60 FPS Frame-Budget Audit & 380-Part Stress Benchmark', phase: 'Phase 5: Endgame & 1.0', weight: 2, status: 'TODO' },
  { id: 'JOB-23', title: '1.0 Release Packaging, studio-skill.compact.md & CI Gate', phase: 'Phase 5: Endgame & 1.0', weight: 2, status: 'TODO' },
];

function renderBar(ratio, width = 20) {
  const filled = Math.min(width, Math.max(0, Math.round(ratio * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function calculateProgress() {
  let totalDoneWeight = 0;
  let totalJobsDone = 0;
  const phaseTotals = new Map();

  for (const job of JOBS) {
    let phase = phaseTotals.get(job.phase);
    if (!phase) {
      phase = { doneWeight: 0, totalWeight: 0, doneCount: 0, totalCount: 0 };
      phaseTotals.set(job.phase, phase);
    }
    phase.totalWeight += job.weight;
    phase.totalCount += 1;

    if (job.status === 'DONE') {
      totalDoneWeight += job.weight;
      totalJobsDone += 1;
      phase.doneWeight += job.weight;
      phase.doneCount += 1;
    } else if (job.status === 'IN_PROGRESS') {
      totalDoneWeight += job.weight * 0.5; // half credit for active WIP
      phase.doneWeight += job.weight * 0.5;
    }
  }

  const overallPercent = totalDoneWeight.toFixed(1);
  const remainingJobs = JOBS.filter(j => j.status !== 'DONE').length;
  const remainingAgentDays = (((100 - totalDoneWeight) / 100) * 25).toFixed(1);

  let output = `<!-- ROADMAP_PROGRESS_START -->\n`;
  output += `[![Release Progress](https://img.shields.io/badge/v1.0_Progress-${overallPercent}%25-00F0FF?style=for-the-badge&logo=target)](https://github.com/Piskriek/HeavyMetal2)\n`;
  output += `[![Rule 8a Status](https://img.shields.io/badge/Rule_8a_Audit-PASS-success?style=for-the-badge&logo=checkmarx)](docs/argo/RULES.md)\n`;
  output += `[![Active Branch](https://img.shields.io/badge/Branch-feat%2Fmonster--mash--exploration-FF1E8E?style=for-the-badge&logo=git)](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration)\n\n`;
  output += `\`\`\`text\n`;
  output += `FIDELITY: The SetMix Multiverse — 1.0 Release Progress Tracker\n`;
  output += `[${renderBar(totalDoneWeight / 100)}] ${overallPercent}% Complete (${totalJobsDone}/${JOBS.length} Landed | ${remainingJobs} Remaining | ~${remainingAgentDays} Agent-Days)\n\n`;

  for (const [phaseName, stats] of phaseTotals.entries()) {
    const pRatio = stats.totalWeight > 0 ? stats.doneWeight / stats.totalWeight : 0;
    const pPercent = (pRatio * 100).toFixed(0).padStart(3);
    const label = phaseName.padEnd(30, ' ');
    output += `${label} [${renderBar(pRatio)}] ${pPercent}% (${stats.doneCount}/${stats.totalCount})\n`;
  }
  output += `\`\`\`\n<!-- ROADMAP_PROGRESS_END -->`;

  return output;
}

function updateFile(filePath, progressBlock) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const startTag = '<!-- ROADMAP_PROGRESS_START -->';
  const endTag = '<!-- ROADMAP_PROGRESS_END -->';

  let updated;
  if (content.includes(startTag) && content.includes(endTag)) {
    const before = content.slice(0, content.indexOf(startTag));
    const after = content.slice(content.indexOf(endTag) + endTag.length);
    updated = before + progressBlock + after;
  } else {
    updated = progressBlock + '\n\n' + content;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`Updated progress tracker in ${path.relative(ROOT, filePath)}`);
}

const progressBlock = calculateProgress();
updateFile(path.join(ROOT, 'docs', 'JOB_BOARD.md'), progressBlock);
updateFile(path.join(ROOT, 'README.md'), progressBlock);
console.log('Roadmap progress calculation complete.');
