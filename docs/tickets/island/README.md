# Basalt Isle, wave 1: art references, island terrain, kit wiring (four agents at once)

The plan is [docs/ISLAND_PLAN.md](../../ISLAND_PLAN.md): read §1, §4 and §5 before anything else. Everything
lands on **`feat/meshy-kit`** (the wiring branch plus the Meshy kit: `public/models/kit/*.glb` in three tiers,
`src/game/models/glb.ts`, `scripts/meshy.mjs`, `scripts/optimize-glb.mjs`). The owner's session works on the
route graph (ROUTE-1) at the same time: **nobody here touches `src/game/sim/**`, `src/game/engine.ts`,
`src/game/track-space.ts`, `src/game/lane-network.ts` or `src/game/courses.ts`**. Nobody calls the Meshy API
(it is billed; the owner's session runs it).

| Agent | Ticket | Work |
|---|---|---|
| 1 | [ISLAND-ART](ISLAND-ART.md) | 14 reference images for the island set, in the kit sheet's style |
| 4 | [ISLAND-ART-B](ISLAND-ART-B.md) | 16 reference images: palms, rocks, secret spots, ball armour |
| 2 | [ISLAND-TERRAIN](ISLAND-TERRAIN.md) | the island's body: heightfield, beaches, lagoons, water, materials |
| 3 | [KIT-WIRE](KIT-WIRE.md) | the Meshy kit in the builder and the race: GLB props, low tier, collision tier |

## Rules for everyone
- Same design rules as [../wiring/README.md](../wiring/README.md) ("Design rules for anything a player sees").
- Keep the sim deterministic; the island is presentation plus collision patches, which are already deterministic.
- Verify in a browser at 1366×657 and 1920×1080 and attach screenshots. If your browser has no WebGL, say so
  plainly and verify what you can another way (the owner's session re-checks 3D work).
- Commit only when `node scripts/check.mjs` exits 0 (protect-baseline may fail in a fresh clone; say so).
  Stage only your own files. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Push to your own branch. Never merge into main or a shared branch. Never touch `backups/` or `public/presets/`.

## Agent prompt (paste this, then the ticket line)
```
You are a Codex agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You do ONE ticket, named at the
bottom. Three other agents do other tickets at the same time.

SETUP
  git fetch origin feat/meshy-kit:refs/remotes/origin/feat/meshy-kit
  (Name the branch: a plain "git fetch origin" may only fetch main.)
  If you can switch branches: git checkout -b <your-branch> origin/feat/meshy-kit
  If your session is locked to its own branch (arena/…): stay on it and run
                              git merge --no-edit origin/feat/meshy-kit
  docs/tickets/island/README.md must now exist; if not, stop and report.
  npm ci   (only if node_modules is missing)
  Read docs/ISLAND_PLAN.md, docs/tickets/island/README.md (binding) and your ticket.

WORK
  Do your ticket. Change only the files it allows. Add every new test file to scripts/check.mjs.
  Commit when `node scripts/check.mjs` exits 0 (protect-baseline may fail in a fresh clone; say so).
  Stage only your own files. Push: git push origin HEAD. Do not merge, do not deploy.

REPORT
  Branch and commits, the acceptance checklist (done / not done and why), the check result, screenshots
  (or say plainly you could not take them).

YOUR TICKET:
```
