# AGENT ROSTER // MODULAR ROLES, ENVIRONMENT ADAPTATION & SKILLS
> **Machine-readable source of truth**: [`roster.json`](roster.json) · **Generated skill inventory**: [`SKILLS_INVENTORY.md`](SKILLS_INVENTORY.md) · **Board**: [`../JOB_BOARD.md`](../JOB_BOARD.md)  
> Agent assignment follows the same law as the game: **presets inside presets**. A job names a **Role** (a capability slot). The roster maps that role to whichever model the current environment offers. When models, tools or skills change, edit `roster.json`, not the job cards.

---

## 1. Why roles instead of names
The old board assigned jobs to `ARGO`, `OPUS`, `FLASH`, `HAIKU`. Those names described the right *abilities*, but they tied each job to a model that is not always there. Usage moves between Antigravity and Claude Code, and sometimes the Overseer wakes as Claude Opus 5.5 with no Gemini Argon/Flash to call on. A role keeps the ability and leaves the model open:

| Role | Was | Ability | Task shape |
| :--- | :--- | :--- | :--- |
| `OVERSEER` | (new) | Board, radar, routing, audits, handoff | Whoever woke up and read this |
| `ARCHITECT` | `ARGO` | Creative direction, preset specs, plans, owner-rule review | No spec yet; taste; cross-domain preset design |
| `ENGINEER` | `OPUS` | Deterministic cores, GLSL parity, perf, integration, review | Correctness-critical; cross-package; public API |
| `BUILDER` | `FLASH` | Brief to working code, green tests | Clear brief, 2–12 files, has a Verify command |
| `RUNNER` | `HAIKU` | Mechanical edits, E2E scripts, captures, chores | One or two files, exact acceptance check |
| `RIG` | `3DPC` | Real-GPU captures and long Playwright suites | Needs the RTX 3080 box |
| `OWNER` | | Piskriek: review, unblock, approve rule changes | |

Legacy names still parse (`scripts/agent-worker.mjs` maps them), so old briefs and commits keep working.

---

## 2. Know your environment (first thing on wake)
| You are in | Signs | Spawn with | Ladder |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `CLAUDE.md` auto-loaded; Agent tool; slash skills (`/frontend-design`) | Agent tool, `model: opus \| sonnet \| haiku`, effort level, background | ARCHITECT/ENGINEER = main session (Opus 5.5) · BUILDER = **Sonnet, high effort** · RUNNER = **Haiku, high effort** |
| **Antigravity** | `.agents/GEMINI.md` as a user rule; `invoke_subagent` | `Model: inherit \| pro \| flash \| flash_lite` | ARCHITECT/ENGINEER = main session (Argon *or* Claude, whichever is selected) · BUILDER = `flash` · RUNNER = `flash_lite` |
| **3D PC** | You were started by `scripts/test-on-3dpc.sh` | none | RIG only |

Print the live plan for every open job:
```bash
node scripts/agent-worker.mjs --dispatch --env claude-code    # or antigravity
```

---

## 3. Routing rules (reason less, route well)
1. **Route by task shape, not habit.** No spec yet → ARCHITECT. Correctness, parity, perf, public API → ENGINEER. Clear brief with Verify → BUILDER. One-file mechanical → RUNNER. Real GPU → RIG.
2. **Cheapest rung that can pass Verify.** Escalate one rung (`RUNNER → BUILDER → ENGINEER → ARCHITECT`) after two failed Verify attempts. Never skip the check.
3. **Review one rung up.** BUILDER/RUNNER results go to `[REVIEW]`; ENGINEER or ARCHITECT moves them to `[DONE]` (CLAUDE.md §0: a green prototype is the starting line).
4. **Load skills before reasoning.** A job's `Skills:` tags resolve per environment through `roster.json`. A loaded skill (e.g. `/frontend-design`) replaces reasoning tokens. A missing skill is a radar item, not licence to improvise.
5. **Usage-aware.** When weekly usage is low, push work down one rung and keep the main session for review and integration. Haiku swarms have burned the budget before (OWNER_ASKS, 14 Oct), so run them one or two at a time.
6. **One writer per hot file.** `play-scene.ts` and similar files are serialised by the Overseer.

---

## 4. Skills: tags, not hard-coded commands
Jobs carry tags (`frontend`, `route`, `code-review`, `feature-dev`, `visual-verify`, `e2e`, `perf`, `shader`, `multiplayer`). `roster.json → skills` maps each tag to the invocation per environment, for example:

| Tag | Claude Code | Antigravity |
| :--- | :--- | :--- |
| `frontend` | `/frontend-design` (installed; the owner calls it `/frontend`) | CLAUDE.md §3.2 design guard + `generative_ui` |
| `route` | `/route` (**not found** on this machine on 2026-10-22, see below) | follow `apps/web/src/shell` patterns |
| `code-review` | `/code-review` (in the official marketplace, not installed) | research subagent vs `docs/argo/RULES.md` |
| `visual-verify` | `scripts/kit-compare-sheet.mjs`, `scripts/material-sheet.mjs` | same |

> [!IMPORTANT]
> **Open item for the owner:** `/route` was not found in `~/.claude/plugins`, `~/.claude/skills`, `~/.claude/commands` or the project's `.claude/` on 2026-10-22. If it lives somewhere else (another machine, a claude.ai skill, a different plugin name), say where and the Overseer will add the path to `scripts/skill-inventory.mjs`.

---

## 5. Wake-time research loop (part of JOB-18)
Every time the Overseer wakes, in either environment:
1. `git status -s`, then read `docs/RESUME.md`, `docs/JOB_BOARD.md`, this file.
2. **Identify the environment** and which models can be spawned (see §2).
3. `node scripts/skill-inventory.mjs`: rewrites `SKILLS_INVENTORY.md`, lists installed skills for both environments, marketplace plugins not yet installed, and **MISSING** roster tags.
4. **Research** new models, agent tools and skills (Claude Code plugins/skills, Antigravity skills and subagent tiers, MCP servers). Record findings in `docs/OVERWATCH_TECH_AND_AI_RADAR.md`.
5. **Update `roster.json`** (ladders, effort levels, skill tags) and re-tag job `Role`/`Skills` where a cheaper rung plus a skill now fits.
6. `node scripts/agent-worker.mjs --dispatch --env <env>` and spawn.

---

## 6. Job card format
```markdown
## JOB-21 [OPEN] Title
- **Role:** BUILDER
- **Skills:** `frontend`, `visual-verify`
- **Claimant:** sonnet@claude-code          (written by --claim --by)
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `apps/web/src/lab, packages/cartlab`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
```
