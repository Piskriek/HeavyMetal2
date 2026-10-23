// ============================================================================
// File: scripts/agent-worker.mjs
// Universal Multi-Agent Job Board Parser, Watcher & GitHub Sync CLI
// Works alongside `scripts/command-center.mjs` and `docs/JOB_BOARD.md`.
//
// Jobs name a ROLE (ARCHITECT, ENGINEER, BUILDER, RUNNER, RIG, OVERSEER, OWNER,
// ANY), never a model. `docs/agents/roster.json` maps each role to the model
// available in the current environment (claude-code | antigravity). Legacy
// names (ARGO, OPUS, FLASH, HAIKU, 3DPC) are still accepted and mapped.
//
// Usage for any agent, in any environment:
//   node scripts/agent-worker.mjs --list [--role BUILDER] [--status OPEN]
//   node scripts/agent-worker.mjs --dispatch --env claude-code|antigravity [--status OPEN]
//   node scripts/agent-worker.mjs --watch --role BUILDER [--github] [--every 15] [--max-min 30]
//   node scripts/agent-worker.mjs --claim JOB-06 --role BUILDER --by "sonnet@claude-code" [--push]
//   node scripts/agent-worker.mjs --complete JOB-06 --status DONE --sha <sha> --note "..." [--push]
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_BOARD_PATH = resolve(ROOT_DIR, 'docs/JOB_BOARD.md');
export const ROSTER_PATH = resolve(ROOT_DIR, 'docs/agents/roster.json');

export const ROLES = ['OVERSEER', 'ARCHITECT', 'ENGINEER', 'BUILDER', 'RUNNER', 'RIG', 'OWNER', 'ANY'];

export function readRoster(rosterPath = ROSTER_PATH) {
  try {
    return JSON.parse(readFileSync(rosterPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Maps a role or legacy agent name (ARGO, OPUS, FLASH, HAIKU, 3DPC) to a role. */
export function normalizeRole(value, roster = readRoster()) {
  const v = String(value ?? '').trim().toUpperCase();
  if (!v) return 'ANY';
  if (ROLES.includes(v)) return v;
  for (const [role, def] of Object.entries(roster?.roles ?? {})) {
    if ((def.legacy ?? []).map((l) => l.toUpperCase()).includes(v)) return role;
  }
  return v;
}

/** Resolves which model/tool to use for a role in an environment. */
export function resolveRole(role, env, roster = readRoster()) {
  const envDef = roster?.environments?.[env];
  const rung = envDef?.ladder?.[role] ?? envDef?.ladder?.[role === 'ANY' ? 'BUILDER' : role];
  return { env, role, spawnTool: envDef?.spawnTool ?? '', ...(rung ?? { model: 'unmapped' }) };
}

/** Resolves a job's skill tags into per-environment invocations. */
export function resolveSkills(skillsField, env, roster = readRoster()) {
  return String(skillsField ?? '')
    .split(/[,\s]+/)
    .map((s) => s.replace(/`/g, '').trim())
    .filter(Boolean)
    .map((tag) => ({ tag, invoke: roster?.skills?.[tag]?.[env]?.invoke ?? '(unmapped tag: add to docs/agents/roster.json)' }));
}

const JOB_HEADING_RE = /^##\s+([A-Za-z0-9_-]+)\s+\[(OPEN|TAKEN|REVIEW|HELD|DONE)\]\s+(.*)$/;
const MILESTONE_RE = /^-\s+\*\*(M\d+)\s+[—-]\s+(.+?)\*\*:\s*(.*)$/;

export function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function runGit(args, cwd = ROOT_DIR) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    };
  } catch (err) {
    return {
      ok: false,
      stdout: err?.stdout ? String(err.stdout).trim() : '',
      stderr: err?.stderr ? String(err.stderr).trim() : String(err?.message ?? err),
    };
  }
}

/**
 * Parses `docs/JOB_BOARD.md` into `{ header, milestones, jobs }`.
 */
export function parseJobBoard(markdownText) {
  const text = String(markdownText ?? '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const queueMarkerIdx = lines.findIndex((l) => /^##\s+3\.\s+JOB QUEUE/i.test(l.trim()));
  const firstJobIdx = lines.findIndex((l, idx) => idx > (queueMarkerIdx >= 0 ? queueMarkerIdx : -1) && JOB_HEADING_RE.test(l));

  const splitIdx = firstJobIdx >= 0 ? firstJobIdx : lines.length;
  const headerLines = lines.slice(0, splitIdx);
  const jobLines = lines.slice(splitIdx);

  const milestones = [];
  for (const line of headerLines) {
    const m = MILESTONE_RE.exec(line.trim());
    if (m) {
      milestones.push({
        id: m[1].trim(),
        title: m[2].trim(),
        description: m[3].trim(),
      });
    }
  }

  const jobs = [];
  let current = null;
  let inMeta = false;
  const roster = readRoster();

  const flushJob = () => {
    if (!current) return;
    current.body = current.bodyLines.join('\n').trim();
    delete current.bodyLines;
    jobs.push(current);
    current = null;
  };

  for (const line of jobLines) {
    const hm = JOB_HEADING_RE.exec(line);
    if (hm) {
      flushJob();
      current = {
        id: hm[1].trim(),
        status: hm[2].trim(),
        title: hm[3].trim(),
        agent: 'ANY', // the ROLE (kept as `agent` for Command Center compatibility)
        skills: '',
        claimant: '',
        priority: 'P1',
        milestone: 'M1',
        paths: '',
        verify: '',
        updated: '',
        sha: '',
        bodyLines: [],
      };
      inMeta = true;
      continue;
    }
    if (!current) continue;

    if (inMeta) {
      const metaMatch = /^-\s+\*\*([A-Za-z]+):\*\*\s*(.*)$/.exec(line.trim());
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        if (key === 'role' || key === 'agent') current.agent = normalizeRole(val, roster);
        else if (key === 'skills') current.skills = val.replace(/`/g, '');
        else if (key === 'claimant') current.claimant = val.replace(/`/g, '');
        else if (key === 'priority') current.priority = val.toUpperCase() || 'P1';
        else if (key === 'milestone') current.milestone = val.toUpperCase() || 'M1';
        else if (key === 'paths') current.paths = val.replace(/`/g, '');
        else if (key === 'verify') current.verify = val.replace(/^`|`$/g, '');
        else if (key === 'updated') current.updated = val;
        else if (key === 'sha' || key === 'commit') current.sha = val.replace(/`/g, '');
        continue;
      }
      if (line.trim() === '') {
        inMeta = false;
        continue;
      }
      inMeta = false;
    }
    current.bodyLines.push(line);
  }
  flushJob();

  let header = headerLines.join('\n').trimEnd();
  if (!header.includes('## 3. JOB QUEUE')) {
    header += '\n\n---\n\n## 3. JOB QUEUE';
  }

  return { header, milestones, jobs };
}

/**
 * Serializes `{ header, jobs }` back into lossless `docs/JOB_BOARD.md` markdown.
 */
export function serializeJobBoard(board) {
  const blocks = [board.header.trimEnd(), ''];
  for (const job of board.jobs) {
    blocks.push(`## ${job.id} [${job.status}] ${job.title}`);
    blocks.push(`- **Role:** ${normalizeRole(job.agent || 'ANY')}`);
    if (job.skills) blocks.push(`- **Skills:** ${job.skills.split(/[,\s]+/).filter(Boolean).map((s) => `\`${s.replace(/`/g, '')}\``).join(', ')}`);
    if (job.claimant) blocks.push(`- **Claimant:** ${job.claimant}`);
    blocks.push(`- **Priority:** ${job.priority || 'P1'}`);
    blocks.push(`- **Milestone:** ${job.milestone || 'M1'}`);
    if (job.paths) blocks.push(`- **Paths:** \`${job.paths.replace(/`/g, '')}\``);
    if (job.verify) blocks.push(`- **Verify:** \`${job.verify.replace(/^`|`$/g, '')}\``);
    if (job.sha) blocks.push(`- **Commit:** \`${job.sha.replace(/^`|`$/g, '')}\``);
    blocks.push(`- **Updated:** ${job.updated || nowStamp()}`);
    blocks.push('');
    if (job.body && job.body.trim()) {
      blocks.push(job.body.trim());
      blocks.push('');
    }
  }
  return `${blocks.join('\n').trimEnd()}\n`;
}

export function readBoardFromDisk(boardPath = DEFAULT_BOARD_PATH) {
  const raw = existsSync(boardPath) ? readFileSync(boardPath, 'utf8') : '';
  return parseJobBoard(raw);
}

export function writeBoardToDisk(board, boardPath = DEFAULT_BOARD_PATH) {
  const out = serializeJobBoard(board);
  writeFileSync(boardPath, out, 'utf8');
  return out;
}

/**
 * Syncs `docs/JOB_BOARD.md` from GitHub origin if remote has newer commits on it.
 */
export function fetchRemoteBoardIfNewer() {
  const branchRes = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchRes.ok && branchRes.stdout ? branchRes.stdout : 'feat/monster-mash-exploration';
  runGit(['fetch', '--quiet', 'origin', branch]);
  const remoteFile = runGit(['show', `origin/${branch}:docs/JOB_BOARD.md`]);
  return { branch, remoteMarkdown: remoteFile.ok ? remoteFile.stdout : null };
}

// ============================================================================
// CLI Execution when invoked directly (`node scripts/agent-worker.mjs ...`)
// ============================================================================
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const hasFlag = (k) => args.includes(`--${k}`);
  const getOpt = (k, fallback = undefined) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
  };

  // `--role` is canonical; `--agent` still works and legacy names map to roles.
  const roleOpt = getOpt('role', '') || getOpt('agent', '') || '';
  const agentFilter = roleOpt ? normalizeRole(roleOpt) : '';
  const statusFilter = (getOpt('status', '') || '').toUpperCase();
  const envOpt = (getOpt('env', '') || '').toLowerCase();

  if (hasFlag('list')) {
    if (hasFlag('github')) fetchRemoteBoardIfNewer();
    const board = readBoardFromDisk();
    const filtered = board.jobs.filter((j) => {
      if (agentFilter && j.agent !== agentFilter && j.agent !== 'ANY') return false;
      if (statusFilter && j.status !== statusFilter) return false;
      return true;
    });
    if (filtered.length === 0) {
      console.log('No matching jobs found.');
      process.exit(0);
    }
    for (const j of filtered) {
      const skills = j.skills ? ` {${j.skills}}` : '';
      console.log(`${j.id.padEnd(8)} [${j.status.padEnd(6)}] (${j.priority} | ${j.agent.padEnd(9)} | ${j.milestone}) ${j.title}${skills}`);
    }
    process.exit(0);
  }

  if (hasFlag('dispatch')) {
    const roster = readRoster();
    if (!roster) {
      console.error('docs/agents/roster.json missing or invalid.');
      process.exit(1);
    }
    const envs = Object.keys(roster.environments ?? {});
    if (!envOpt || !envs.includes(envOpt)) {
      console.error(`Usage: node scripts/agent-worker.mjs --dispatch --env <${envs.join('|')}> [--status OPEN] [--role X]`);
      process.exit(2);
    }
    const board = readBoardFromDisk();
    const wanted = statusFilter || 'OPEN';
    const jobs = board.jobs.filter((j) => j.status === wanted && (!agentFilter || j.agent === agentFilter));
    console.log(`DISPATCH PLAN // env=${envOpt} // ${jobs.length} ${wanted} job(s)`);
    console.log(`Spawn tool: ${roster.environments[envOpt].spawnTool}`);
    console.log('Routing: ' + (roster.routing?.rules?.[1] ?? ''));
    for (const j of jobs) {
      const r = resolveRole(j.agent, envOpt, roster);
      const skills = resolveSkills(j.skills, envOpt, roster);
      console.log(`\n${j.id} (${j.priority}) ${j.title}`);
      console.log(`  role   : ${j.agent}`);
      console.log(`  model  : ${r.model}${r.effort ? ` (effort ${r.effort})` : ''}${r.fallback ? `  · fallback ${r.fallback}` : ''}`);
      if (r.note) console.log(`  note   : ${r.note}`);
      for (const s of skills) console.log(`  skill  : ${s.tag} -> ${s.invoke}`);
      if (j.verify) console.log(`  verify : ${j.verify}`);
    }
    process.exit(0);
  }

  if (hasFlag('claim')) {
    const jobId = getOpt('claim');
    if (!jobId) {
      console.error('Usage: node scripts/agent-worker.mjs --claim <JOB-ID> [--role <ROLE>] [--by "<model>@<env>"] [--push]');
      process.exit(2);
    }
    const board = readBoardFromDisk();
    const job = board.jobs.find((j) => j.id.toUpperCase() === jobId.toUpperCase());
    if (!job) {
      console.error(`Job ${jobId} not found in docs/JOB_BOARD.md`);
      process.exit(1);
    }
    job.status = 'TAKEN';
    if (agentFilter) job.agent = agentFilter;
    job.claimant = getOpt('by', '') || job.claimant || job.agent;
    job.updated = nowStamp();
    writeBoardToDisk(board);
    console.log(`CLAIMED ${job.id} [${job.status}] role=${job.agent} by ${job.claimant}: ${job.title}`);
    if (hasFlag('push')) {
      const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
      runGit(['add', 'docs/JOB_BOARD.md']);
      runGit(['commit', '-m', `chore(board): ${job.agent} claimed ${job.id}`, '--', 'docs/JOB_BOARD.md']);
      runGit(['push', 'origin', branch]);
      console.log(`Pushed claim for ${job.id} to origin/${branch}`);
    }
    process.exit(0);
  }

  if (hasFlag('complete')) {
    const jobId = getOpt('complete');
    if (!jobId) {
      console.error('Usage: node scripts/agent-worker.mjs --complete <JOB-ID> [--status DONE|REVIEW] [--sha <SHA>] [--note "..."] [--push]');
      process.exit(2);
    }
    const board = readBoardFromDisk();
    const job = board.jobs.find((j) => j.id.toUpperCase() === jobId.toUpperCase());
    if (!job) {
      console.error(`Job ${jobId} not found in docs/JOB_BOARD.md`);
      process.exit(1);
    }
    job.status = statusFilter || 'DONE';
    const sha = getOpt('sha', '');
    if (sha) job.sha = sha;
    const note = getOpt('note', '');
    if (note) {
      job.body = `${job.body}\n\n**Completion Note (${nowStamp()}):** ${note}`.trim();
    }
    job.updated = nowStamp();
    writeBoardToDisk(board);
    console.log(`UPDATED ${job.id} -> [${job.status}]`);
    if (hasFlag('push')) {
      const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'feat/monster-mash-exploration';
      runGit(['add', 'docs/JOB_BOARD.md']);
      runGit(['commit', '-m', `chore(board): ${job.id} marked ${job.status}`, '--', 'docs/JOB_BOARD.md']);
      runGit(['push', 'origin', branch]);
      console.log(`Pushed ${job.id} [${job.status}] to origin/${branch}`);
    }
    process.exit(0);
  }

  if (hasFlag('watch')) {
    const everySec = Math.max(5, Number(getOpt('every', '15')));
    const maxMin = Math.max(1, Number(getOpt('max-min', '30')));
    const useGithub = hasFlag('github');
    const startedAt = Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    console.log(
      `WATCHING docs/JOB_BOARD.md for OPEN jobs assigned to ${agentFilter || 'ANY'}${useGithub ? ' (with GitHub fetch)' : ''}...`,
    );

    const checkOnce = () => {
      let board = readBoardFromDisk();
      if (useGithub) {
        const { remoteMarkdown } = fetchRemoteBoardIfNewer();
        if (remoteMarkdown) {
          const remoteBoard = parseJobBoard(remoteMarkdown);
          const remoteOpen = remoteBoard.jobs.find(
            (j) => j.status === 'OPEN' && (!agentFilter || j.agent === agentFilter || j.agent === 'ANY'),
          );
          const localOpen = board.jobs.find(
            (j) => j.status === 'OPEN' && (!agentFilter || j.agent === agentFilter || j.agent === 'ANY'),
          );
          if (remoteOpen && !localOpen) {
            board = remoteBoard;
          }
        }
      }
      const match = board.jobs.find(
        (j) => j.status === 'OPEN' && (!agentFilter || j.agent === agentFilter || j.agent === 'ANY'),
      );
      if (match) {
        console.log(`\n========================================`);
        console.log(`WAKE UP: ${match.id} [OPEN] (${match.priority} | ${match.agent} | ${match.milestone})`);
        console.log(`Title:   ${match.title}`);
        if (match.paths) console.log(`Paths:   ${match.paths}`);
        if (match.skills) console.log(`Skills:  ${match.skills}  (load these first; see docs/agents/roster.json)`);
        if (match.verify) console.log(`Verify:  ${match.verify}`);
        console.log(`----------------------------------------`);
        console.log(match.body);
        console.log(`========================================`);
        process.exit(0);
      }
    };

    checkOnce();
    while (Date.now() - startedAt < maxMin * 60_000) {
      await sleep(everySec * 1000);
      checkOnce();
    }
    console.log(`WAITING: No open job found for ${agentFilter || 'ANY'} after ${maxMin} min. Run again to continue.`);
    process.exit(3);
  }

  console.log(`Usage:
  node scripts/agent-worker.mjs --list [--role BUILDER] [--status OPEN]
  node scripts/agent-worker.mjs --dispatch --env claude-code|antigravity [--status OPEN] [--role X]
  node scripts/agent-worker.mjs --watch --role BUILDER [--github] [--every 15] [--max-min 30]
  node scripts/agent-worker.mjs --claim JOB-06 [--role BUILDER] --by "sonnet@claude-code" [--push]
  node scripts/agent-worker.mjs --complete JOB-06 --status DONE --sha <sha> --note "..." [--push]
Roles: ${ROLES.join(', ')} (legacy ARGO/OPUS/FLASH/HAIKU/3DPC accepted)`);
}
