# Sidecar handover: you are the implementer on FIDELITY

You take over from the previous sidecar (Gemini Flash) as the implementing engineer.
- **Opus** (the lead, another session) writes briefs and reviews your work.
- **The owner** decides features.

**Repository:** `C:\MarbleGp`, branch `feat/monster-mash-exploration`.
- Read `CLAUDE.md` first, then this file, then your task brief.

## The board: how we talk
- `docs/SIDECAR_COMMS.md` is the shared board. Read the last few entries before starting.
- Post with a heading in the board's format: `### [YYYY-MM-DD HH:MM] SIDECAR → OPUS: [DONE|PROGRESS|QUESTION] title`. Then short bullets: what you did, the files and commit, the checks you ran with their real results, and the shots.
- Opus replies there with `[REVIEW]` or `[TASK]`. Do the fixes a review asks for, then post again.
- Report what the code actually does. A post that claims more than the code does gets found in review.

## Hard rules
1. **Git: the working tree is shared** with Opus and the owner.
   - Stage and commit only the paths you changed: `git add <paths> && git commit -m "..." -- <paths>`. Then push.
   - Never `git add -A`, `commit -a`, `checkout -- <file>`, `restore`, `stash`, `reset --hard` or `clean`.
   - Never restore, revert or overwrite a file you did not change, even if it looks wrong. Ask on the board.
   - End commit messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
2. **The constitution** (`CLAUDE.md` §1):
   - simulation packages are pure and deterministic (no `Date.now`, no `Math.random`, no I/O);
   - the client builds to one self-contained file;
   - do not add a fifth global metric.
3. **Verify before you post:** `npm run typecheck` (0 errors), `npm test` (green), `npm run build` (succeeds), plus the task's own test.
   - **Shots:** take them with the existing Playwright capture scripts (`scripts/capture-*.mjs`, `scripts/test-*.mjs`), and LOOK at every shot before posting.
   - A shot that is dark, empty or shows the wrong thing does not count. Retake it.
4. **UI:** load the frontend-design skill before any UI work. Match the game's telemetry HUD (glassmorphism, glowing telemetry, Oxanium/Inter). No unstyled DOM.
5. **The owner's asset and art rules:**
   - square sections, and nothing round unless it must be (wheels, tyres, gun barrels);
   - nothing floats;
   - cables only in trays or floor covers;
   - no lettering;
   - no unrequested features or centrepieces.
6. **Loading:** preload behind a visible loading bar. Never start a screen choppy.
7. **The 3D PC:** never touch `scripts/local3d.mjs` jobs, `zips/runworld/` or the asset pipeline. Those are Opus's. You only use the packed assets: `apps/web/src/assets/gen/`, `apps/web/public/hd/`, `apps/web/public/audio/`, `apps/web/public/vo/`.

## Your queue (in order; updated 2026-10-13)
The master plan is `docs/ONE_GAME_PLAN.md` (§2 has the order). In short:
1. **TASK-19 review 2** (the window scene; on the board).
2. **TASK-20 one game** (`20-one-game.md`).
3. **TASK-21 the beam tool** (`21-beam-tool.md`).
4. **TASK-22 the campaign chain** (`22-campaign-chain.md`).
5. **TASK-23 the monsters** (`23-monsters.md`; waits for `@hm/leaksim` and the art).
6. **TASK-24 test everything, fix, report** (`24-campaign-e2e.md`). Opus then pushes main.
7. **TASK-17 Studio shell** (resume the WIP in `zips/studio-wip-2026-10-12/`), then **TASK-18 the asset bench**, then **TASK-25 the Workshop** (bring your own monsters).
8. Then post `[QUESTION] ready for the next task` and stop.

## Context you can rely on
- **Generated assets:** `loadGen` / `getGenSync` / `genLevelFor` in `apps/web/src/assets/gen.ts`, and the patterns in `apps/web/src/assets/gen-props.ts`. `registry.json` lists every packed asset with its size, and its box for lattice pieces.
- **The lab:** `apps/web/src/play/lab-room.ts` (sheet 21). The power sequence is `powerAt`.
- **Narration:** `packages/narrator` (pure) and `apps/web/src/audio/mentor-voice.ts` (the chain). The mentor is Dr. Gwen Haddy; subtitles say "Dr. Haddy".
- **Audio files:** `apps/web/public/audio/`, with `levels.json` (gain and loop region per file). Audition page: `/audio.html`.
- **The dev server** runs on port 5192 (`npm run dev` in `apps/web` if it is not up).
