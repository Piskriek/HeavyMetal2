# Wiring wave: put the wave-1 and wave-2 art into the game (four agents at once)

All the art exists on **`feat/wave-2-wiring`** (the Goblin Creator code from ART-I1 plus every wave-1 and
wave-2 image, tint masks and depth masks). These tickets replace the last code-drawn and SVG art in the
game with it. Four Codex agents run at the same time, each on its own `arena/…` branch built from
`feat/wave-2-wiring`. The owner's session works on the Goblin Creator side (DNA, compositor, creator) at
the same time, so **nobody here touches `src/game/meta/goblin-*`, `painted-*`, or `src/components/creator/`**.

| Agent | Ticket | Area |
|---|---|---|
| 1 | [WIRE-1](WIRE-1-garage.md) | Ball Garage: painted decals (both packs), backdrop, cradle, decal picker |
| 2 | [WIRE-2](WIRE-2-track-and-effects.md) | Race: road textures, obstacle and barrier sprites, shield, effect sheets |
| 3 | [WIRE-3](WIRE-3-cockpit.md) | Cockpit: painted glass and cracks, painted needles, rope-reel goblin, dashboard trinkets, speed lines |
| 4 | [WIRE-4](WIRE-4-builder-and-ui-icons.md) | Builder shelf icons, the Custom 3D icon, the painted UI gauge |

## Who owns which file
Each ticket lists its **files allowed to change**; the lists do not overlap, so the four branches merge
cleanly. Two shared spots:
- `src/screens/RaceScreen.tsx` preload: WIRE-2 and WIRE-3 each add **one** line calling their own
  `preload…()` function from their own module. Nothing else in that file.
- `src/game/meta/interfaces.ts`: only WIRE-1 edits it (the `DecalTextureId` union).

## Design rules for anything a player sees
The game has one visual language; follow it exactly (the owner rejects anything that looks generic):
- **Menus and dialogs**: the fantasy-dialog frame: stone plate, brass rings, ornate corners
  (`src/frames.css`), **Cinzel** for headings in sentence case (never tracked all-caps labels), **DM Sans**
  for body text, the gold `#d6ad5c` / `#f0c878` and iron-green `#0f1814` palette. Reuse existing classes
  (`fantasy-primary`, `fantasy-secondary`, the garage's `garage.css`) before adding new ones.
- **The builder** keeps its own zinc and amber "Forge" look.
- **One loud thing per screen**, everything around it quiet. No emoji as icons (lucide icons are fine for
  interface controls). No gradient washes, no identical-card grids with soft grey shadows.
- **Player-facing copy only**: plain words, sentence case, no developer notes, ids, ticket numbers or tick counts.
- Respect `prefers-reduced-motion` in every new animation. Keep the sim deterministic: no `Math.random`
  or `Date.now` in `src/game/sim/**`.
- Verify what you build **in a browser at 1366×657 and 1920×1080** and attach screenshots to your report.

## Agent prompt (paste this, then the agent's ticket line)
```
You are a Codex coding agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You implement ONE ticket,
named at the bottom. Three other agents implement other tickets at the same time.

SETUP
  git fetch origin feat/wave-2-wiring:refs/remotes/origin/feat/wave-2-wiring
  (Name the branch: a plain "git fetch origin" may only fetch main.)
  If you can switch branches: git checkout -b <your-branch> origin/feat/wave-2-wiring
  If your session is locked to its own branch (arena/…): stay on it and run
                              git merge --no-edit origin/feat/wave-2-wiring
  docs/tickets/wiring/README.md must now exist; if not, stop and report.
  npm ci   (only if node_modules is missing)
  Read docs/tickets/wiring/README.md (binding: file ownership, design rules) and your ticket.

WORK
  Change only the files your ticket allows. Write the tests it asks for, and add every new test file
  to the list in scripts/check.mjs.
  Commit only when `node scripts/check.mjs` exits 0 (the protect-baseline test may fail in a fresh
  clone that has no backups/props/user_safety_backup/; say so if it does, and nothing else may fail).
  Stage only your own files (never git add -A). Commit messages end with
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>   (keep the owner's trailer convention)
  Push to your branch: git push origin HEAD. Do not merge into main or any shared branch. Do not deploy.
  Never touch backups/ or public/presets/.

REPORT
  End with: the branch and commits, a checklist of the ticket's acceptance items (done / not done and
  why), the check result, and screenshots (or say plainly that you could not take them).

YOUR TICKET:
```
Ticket lines:
- Agent 1: `WIRE-1 — docs/tickets/wiring/WIRE-1-garage.md`
- Agent 2: `WIRE-2 — docs/tickets/wiring/WIRE-2-track-and-effects.md`
- Agent 3: `WIRE-3 — docs/tickets/wiring/WIRE-3-cockpit.md`
- Agent 4: `WIRE-4 — docs/tickets/wiring/WIRE-4-builder-and-ui-icons.md`
