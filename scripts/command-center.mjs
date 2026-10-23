// ============================================================================
// File: scripts/command-center.mjs
// FIDELITY Multi-Agent Command Center & GitHub Roadmap Job Board
// Start with:
//   Double-click `COMMAND_CENTER.bat`  OR  `node scripts/command-center.mjs`
// Opens on:
//   http://localhost:8090
// ============================================================================

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { networkInterfaces } from 'node:os';
import {
  ROOT_DIR,
  DEFAULT_BOARD_PATH,
  nowStamp,
  runGit,
  readBoardFromDisk,
  writeBoardToDisk,
  normalizeRole,
} from './agent-worker.mjs';

const PORT = Number(process.env.COMMAND_CENTER_PORT ?? 8090);

const WATCHED_FILES = [
  { id: 'job-board', label: 'docs/JOB_BOARD.md (Multi-Agent Job Board)', relPath: 'docs/JOB_BOARD.md' },
  { id: 'overwatch-radar', label: 'docs/OVERWATCH_TECH_AND_AI_RADAR.md (Overwatch Critique & AI/Tech Radar)', relPath: 'docs/OVERWATCH_TECH_AND_AI_RADAR.md' },
  { id: 'polish-reg', label: 'docs/DEFERRED_POLISH_REGISTRY.md (POL-01..314 QA Registry)', relPath: 'docs/DEFERRED_POLISH_REGISTRY.md' },
  { id: 'argo-note-43', label: 'docs/argo/notes/ARGO_NOTE_43_plan41_plan40_review.md (Rule 8a Audit)', relPath: 'docs/argo/notes/ARGO_NOTE_43_plan41_plan40_review.md' },
  { id: 'resume', label: 'docs/RESUME.md (Live Session Handoff)', relPath: 'docs/RESUME.md' },
  { id: 'flash-inbox', label: 'docs/sidecar/FLASH_INBOX.md (Flash Queue F-01..28)', relPath: 'docs/sidecar/FLASH_INBOX.md' },
  { id: 'flash-outbox', label: 'docs/sidecar/FLASH_OUTBOX.md (Flash Reports)', relPath: 'docs/sidecar/FLASH_OUTBOX.md' },
  { id: 'owner-asks', label: 'docs/OWNER_ASKS.md (Owner Directives)', relPath: 'docs/OWNER_ASKS.md' },
  { id: 'gemini-md', label: '.agents/GEMINI.md (Antigravity Instructions)', relPath: '.agents/GEMINI.md' },
  { id: 'claude-md', label: 'CLAUDE.md (Claude Opus Instructions)', relPath: 'CLAUDE.md' },
  { id: 'plan-42', label: 'docs/argo/plans/42-modular-stargate-earth-endgame.md', relPath: 'docs/argo/plans/42-modular-stargate-earth-endgame.md' },
  { id: 'plan-43', label: 'docs/argo/plans/43-modular-motion-and-logic-presets.md', relPath: 'docs/argo/plans/43-modular-motion-and-logic-presets.md' },
  { id: 'roster-md', label: 'docs/agents/ROSTER.md (Modular Roles & Environment Adaptation)', relPath: 'docs/agents/ROSTER.md' },
  { id: 'roster-json', label: 'docs/agents/roster.json (Role -> Model / Skill Map)', relPath: 'docs/agents/roster.json' },
  { id: 'skills-inventory', label: 'docs/agents/SKILLS_INVENTORY.md (Generated Skill Inventory)', relPath: 'docs/agents/SKILLS_INVENTORY.md' },
];

const EXPLICIT_DONE_POL_IDS = new Set([
  'POL-02', 'POL-03', 'POL-04', 'POL-06', 'POL-08', 'POL-11', 'POL-17', 'POL-18', 'POL-19', 'POL-20',
  'POL-21', 'POL-24', 'POL-27', 'POL-31', 'POL-43', 'POL-48', 'POL-55', 'POL-58', 'POL-61', 'POL-62',
  'POL-72', 'POL-76', 'POL-78', 'POL-79', 'POL-80', 'POL-82', 'POL-83', 'POL-86', 'POL-87', 'POL-88',
  'POL-89', 'POL-90', 'POL-91', 'POL-92', 'POL-93', 'POL-94', 'POL-99', 'POL-115', 'POL-117', 'POL-142',
  'POL-143', 'POL-144', 'POL-174', 'POL-175', 'POL-241', 'POL-261', 'POL-281', 'POL-282', 'POL-291',
  'POL-292', 'POL-301', 'POL-302', 'POL-303', 'POL-304', 'POL-305', 'POL-306', 'POL-313',
]);

function parseQaRegistry() {
  const items = [];
  const polPath = resolve(ROOT_DIR, 'docs/DEFERRED_POLISH_REGISTRY.md');
  if (existsSync(polPath)) {
    const raw = readFileSync(polPath, 'utf8');
    const lines = raw.split(/\r?\n/);

    // 1. Parse markdown tables: | **POL-XX** | **Title** | Source | Action | Status |
    for (const line of lines) {
      const m = line.match(/^\|\s*\*\*(POL-\d+)\*\*\s*\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|/);
      if (m) {
        const id = m[1].trim();
        const title = m[2].trim();
        const source = m[3].trim();
        const action = m[4].trim();
        const statusText = m[5].trim();
        const isDone =
          EXPLICIT_DONE_POL_IDS.has(id) ||
          /\b(Done|Closed|Confirmed|Ruled)\b/i.test(statusText) ||
          /\b(Closed|Done)\b/i.test(action);
        items.push({
          id,
          category: 'POL-TABLE',
          status: isDone ? 'DONE' : 'OPEN',
          title,
          source,
          summary: `${action}${statusText ? ' — Status: ' + statusText : ''}`,
        });
      }
    }

    // 2. Parse ### POL-XXX: Title sections
    const headingRegex = /^###\s+(POL-\d+):\s*(.+)$/gm;
    const matches = [...raw.matchAll(headingRegex)];
    for (let i = 0; i < matches.length; i++) {
      const id = matches[i][1].trim();
      const rawTitle = matches[i][2].trim();
      const startIdx = matches[i].index + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : raw.length;
      const bodyBlock = raw.slice(startIdx, endIdx).trim();
      const isDone =
        EXPLICIT_DONE_POL_IDS.has(id) ||
        /\b(DONE|Closed|confirmed,\s*not\s*open)\b/i.test(rawTitle) ||
        /-\s*\*\*(Done|Finished|Built\s+in)\b/i.test(bodyBlock);
      items.push({
        id,
        category: 'POL-TICKET',
        status: isDone ? 'DONE' : 'OPEN',
        title: rawTitle.replace(/\s*\(DONE[^)]*\)/i, ''),
        source: 'docs/DEFERRED_POLISH_REGISTRY.md',
        summary: bodyBlock.split(/\r?\n/).slice(0, 6).join('\n'),
      });
    }
  }

  // 3. Parse docs/sidecar/FLASH_INBOX.md (F-01..F-28)
  const flashPath = resolve(ROOT_DIR, 'docs/sidecar/FLASH_INBOX.md');
  if (existsSync(flashPath)) {
    const fRaw = readFileSync(flashPath, 'utf8');
    const fRegex = /^##\s+\[(DONE|OPEN|TAKEN|HELD)\]\s+(F-\d+)\s+[—-]\s+(.+)$/gm;
    const fMatches = [...fRaw.matchAll(fRegex)];
    for (let i = 0; i < fMatches.length; i++) {
      const status = fMatches[i][1].trim();
      const id = fMatches[i][2].trim();
      const title = fMatches[i][3].trim();
      const startIdx = fMatches[i].index + fMatches[i][0].length;
      const endIdx = i + 1 < fMatches.length ? fMatches[i + 1].index : fRaw.length;
      const snippet = fRaw
        .slice(startIdx, endIdx)
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('---'))
        .slice(0, 4)
        .join('\n');
      items.push({
        id,
        category: 'FLASH-QA',
        status: status === 'DONE' ? 'DONE' : 'OPEN',
        title,
        source: 'docs/sidecar/FLASH_INBOX.md',
        summary: snippet,
      });
    }
  }

  return items;
}

function detectCommitAgent(subject, body, author) {
  const full = `${subject}\n${body}`;
  if (/Co-Authored-By:\s*Claude/i.test(full)) return 'OPUS';
  if (/^Agent:\s*Gemini-Flash/im.test(full)) return 'FLASH';
  if (/^Agent:\s*Gemini-Argo/im.test(full) || /\bArgo\b/i.test(subject)) return 'ARGO';
  if (/\bHaiku\b/i.test(full)) return 'HAIKU';
  return author || 'OWNER';
}

function getGitTelemetry(doFetch = false) {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
  if (doFetch) {
    runGit(['fetch', '--quiet', 'origin', branch]);
  }
  const headSha = runGit(['rev-parse', '--short', 'HEAD']).stdout || 'unknown';
  const remoteSha = runGit(['rev-parse', '--short', `origin/${branch}`]).stdout || 'unknown';

  let ahead = 0;
  let behind = 0;
  const revList = runGit(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`]);
  if (revList.ok && revList.stdout) {
    const parts = revList.stdout.split(/\s+/);
    ahead = Number(parts[0] ?? 0);
    behind = Number(parts[1] ?? 0);
  }

  const logRaw = runGit(['log', '-n', '18', '--format=%h%x1f%an%x1f%ar%x1f%s%x1f%b%x1e']).stdout;
  const commits = logRaw
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((row) => {
      const [sha = '', author = '', relTime = '', subject = '', body = ''] = row.split('\x1f');
      return {
        sha,
        author,
        relTime,
        subject,
        agent: detectCommitAgent(subject, body, author),
      };
    });

  const statusRaw = runGit(['status', '-s']).stdout;
  const modifiedFiles = statusRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);

  const watchedMeta = WATCHED_FILES.map((wf) => {
    const abs = resolve(ROOT_DIR, wf.relPath);
    const exists = existsSync(abs);
    const stat = exists ? statSync(abs) : null;
    return {
      ...wf,
      exists,
      sizeBytes: stat ? stat.size : 0,
      mtimeIso: stat ? stat.mtime.toISOString() : null,
    };
  });

  return {
    branch,
    headSha,
    remoteSha,
    ahead,
    behind,
    commits,
    modifiedFiles,
    watchedMeta,
    checkedAt: nowStamp(),
  };
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) rejectBody(new Error('Payload too large'));
    });
    req.on('end', () => {
      try {
        resolveBody(data ? JSON.parse(data) : {});
      } catch (e) {
        rejectBody(e);
      }
    });
    req.on('error', rejectBody);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

const UI_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FIDELITY // Multi-Agent Command Center & GitHub Job Board</title>
  <style>
    :root {
      --bg-deep: #05080f;
      --bg-panel: rgba(10, 16, 28, 0.92);
      --bg-card: rgba(15, 24, 40, 0.88);
      --bg-card-hover: rgba(20, 32, 54, 0.96);
      --border-subtle: rgba(56, 189, 248, 0.18);
      --border-bright: rgba(56, 189, 248, 0.48);
      --cyan: #38bdf8;
      --emerald: #22c55e;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --violet: #a855f7;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 15% 0%, #0c192c 0%, var(--bg-deep) 65%);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(6, 11, 20, 0.95);
      border-bottom: 1px solid var(--border-subtle);
      padding: 14px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(14px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1.5px solid var(--cyan);
      display: grid;
      place-items: center;
      font-family: var(--font-mono);
      font-weight: 700;
      color: var(--cyan);
      background: rgba(56, 189, 248, 0.1);
      box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .git-pill-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pill {
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 6px 11px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald);
    }
    .btn {
      font-family: var(--font-sans);
      font-size: 12.5px;
      font-weight: 600;
      padding: 7px 13px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: rgba(15, 25, 45, 0.9);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover {
      border-color: var(--cyan);
      background: rgba(56, 189, 248, 0.14);
    }
    .btn-primary {
      background: rgba(56, 189, 248, 0.18);
      border-color: var(--cyan);
      color: #e0f2fe;
    }
    .btn-primary:hover {
      background: rgba(56, 189, 248, 0.3);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
    }
    .btn-emerald {
      background: rgba(34, 197, 94, 0.16);
      border-color: rgba(34, 197, 94, 0.55);
      color: #dcfce7;
    }
    .btn-emerald:hover {
      background: rgba(34, 197, 94, 0.28);
    }
    .nav-tabs {
      display: flex;
      gap: 8px;
      padding: 12px 24px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(8, 13, 24, 0.7);
    }
    .nav-tab {
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }
    .nav-tab.active {
      color: var(--cyan);
      border-bottom-color: var(--cyan);
    }
    main {
      padding: 20px 24px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .milestones-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .milestone-card {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .milestone-card:hover, .milestone-card.active {
      border-color: var(--cyan);
    }
    .milestone-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-family: var(--font-mono);
      color: var(--cyan);
      margin-bottom: 4px;
    }
    .milestone-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      line-height: 1.35;
    }
    .progress-track {
      height: 5px;
      background: rgba(148, 163, 184, 0.16);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--cyan), var(--emerald));
      transition: width 0.25s ease;
    }
    .agent-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 16px;
      justify-content: space-between;
    }
    .agent-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .agent-chip {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: var(--font-mono);
      font-weight: 600;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.8);
      color: var(--text-muted);
      cursor: pointer;
    }
    .agent-chip.active {
      color: var(--text-main);
      border-color: var(--cyan);
      background: rgba(56, 189, 248, 0.18);
    }
    .board-columns {
      display: grid;
      grid-template-columns: repeat(5, minmax(250px, 1fr));
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 12px;
    }
    .board-col {
      background: rgba(8, 14, 26, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      min-height: 460px;
    }
    .col-header {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .col-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    .job-card {
      background: var(--bg-card);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .job-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-bright);
    }
    .job-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .job-id {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--cyan);
    }
    .badges {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    .badge {
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-P0 { background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.45); }
    .badge-P1 { background: rgba(56, 189, 248, 0.18); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.4); }
    .badge-P2 { background: rgba(148, 163, 184, 0.18); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.35); }
    .badge-agent { background: rgba(168, 85, 247, 0.18); color: #e9d5ff; border: 1px solid rgba(168, 85, 247, 0.4); }
    .job-title {
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.35;
      color: #f8fafc;
    }
    .job-meta {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      word-break: break-word;
    }
    .job-body {
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.45;
      white-space: pre-wrap;
      max-height: 110px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .job-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding-top: 6px;
      border-top: 1px solid rgba(148, 163, 184, 0.12);
    }
    .btn-xs {
      font-family: var(--font-mono);
      font-size: 10.5px;
      padding: 4px 7px;
      border-radius: 4px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: rgba(15, 23, 42, 0.9);
      color: var(--text-main);
      cursor: pointer;
    }
    .btn-xs:hover {
      border-color: var(--cyan);
      color: var(--cyan);
    }
    .files-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 16px;
      min-height: 540px;
    }
    .file-list {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .file-item {
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      background: rgba(15, 23, 42, 0.6);
      color: var(--text-main);
    }
    .file-item.active, .file-item:hover {
      border-color: var(--cyan);
      background: rgba(56, 189, 248, 0.12);
    }
    .file-editor-pane {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    textarea.code-editor {
      flex: 1;
      min-height: 460px;
      width: 100%;
      background: #04070d;
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 6px;
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.5;
      resize: vertical;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(3, 6, 12, 0.85);
      backdrop-filter: blur(8px);
      display: none;
      place-items: center;
      z-index: 100;
      padding: 20px;
    }
    .modal-backdrop.open { display: grid; }
    .modal {
      background: #0b1322;
      border: 1px solid var(--cyan);
      border-radius: 10px;
      width: 100%;
      max-width: 680px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    }
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    label {
      font-size: 11.5px;
      font-family: var(--font-mono);
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    input, select, textarea {
      background: #050911;
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: var(--text-main);
      padding: 8px 10px;
      border-radius: 6px;
      font-family: var(--font-sans);
      font-size: 13px;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 24px;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid var(--cyan);
      color: var(--text-main);
      padding: 10px 16px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      z-index: 200;
      display: none;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-mark">S4</div>
      <div>
        <div class="brand-title">FIDELITY // Multi-Agent Command Center</div>
        <div class="brand-sub">GitHub Sync · Roadmap Tracker · Cross-Session Agent Dispatch</div>
      </div>
    </div>
    <div class="git-pill-bar">
      <div class="pill"><span class="dot"></span> <span id="git-branch">branch</span> @ <span id="git-head">...</span></div>
      <div class="pill" id="git-sync-pill">Origin: checking...</div>
      <button class="btn" onclick="fetchGithub()">⟳ Fetch GitHub</button>
      <button class="btn" onclick="pullGithub()">↓ Pull Fast-Forward</button>
      <button class="btn btn-emerald" onclick="pushBoardToGithub()">↑ Commit & Push Board to GitHub</button>
      <button class="btn btn-primary" onclick="openJobModal()">+ New Job</button>
    </div>
  </header>

  <div class="nav-tabs">
    <button class="nav-tab active" id="tab-btn-board" onclick="switchTab('board')">1. Roadmap & Agent Job Board</button>
    <button class="nav-tab" id="tab-btn-qa" onclick="switchTab('qa')">2. QA & Polish Registry (POL-01..314 · F-01..28)</button>
    <button class="nav-tab" id="tab-btn-files" onclick="switchTab('files')">3. Monitored Agent Files (Direct Editor)</button>
    <button class="nav-tab" id="tab-btn-git" onclick="switchTab('git')">4. GitHub Commit Stream & Working Tree</button>
  </div>

  <main>
    <!-- TAB 1: BOARD -->
    <section id="tab-board" style="display:flex; flex-direction:column; gap:18px;">
      <div class="milestones-grid" id="milestones-grid"></div>

      <div class="agent-strip">
        <div class="agent-filters" id="agent-filters"></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn" onclick="copyWatchCmd()">📋 Copy Terminal Watch Command</button>
          <button class="btn btn-primary" onclick="copyWakePrompt()">⚡ Copy Agent Session Wake Prompt</button>
        </div>
      </div>

      <div class="board-columns" id="board-columns"></div>
    </section>

    <!-- TAB 2: QA & POLISH REGISTRY -->
    <section id="tab-qa" class="hidden" style="display:flex; flex-direction:column; gap:14px;">
      <div class="agent-strip">
        <div class="agent-filters" id="qa-filters"></div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="qa-search" placeholder="Search POL-xx, F-xx, keywords..." oninput="renderQaTab()" style="width:260px;" />
          <button class="btn" onclick="switchTab('files'); loadWatchedFile('docs/DEFERRED_POLISH_REGISTRY.md')">✎ Open Raw Registry</button>
        </div>
      </div>
      <div id="qa-list" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:12px;"></div>
    </section>

    <!-- TAB 3: DIRECT FILE EDITOR -->
    <section id="tab-files" class="hidden">
      <div class="files-layout">
        <div class="file-list" id="watched-file-list"></div>
        <div class="file-editor-pane">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="font-family:var(--font-mono); font-size:13px; color:var(--cyan);" id="active-file-title">docs/JOB_BOARD.md</div>
            <div style="display:flex; gap:8px;">
              <button class="btn" onclick="reloadActiveFile()">Reload from Disk</button>
              <button class="btn btn-primary" onclick="saveActiveFile(false)">Save to Disk</button>
              <button class="btn btn-emerald" onclick="saveActiveFile(true)">Save, Commit & Push to GitHub</button>
            </div>
          </div>
          <textarea class="code-editor" id="file-editor-textarea"></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: GITHUB STREAM -->
    <section id="tab-git" class="hidden">
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px;">
        <div style="background:var(--bg-panel); border:1px solid var(--border-subtle); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px; color:var(--cyan); font-family:var(--font-mono);">RECENT COMMITS (LOCAL & GITHUB)</h3>
          <div id="commit-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
        <div style="background:var(--bg-panel); border:1px solid var(--border-subtle); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px; color:var(--amber); font-family:var(--font-mono);">MODIFIED / UNTRACKED PATHS</h3>
          <pre id="modified-files-box" style="font-family:var(--font-mono); font-size:11.5px; color:var(--text-muted); white-space:pre-wrap;"></pre>
        </div>
      </div>
    </section>
  </main>

  <!-- MODAL FOR NEW / EDIT JOB -->
  <div class="modal-backdrop" id="job-modal">
    <div class="modal">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-family:var(--font-mono); color:var(--cyan);" id="modal-heading">Create / Edit Job</h3>
        <button class="btn-xs" onclick="closeJobModal()">✕ ESC</button>
      </div>
      <div class="form-row">
        <label>Job ID
          <input type="text" id="f-id" placeholder="JOB-08" />
        </label>
        <label>Status
          <select id="f-status">
            <option value="OPEN">OPEN (Ready for Agent)</option>
            <option value="TAKEN">TAKEN (In Progress)</option>
            <option value="REVIEW">REVIEW (Needs Verification)</option>
            <option value="HELD">HELD (Blocked / Queued)</option>
            <option value="DONE">DONE (Verified)</option>
          </select>
        </label>
        <label>Role (model resolved per environment via docs/agents/roster.json)
          <select id="f-agent">
            <option value="ANY">ANY (First Available, BUILDER+)</option>
            <option value="OVERSEER">OVERSEER (Board, Radar, Routing)</option>
            <option value="ARCHITECT">ARCHITECT (Creative / Preset Specs)</option>
            <option value="ENGINEER">ENGINEER (Precision Systems / Review)</option>
            <option value="BUILDER">BUILDER (Scoped Implementation)</option>
            <option value="RUNNER">RUNNER (Mechanical One-File Tasks)</option>
            <option value="RIG">RIG (3D PC RTX 3080 Worker)</option>
            <option value="OWNER">OWNER (Review / Unblock)</option>
          </select>
        </label>
        <label>Skills (comma-separated tags, e.g. frontend, visual-verify)
          <input id="f-skills" type="text" placeholder="frontend, e2e" />
        </label>
        <label>Priority
          <select id="f-priority">
            <option value="P0">P0 (Critical)</option>
            <option value="P1">P1 (High / AAA)</option>
            <option value="P2">P2 (Stretch)</option>
          </select>
        </label>
        <label>Milestone
          <select id="f-milestone">
            <option value="M1">M1 (Layered Materials)</option>
            <option value="M2">M2 (Modular Machine Kits)</option>
            <option value="M3">M3 (Studio & BYOA Agent)</option>
            <option value="M4">M4 (Stargate Network)</option>
            <option value="M5">M5 (Earth Endgame)</option>
          </select>
        </label>
      </div>
      <label>Job Title
        <input type="text" id="f-title" placeholder="Short actionable title..." />
      </label>
      <div class="form-row">
        <label>Owned Paths (comma-separated)
          <input type="text" id="f-paths" placeholder="packages/coopnet, apps/web/src/base" />
        </label>
        <label>Verification Command
          <input type="text" id="f-verify" placeholder="npm.cmd run typecheck && npm.cmd test" />
        </label>
      </div>
      <label>Detailed Brief / Instructions for Agent
        <textarea id="f-body" rows="7" placeholder="Exact requirements, acceptance criteria, and files to touch..."></textarea>
      </label>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
        <button class="btn" onclick="closeJobModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveJobModal(false)">Save Job</button>
        <button class="btn btn-emerald" onclick="saveJobModal(true)">Save & Push to GitHub</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let state = {
      board: { milestones: [], jobs: [] },
      qa: [],
      git: {},
      filterAgent: 'ALL',
      filterMilestone: 'ALL',
      filterQa: 'ALL',
      activeFileRel: 'docs/JOB_BOARD.md',
    };

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
    }

    function switchTab(tab) {
      ['board', 'qa', 'files', 'git'].forEach((t) => {
        document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tab-btn-' + t).classList.toggle('active', t === tab);
      });
      if (tab === 'files') loadWatchedFile(state.activeFileRel);
      if (tab === 'qa') renderQaTab();
    }

    async function refreshState(doFetch = false) {
      const res = await fetch('/api/state' + (doFetch ? '?fetch=1' : ''));
      const data = await res.json();
      state.board = data.board;
      state.qa = data.qa || [];
      state.git = data.git;
      renderAll();
    }

    function renderAll() {
      const g = state.git;
      document.getElementById('git-branch').textContent = g.branch || 'main';
      document.getElementById('git-head').textContent = g.headSha || '...';
      const syncEl = document.getElementById('git-sync-pill');
      if (g.ahead === 0 && g.behind === 0) {
        syncEl.textContent = 'Origin in sync (' + (g.remoteSha || '') + ')';
        syncEl.style.borderColor = 'rgba(34, 197, 94, 0.45)';
      } else {
        syncEl.textContent = '↑' + (g.ahead || 0) + ' ahead · ↓' + (g.behind || 0) + ' behind origin';
        syncEl.style.borderColor = 'rgba(245, 158, 11, 0.6)';
      }

      // Render milestones
      const mGrid = document.getElementById('milestones-grid');
      mGrid.innerHTML = '';
      (state.board.milestones || []).forEach((m) => {
        const mJobs = state.board.jobs.filter((j) => j.milestone === m.id);
        const doneCount = mJobs.filter((j) => j.status === 'DONE').length;
        const pct = mJobs.length ? Math.round((doneCount / mJobs.length) * 100) : 0;
        const card = document.createElement('div');
        card.className = 'milestone-card' + (state.filterMilestone === m.id ? ' active' : '');
        card.onclick = () => {
          state.filterMilestone = state.filterMilestone === m.id ? 'ALL' : m.id;
          renderAll();
        };
        card.innerHTML =
          '<div class="milestone-head"><span>' + m.id + '</span><span>' + doneCount + '/' + mJobs.length + ' DONE (' + pct + '%)</span></div>' +
          '<div class="milestone-title">' + m.title + '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
        mGrid.appendChild(card);
      });

      // Render agent filter chips
      const agents = ['ALL', 'OVERSEER', 'ARCHITECT', 'ENGINEER', 'BUILDER', 'RUNNER', 'RIG', 'ANY'];
      const af = document.getElementById('agent-filters');
      af.innerHTML = '<span style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">ROLE FILTER:</span>';
      agents.forEach((ag) => {
        const count = ag === 'ALL'
          ? state.board.jobs.filter((j) => j.status === 'OPEN').length
          : state.board.jobs.filter((j) => j.status === 'OPEN' && j.agent === ag).length;
        const btn = document.createElement('button');
        btn.className = 'agent-chip' + (state.filterAgent === ag ? ' active' : '');
        btn.textContent = ag + ' (' + count + ' OPEN)';
        btn.onclick = () => { state.filterAgent = ag; renderAll(); };
        af.appendChild(btn);
      });

      // Render 5 status columns
      const statuses = [
        { key: 'OPEN', label: 'OPEN // READY FOR AGENT', color: '#38bdf8' },
        { key: 'TAKEN', label: 'TAKEN // IN PROGRESS', color: '#f59e0b' },
        { key: 'REVIEW', label: 'REVIEW // VERIFY 4-ANGLE', color: '#a855f7' },
        { key: 'HELD', label: 'HELD // QUEUED', color: '#94a3b8' },
        { key: 'DONE', label: 'DONE // VERIFIED', color: '#22c55e' },
      ];
      const colsEl = document.getElementById('board-columns');
      colsEl.innerHTML = '';

      statuses.forEach((st) => {
        const colJobs = state.board.jobs.filter((j) => {
          if (j.status !== st.key) return false;
          if (state.filterAgent !== 'ALL' && j.agent !== state.filterAgent) return false;
          if (state.filterMilestone !== 'ALL' && j.milestone !== state.filterMilestone) return false;
          return true;
        });

        const col = document.createElement('div');
        col.className = 'board-col';
        col.innerHTML =
          '<div class="col-header" style="color:' + st.color + '"><span>' + st.label + '</span><span>' + colJobs.length + '</span></div>' +
          '<div class="col-body"></div>';
        const body = col.querySelector('.col-body');

        colJobs.forEach((job) => {
          const card = document.createElement('div');
          card.className = 'job-card';
          card.innerHTML =
            '<div class="job-top">' +
              '<span class="job-id">' + job.id + ' · ' + job.milestone + '</span>' +
              '<div class="badges">' +
                '<span class="badge badge-' + job.priority + '">' + job.priority + '</span>' +
                '<span class="badge badge-agent">' + job.agent + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="job-title">' + escapeHtml(job.title) + '</div>' +
            (job.skills ? '<div class="job-meta">🧩 ' + escapeHtml(job.skills) + '</div>' : '') +
            (job.claimant ? '<div class="job-meta">👤 ' + escapeHtml(job.claimant) + '</div>' : '') +
            (job.paths ? '<div class="job-meta">📁 ' + escapeHtml(job.paths) + '</div>' : '') +
            (job.verify ? '<div class="job-meta">✔ ' + escapeHtml(job.verify) + '</div>' : '') +
            '<div class="job-body">' + escapeHtml(job.body || '') + '</div>' +
            '<div class="job-actions">' +
              (job.status !== 'OPEN' ? '<button class="btn-xs" onclick="setJobStatus(\'' + job.id + '\', \'OPEN\')">Open</button>' : '') +
              (job.status !== 'TAKEN' ? '<button class="btn-xs" onclick="setJobStatus(\'' + job.id + '\', \'TAKEN\')">Take</button>' : '') +
              (job.status !== 'REVIEW' ? '<button class="btn-xs" onclick="setJobStatus(\'' + job.id + '\', \'REVIEW\')">Review</button>' : '') +
              (job.status !== 'HELD' ? '<button class="btn-xs" onclick="setJobStatus(\'' + job.id + '\', \'HELD\')">Hold</button>' : '') +
              (job.status !== 'DONE' ? '<button class="btn-xs" onclick="setJobStatus(\'' + job.id + '\', \'DONE\')">Done</button>' : '') +
              '<button class="btn-xs" onclick="editJob(\'' + job.id + '\')">✎ Edit</button>' +
              '<button class="btn-xs" onclick="copyJobPrompt(\'' + job.id + '\')">📋 Prompt</button>' +
            '</div>';
          body.appendChild(card);
        });
        colsEl.appendChild(col);
      });

      // Render watched file list
      const wfList = document.getElementById('watched-file-list');
      wfList.innerHTML = '';
      (g.watchedMeta || []).forEach((wf) => {
        const btn = document.createElement('button');
        btn.className = 'file-item' + (state.activeFileRel === wf.relPath ? ' active' : '');
        btn.onclick = () => loadWatchedFile(wf.relPath);
        btn.innerHTML =
          '<div style="font-family:var(--font-mono); font-size:12px; font-weight:600; color:var(--cyan);">' + wf.relPath + '</div>' +
          '<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">' + wf.label + '</div>';
        wfList.appendChild(btn);
      });

      // Render commits & modified files
      const cList = document.getElementById('commit-list');
      cList.innerHTML = '';
      (g.commits || []).forEach((c) => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 10px; background:rgba(15,23,42,0.75); border:1px solid rgba(148,163,184,0.15); border-radius:6px; display:flex; justify-content:space-between; gap:10px; font-size:12.5px;';
        row.innerHTML =
          '<div><span style="font-family:var(--font-mono); color:var(--cyan); margin-right:8px;">' + c.sha + '</span>' +
          '<span class="badge badge-agent" style="margin-right:8px;">' + escapeHtml(c.agent) + '</span>' +
          '<span>' + escapeHtml(c.subject) + '</span></div>' +
          '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); white-space:nowrap;">' + escapeHtml(c.relTime) + '</div>';
        cList.appendChild(row);
      });
      document.getElementById('modified-files-box').textContent = (g.modifiedFiles || []).join('\n') || 'Working tree clean.';
      renderQaTab();
    }

    function renderQaTab() {
      const qaFiltersEl = document.getElementById('qa-filters');
      const qaListEl = document.getElementById('qa-list');
      if (!qaFiltersEl || !qaListEl) return;

      const items = state.qa || [];
      const openCount = items.filter((i) => i.status !== 'DONE').length;
      const doneCount = items.filter((i) => i.status === 'DONE').length;
      const polCount = items.filter((i) => i.id.startsWith('POL-')).length;
      const flashCount = items.filter((i) => i.id.startsWith('F-')).length;

      const filters = [
        { key: 'ALL', label: 'ALL (' + items.length + ')' },
        { key: 'OPEN', label: 'OPEN / DEFERRED (' + openCount + ')' },
        { key: 'DONE', label: 'DONE / SHIPPED (' + doneCount + ')' },
        { key: 'POL', label: 'POL-01..314 (' + polCount + ')' },
        { key: 'FLASH', label: 'FLASH F-01..28 (' + flashCount + ')' },
      ];
      qaFiltersEl.innerHTML = '<span style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">QA REGISTRY:</span>';
      filters.forEach((f) => {
        const btn = document.createElement('button');
        btn.className = 'agent-chip' + (state.filterQa === f.key ? ' active' : '');
        btn.textContent = f.label;
        btn.onclick = () => { state.filterQa = f.key; renderQaTab(); };
        qaFiltersEl.appendChild(btn);
      });

      const q = (document.getElementById('qa-search')?.value || '').trim().toLowerCase();
      const filtered = items.filter((it) => {
        if (state.filterQa === 'OPEN' && it.status === 'DONE') return false;
        if (state.filterQa === 'DONE' && it.status !== 'DONE') return false;
        if (state.filterQa === 'POL' && !it.id.startsWith('POL-')) return false;
        if (state.filterQa === 'FLASH' && !it.id.startsWith('F-')) return false;
        if (q) {
          const hay = (it.id + ' ' + it.title + ' ' + it.summary + ' ' + it.source).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      qaListEl.innerHTML = '';
      filtered.forEach((it) => {
        const card = document.createElement('div');
        card.className = 'job-card';
        const isDone = it.status === 'DONE';
        card.innerHTML =
          '<div class="job-top">' +
            '<span class="job-id">' + escapeHtml(it.id) + '</span>' +
            '<div class="badges">' +
              '<span class="badge ' + (isDone ? 'badge-P1' : 'badge-P0') + '" style="' + (isDone ? 'background:rgba(34,197,94,0.18);color:#86efac;border-color:rgba(34,197,94,0.45);' : '') + '">' + (isDone ? 'DONE' : 'OPEN') + '</span>' +
              '<span class="badge badge-agent">' + escapeHtml(it.category) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="job-title">' + escapeHtml(it.title) + '</div>' +
          '<div class="job-meta">📄 ' + escapeHtml(it.source) + '</div>' +
          '<div class="job-body">' + escapeHtml(it.summary) + '</div>' +
          '<div class="job-actions">' +
            '<button class="btn-xs" onclick="promoteQaItem(\'' + escapeHtml(it.id) + '\')">⚡ Promote to Active Board Job</button>' +
          '</div>';
        qaListEl.appendChild(card);
      });
    }

    function promoteQaItem(qaId) {
      const it = (state.qa || []).find((x) => x.id === qaId);
      if (!it) return;
      switchTab('board');
      openJobModal({
        id: 'JOB-' + it.id,
        status: 'OPEN',
        agent: 'FLASH',
        priority: 'P1',
        milestone: 'M3',
        title: it.id + ': ' + it.title,
        paths: 'docs/DEFERRED_POLISH_REGISTRY.md',
        verify: 'npm.cmd run typecheck && npm.cmd test',
        body: 'Source: ' + it.source + '\n\n' + it.summary,
      });
    }

    function escapeHtml(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function setJobStatus(id, status) {
      const job = state.board.jobs.find((j) => j.id === id);
      if (!job) return;
      job.status = status;
      await fetch('/api/job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      showToast(id + ' -> [' + status + '] saved to docs/JOB_BOARD.md');
      refreshState();
    }

    function openJobModal(job) {
      const nextNum = String(state.board.jobs.length + 1).padStart(2, '0');
      document.getElementById('f-id').value = job ? job.id : 'JOB-' + nextNum;
      document.getElementById('f-status').value = job ? job.status : 'OPEN';
      document.getElementById('f-agent').value = job ? job.agent : (state.filterAgent !== 'ALL' ? state.filterAgent : 'ANY');
      document.getElementById('f-skills').value = job ? (job.skills || '') : '';
      document.getElementById('f-priority').value = job ? job.priority : 'P1';
      document.getElementById('f-milestone').value = job ? job.milestone : 'M4';
      document.getElementById('f-title').value = job ? job.title : '';
      document.getElementById('f-paths').value = job ? job.paths : '';
      document.getElementById('f-verify').value = job ? job.verify : 'npm.cmd run typecheck && npm.cmd test';
      document.getElementById('f-body').value = job ? job.body : '';
      document.getElementById('job-modal').classList.add('open');
    }

    function closeJobModal() {
      document.getElementById('job-modal').classList.remove('open');
    }

    function editJob(id) {
      const job = state.board.jobs.find((j) => j.id === id);
      if (job) openJobModal(job);
    }

    async function saveJobModal(andPush) {
      const job = {
        id: document.getElementById('f-id').value.trim() || 'JOB-NEW',
        status: document.getElementById('f-status').value,
        agent: document.getElementById('f-agent').value,
        skills: document.getElementById('f-skills').value.trim(),
        priority: document.getElementById('f-priority').value,
        milestone: document.getElementById('f-milestone').value,
        title: document.getElementById('f-title').value.trim() || 'Untitled Task',
        paths: document.getElementById('f-paths').value.trim(),
        verify: document.getElementById('f-verify').value.trim(),
        body: document.getElementById('f-body').value.trim(),
      };
      await fetch('/api/job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job, push: andPush }),
      });
      closeJobModal();
      showToast(andPush ? job.id + ' saved & pushed to GitHub!' : job.id + ' saved to docs/JOB_BOARD.md');
      refreshState();
    }

    async function fetchGithub() {
      showToast('Fetching latest from GitHub origin...');
      await refreshState(true);
      showToast('GitHub status updated.');
    }

    async function pullGithub() {
      showToast('Pulling fast-forward from GitHub...');
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'pull' }),
      });
      const out = await res.json();
      showToast(out.message || 'Pull completed');
      refreshState();
    }

    async function pushBoardToGithub() {
      showToast('Committing & pushing docs/JOB_BOARD.md to GitHub...');
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'push-board' }),
      });
      const out = await res.json();
      showToast(out.message || 'Pushed to GitHub!');
      refreshState();
    }

    function copyWatchCmd() {
      const ag = state.filterAgent === 'ALL' ? 'ANY' : state.filterAgent;
      const cmd = 'node scripts/agent-worker.mjs --watch --role ' + ag + ' --github';
      navigator.clipboard.writeText(cmd);
      showToast('Copied: ' + cmd);
    }

    function copyWakePrompt() {
      const ag = state.filterAgent === 'ALL' ? 'ANY' : state.filterAgent;
      const prompt = 'Read docs/RESUME.md, docs/JOB_BOARD.md and docs/agents/ROSTER.md first. Identify your environment (claude-code or antigravity), run "node scripts/skill-inventory.mjs" and "node scripts/agent-worker.mjs --dispatch --env <env> --role ' + ag + '" to see which model and skills each job needs. Claim the top OPEN job with "node scripts/agent-worker.mjs --claim <JOB-ID> --by \\"<model>@<env>\\"", load its Skills before reasoning, execute its brief following docs/argo/RULES.md, run its Verify command, and mark it with "node scripts/agent-worker.mjs --complete <JOB-ID> --status REVIEW".';
      navigator.clipboard.writeText(prompt);
      showToast('Copied Agent Wake Prompt to clipboard!');
    }

    function copyJobPrompt(id) {
      const job = state.board.jobs.find((j) => j.id === id);
      if (!job) return;
      const prompt =
        'Execute ' + job.id + ' from docs/JOB_BOARD.md:\n' +
        'Title: ' + job.title + '\n' +
        'Paths: ' + (job.paths || 'as needed') + '\n' +
        'Verify: ' + (job.verify || 'npm.cmd run typecheck') + '\n\n' +
        job.body + '\n\n' +
        'When finished and verified, run: node scripts/agent-worker.mjs --complete ' + job.id + ' --status DONE';
      navigator.clipboard.writeText(prompt);
      showToast('Copied prompt for ' + job.id + '!');
    }

    async function loadWatchedFile(relPath) {
      state.activeFileRel = relPath;
      document.getElementById('active-file-title').textContent = relPath;
      const res = await fetch('/api/file?path=' + encodeURIComponent(relPath));
      const data = await res.json();
      document.getElementById('file-editor-textarea').value = data.content || '';
      renderAll();
    }

    function reloadActiveFile() {
      loadWatchedFile(state.activeFileRel);
      showToast('Reloaded ' + state.activeFileRel);
    }

    async function saveActiveFile(andPush) {
      const content = document.getElementById('file-editor-textarea').value;
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: state.activeFileRel, content, push: andPush }),
      });
      const out = await res.json();
      showToast(out.message || 'Saved ' + state.activeFileRel);
      refreshState();
    }

    refreshState();
    setInterval(() => refreshState(false), 15000);
  </script>
</body>
</html>`;

const ALLOWED_REL_PATHS = new Set(WATCHED_FILES.map((w) => w.relPath));

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(UI_HTML);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const doFetch = url.searchParams.get('fetch') === '1';
      const board = readBoardFromDisk();
      const qa = parseQaRegistry();
      const git = getGitTelemetry(doFetch);
      sendJson(res, 200, { board, qa, git });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/job') {
      const body = await readJsonBody(req);
      const incoming = body.job;
      if (!incoming || !incoming.id) {
        sendJson(res, 400, { error: 'Missing job.id' });
        return;
      }
      const board = readBoardFromDisk();
      const idx = board.jobs.findIndex((j) => j.id.toUpperCase() === String(incoming.id).toUpperCase());
      const updatedJob = {
        id: String(incoming.id).trim(),
        status: String(incoming.status || 'OPEN').toUpperCase(),
        title: String(incoming.title || 'Untitled').trim(),
        agent: normalizeRole(incoming.agent || 'ANY'),
        skills: String(incoming.skills ?? (idx >= 0 ? board.jobs[idx].skills : '') ?? '').trim(),
        claimant: String(incoming.claimant ?? (idx >= 0 ? board.jobs[idx].claimant : '') ?? '').trim(),
        priority: String(incoming.priority || 'P1').toUpperCase(),
        milestone: String(incoming.milestone || 'M1').toUpperCase(),
        paths: String(incoming.paths ?? '').trim(),
        verify: String(incoming.verify ?? '').trim(),
        sha: String(incoming.sha ?? (idx >= 0 ? board.jobs[idx].sha : '') ?? '').trim(),
        updated: nowStamp(),
        body: String(incoming.body ?? '').trim(),
      };
      if (idx >= 0) {
        board.jobs[idx] = updatedJob;
      } else {
        board.jobs.unshift(updatedJob);
      }
      writeBoardToDisk(board);

      if (body.push) {
        const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
        runGit(['add', 'docs/JOB_BOARD.md']);
        runGit(['commit', '-m', `chore(board): update ${updatedJob.id} [${updatedJob.status}] (${updatedJob.agent})`, '--', 'docs/JOB_BOARD.md']);
        runGit(['push', 'origin', branch]);
      }
      sendJson(res, 200, { ok: true, job: updatedJob });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/file') {
      const rel = String(url.searchParams.get('path') ?? '');
      if (!ALLOWED_REL_PATHS.has(rel)) {
        sendJson(res, 403, { error: 'Path not in watched list' });
        return;
      }
      const abs = resolve(ROOT_DIR, rel);
      const content = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      sendJson(res, 200, { path: rel, content });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/file') {
      const body = await readJsonBody(req);
      const rel = String(body.path ?? '');
      if (!ALLOWED_REL_PATHS.has(rel)) {
        sendJson(res, 403, { error: 'Path not in watched list' });
        return;
      }
      const abs = resolve(ROOT_DIR, rel);
      writeFileSync(abs, String(body.content ?? ''), 'utf8');
      let message = `Saved ${rel} to disk.`;
      if (body.push) {
        const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
        runGit(['add', rel]);
        runGit(['commit', '-m', `docs(command-center): update ${rel}`, '--', rel]);
        const pushRes = runGit(['push', 'origin', branch]);
        message = pushRes.ok ? `Saved & pushed ${rel} to origin/${branch}` : `Saved locally (${pushRes.stderr})`;
      }
      sendJson(res, 200, { ok: true, message });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/git') {
      const body = await readJsonBody(req);
      const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
      if (body.action === 'pull') {
        const r = runGit(['pull', '--ff-only', 'origin', branch]);
        sendJson(res, 200, { ok: r.ok, message: r.ok ? `Pulled origin/${branch}: ${r.stdout || 'up to date'}` : r.stderr });
        return;
      }
      if (body.action === 'push-board') {
        runGit(['add', 'docs/JOB_BOARD.md', 'docs/RESUME.md']);
        runGit(['commit', '-m', 'chore(board): sync job board & resume state', '--', 'docs/JOB_BOARD.md', 'docs/RESUME.md']);
        const p = runGit(['push', 'origin', branch]);
        sendJson(res, 200, {
          ok: p.ok,
          message: p.ok ? `Synced & pushed docs/JOB_BOARD.md to origin/${branch}` : `Committed locally (${p.stderr || 'already up to date'})`,
        });
        return;
      }
      sendJson(res, 400, { error: 'Unknown git action' });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message ?? err) });
  }
})
  .on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`FIDELITY Command Center is already running at http://localhost:${PORT}`);
      process.exit(0);
    }
    throw e;
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(`FIDELITY // MULTI-AGENT COMMAND CENTER & GITHUB BOARD`);
    console.log(`  Local URL:   http://localhost:${PORT}`);
    for (const list of Object.values(networkInterfaces())) {
      for (const n of list ?? []) {
        if (n.family === 'IPv4' && !n.internal) {
          console.log(`  LAN URL:     http://${n.address}:${PORT}`);
        }
      }
    }
    console.log(`  Job Board:   ${ relative(ROOT_DIR, DEFAULT_BOARD_PATH) }`);
    console.log(`========================================================`);
  });
