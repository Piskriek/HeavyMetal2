// ============================================================================
// File: scripts/skill-inventory.mjs
// Wake-time skill & tool inventory for the Overseer (JOB-18).
//
// Scans every place a skill/command can live for BOTH environments the
// Overseer may wake in (Claude Code and Google Antigravity), then:
//   1. writes docs/agents/SKILLS_INVENTORY.md (what is actually installed now),
//   2. checks every skill tag in docs/agents/roster.json against it and flags
//      tags whose claude-code / antigravity skill could not be found.
//
// Usage:
//   node scripts/skill-inventory.mjs            # scan + write inventory
//   node scripts/skill-inventory.mjs --check    # scan + report only (no write)
// ============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOME = homedir();
const ROSTER_PATH = resolve(ROOT, 'docs/agents/roster.json');
const OUT_PATH = resolve(ROOT, 'docs/agents/SKILLS_INVENTORY.md');

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

/** Reads `name` / `description` from a SKILL.md or command .md front matter. */
function frontMatter(file) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let val = kv[2].trim();
    // YAML block scalars (`>-`, `|`): join the following indented lines.
    if (/^[>|][+-]?$/.test(val)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      val = block.join(' ');
    }
    out[kv[1].toLowerCase()] = val.replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

/** Finds `<dir>/<skill>/SKILL.md` up to `depth` levels deep. */
function findSkillFiles(dir, depth = 3) {
  const found = [];
  const walk = (d, left) => {
    if (left < 0 || !isDir(d)) return;
    let entries = [];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e);
      if (e === 'SKILL.md') found.push(p);
      else if (isDir(p) && e !== 'node_modules' && !e.startsWith('.git')) walk(p, left - 1);
    }
  };
  walk(dir, depth);
  return found;
}

function findCommandFiles(dir) {
  if (!isDir(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function skillEntry(file, env, source, kind = 'skill') {
  const fm = frontMatter(file);
  const name = fm.name || (kind === 'command' ? basename(file, '.md') : basename(join(file, '..')));
  return { env, source, kind, name, description: (fm.description || '').slice(0, 160), file };
}

// ----------------------------------------------------------------------------
// Claude Code locations
// ----------------------------------------------------------------------------
function scanClaude() {
  const out = [];
  const claudeHome = join(HOME, '.claude');

  // Installed plugins (only the active installPath of each plugin).
  const installed = readJson(join(claudeHome, 'plugins', 'installed_plugins.json'));
  for (const [pluginId, installs] of Object.entries(installed?.plugins ?? {})) {
    for (const inst of installs ?? []) {
      const base = inst.installPath;
      if (!base || !isDir(base)) continue;
      for (const f of findSkillFiles(join(base, 'skills'), 2)) out.push(skillEntry(f, 'claude-code', `plugin:${pluginId}`));
      for (const f of findCommandFiles(join(base, 'commands'))) out.push(skillEntry(f, 'claude-code', `plugin:${pluginId}`, 'command'));
    }
  }
  // User-level skills and commands.
  for (const f of findSkillFiles(join(claudeHome, 'skills'), 2)) out.push(skillEntry(f, 'claude-code', 'user'));
  for (const f of findCommandFiles(join(claudeHome, 'commands'))) out.push(skillEntry(f, 'claude-code', 'user', 'command'));
  // Project-level skills and commands.
  for (const f of findSkillFiles(join(ROOT, '.claude', 'skills'), 2)) out.push(skillEntry(f, 'claude-code', 'project'));
  for (const f of findCommandFiles(join(ROOT, '.claude', 'commands'))) out.push(skillEntry(f, 'claude-code', 'project', 'command'));
  return out;
}

/** Marketplace plugins that are available but NOT installed (install candidates). */
function scanClaudeMarketplace(installedIds) {
  const market = join(HOME, '.claude', 'plugins', 'marketplaces');
  const out = [];
  if (!isDir(market)) return out;
  for (const mk of readdirSync(market)) {
    const pluginsDir = join(market, mk, 'plugins');
    if (!isDir(pluginsDir)) continue;
    for (const p of readdirSync(pluginsDir)) {
      const id = `${p}@${mk}`;
      if (installedIds.has(id)) continue;
      const skills = findSkillFiles(join(pluginsDir, p, 'skills'), 2).map((f) => frontMatter(f).name || basename(join(f, '..')));
      const commands = findCommandFiles(join(pluginsDir, p, 'commands')).map((f) => basename(f, '.md'));
      if (skills.length || commands.length) out.push({ id, skills, commands });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Antigravity locations
// ----------------------------------------------------------------------------
function scanAntigravity() {
  const out = [];
  const gem = join(HOME, '.gemini');
  for (const f of findSkillFiles(join(gem, 'antigravity', 'builtin', 'skills'), 2)) out.push(skillEntry(f, 'antigravity', 'builtin'));
  for (const f of findSkillFiles(join(gem, 'config', 'skills'), 2)) out.push(skillEntry(f, 'antigravity', 'user'));
  for (const f of findSkillFiles(join(gem, 'config', 'plugins'), 4)) out.push(skillEntry(f, 'antigravity', 'user-plugin'));
  for (const f of findSkillFiles(join(ROOT, '.agents', 'skills'), 2)) out.push(skillEntry(f, 'antigravity', 'project'));
  return out;
}

// ----------------------------------------------------------------------------
// Roster cross-check
// ----------------------------------------------------------------------------
function checkRoster(all) {
  const roster = readJson(ROSTER_PATH);
  if (!roster) return { roster: null, rows: [] };
  const names = {
    'claude-code': new Set(all.filter((s) => s.env === 'claude-code').map((s) => s.name.toLowerCase())),
    antigravity: new Set(all.filter((s) => s.env === 'antigravity').map((s) => s.name.toLowerCase())),
  };
  const rows = [];
  for (const [tag, def] of Object.entries(roster.skills ?? {})) {
    if (tag.startsWith('$')) continue;
    for (const env of ['claude-code', 'antigravity']) {
      const entry = def[env];
      if (!entry) continue;
      const slash = /^\/([A-Za-z0-9_-]+)/.exec(entry.invoke || '');
      let status = 'repo/builtin';
      if (slash) {
        const wanted = [slash[1], ...(entry.aka ?? []).map((a) => a.replace(/^\//, ''))].map((s) => s.toLowerCase());
        status = wanted.some((w) => names[env].has(w)) ? 'FOUND' : 'MISSING';
      }
      rows.push({ tag, env, invoke: entry.invoke, status });
    }
  }
  return { roster, rows };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
const claude = scanClaude();
const installedIds = new Set(Object.keys(readJson(join(HOME, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {}));
const market = scanClaudeMarketplace(installedIds);
const ag = scanAntigravity();
const all = [...claude, ...ag];
const { rows } = checkRoster(all);

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const table = (list) =>
  list.length
    ? ['| Kind | Name | Source | Description |', '| :--- | :--- | :--- | :--- |', ...list.map((s) => `| ${s.kind} | \`${s.name}\` | ${s.source} | ${s.description.replace(/\|/g, '/')} |`)].join('\n')
    : '_none found_';

const md = `# SKILLS INVENTORY (generated)
> Generated by \`node scripts/skill-inventory.mjs\` on ${stamp}. Do not hand-edit; rerun on every wake (JOB-18).
> Roster and routing rules: [\`docs/agents/ROSTER.md\`](ROSTER.md) · [\`docs/agents/roster.json\`](roster.json)

## 1. Roster skill tags vs installed skills
| Tag | Environment | Invoke | Status |
| :--- | :--- | :--- | :--- |
${rows.map((r) => `| \`${r.tag}\` | ${r.env} | ${r.invoke.replace(/\|/g, '/')} | ${r.status === 'MISSING' ? '**MISSING**' : r.status} |`).join('\n')}

## 2. Claude Code: installed skills & commands
${table(claude)}

## 3. Claude Code: marketplace plugins available but not installed
${market.length ? market.map((m) => `- \`${m.id}\`: ${[...m.skills.map((s) => `skill \`${s}\``), ...m.commands.map((c) => `\`/${c}\``)].join(', ')}`).join('\n') : '_none_'}

## 4. Antigravity: skills
${table(ag)}
`;

const missing = rows.filter((r) => r.status === 'MISSING');
console.log(`Claude Code: ${claude.length} installed skills/commands · ${market.length} marketplace plugins not installed`);
console.log(`Antigravity: ${ag.length} skills`);
console.log(`Roster tags checked: ${rows.length} · missing: ${missing.length}`);
for (const m of missing) console.log(`  MISSING ${m.tag} (${m.env}): ${m.invoke}`);

if (!process.argv.includes('--check')) {
  writeFileSync(OUT_PATH, md, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}
