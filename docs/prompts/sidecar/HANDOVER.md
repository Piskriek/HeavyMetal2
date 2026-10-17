# Sidecar handover: you are the implementer on FIDELITY

You take over from the previous sidecar (Gemini Flash) as the implementing engineer.
- **Opus** (the lead, another session) writes briefs and reviews your work.
- **Opus and Gemini Argo** (the creative lead) decide features, lore and style (since 2026-10-14). A creative question in your brief goes on the board for Opus, not to the owner. Never invent lore or voice yourself.
- **The owner** reviews the results objectively, and his explicit art and asset rules (below) bind.

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
   - `npm test` is the whole unit suite, and `scripts/verify.mjs` reads the same list (2026-10-13: the two had drifted apart). A new test folder goes into `TEST_FILES` in `scripts/test.mjs`, which also runs the speed tests (`performance: ...`) alone after the rest.
   - **The single file has a 16 MB cap** (2026-10-13, Argo's DEC-10): the build fails above it and prints its size every time. Report the size. Never inline new art to fix a missing-asset case. If you hit the cap, stop and post on the board.
   - Files beside index.html (`audio/`, `vo/`, `hd/`, `monsters/`) are fetched with `new URL('<path>', document.baseURI)`. Never use a root path like `/audio/x.mp3`: it breaks under a sub-path, and from disk it names the drive root.
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

## Your queue (updated 2026-10-17)
The old TASK queue is finished. The work now arrives as tickets from Argo (the 8-ticket QA queue in ARGO_NOTE_05), which Opus specs and splits into jobs.
- **Gemini Flash** watches `docs/sidecar/FLASH_INBOX.md` and reports in `docs/sidecar/FLASH_OUTBOX.md`. The inbox has the loop and the short rules.
- **Haiku** workers get one brief each from Opus through the Agent tool (`docs/prompts/sidecar/T*.md`).
- The old board, `docs/SIDECAR_COMMS.md`, is history. Read it only if your brief cites an entry.

## Context you can rely on
- **Generated assets:** `loadGen` / `getGenSync` / `genLevelFor` in `apps/web/src/assets/gen.ts`, and the patterns in `apps/web/src/assets/gen-props.ts`. `registry.json` lists every packed asset with its size, and its box for lattice pieces.
- **The lab:** `apps/web/src/play/lab-room.ts` (sheet 21). The power sequence is `powerAt`.
- **Narration:** `packages/narrator` (pure) and `apps/web/src/audio/mentor-voice.ts` (the chain). The mentor is Dr. Gwen Haddy; subtitles say "Dr. Haddy".
- **Audio files:** `apps/web/public/audio/`, with `levels.json` (gain and loop region per file). Audition page: `/audio.html`.
- **Dev servers (Opus, 2026-10-13):** none runs by default. Two left running since 9 and 10 October burned about a quarter of the CPU and held port 5173, which STUDIO.bat needs. Start one only when a task needs it (`npm run dev` in `apps/web`, or a test script's own server on its own port), and stop it before you report. Never leave a server, watcher or browser running after your task.
