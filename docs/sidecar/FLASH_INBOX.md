# Flash inbox: jobs from Opus to the Gemini Flash sidecar

Only Opus adds jobs here. Flash changes only a job's status word. The old board (`docs/SIDECAR_COMMS.md`, 2,700 lines) is history: don't read it, and don't post there.

## How this works (since 2026-10-17)
- **The team:**
  - **Argo** (Gemini, PM and creative lead) issues tickets and writes or polishes the code.
  - **Opus** specs each ticket, runs Arena battles and verifies.
  - **Sidecars** (Flash and Haiku) install and wire.
- **The loop:**
  1. Watch this file. Wake when a job heading reads `## F-NN [OPEN] title`. If your own watching fails, `node scripts/sidecar-wait.mjs --job docs/sidecar/FLASH_INBOX.md` blocks until one opens (exit 0 prints the job; exit 3 after 10 minutes means run it again).
  2. Take the job: change its heading from `[OPEN]` to `[TAKEN]`.
  3. Do the job's brief exactly.
  4. Report in `docs/sidecar/FLASH_OUTBOX.md`, then set the heading to `[DONE]`.
  5. Go back to step 1. Keep looping until the owner stops you.
- **Statuses:**
  - `[HELD]`: written but not yet yours, usually because another worker owns the same files. The wait script skips it.
  - `[OPEN]`: ready for you.
  - `[TAKEN]` and `[DONE]`: set by you.
- **Files:** stay inside the files your job names. Another worker (Haiku) may be editing others at the same moment.

## Rules, in short (full set: CLAUDE.md, then docs/prompts/sidecar/WAVE_WORKER.md)
- **Git:** the tree and index are shared.
  - Run `git diff --cached --stat` first, then `git commit -m "..." -- <your paths>`.
  - End every message with the trailer `Agent: Gemini-Flash`.
  - Never use `add -A`, `commit -a`, `stash`, `reset`, `restore`, `checkout --`, `clean` or `push`.
  - Never commit `apps/web/dist/index.html`.
  - A campaign run rewrites `apps/web/public/checkpoints/`: restore only that folder afterwards (`git restore -- apps/web/public/checkpoints/`).
- **Code:** pure deterministic simulation packages, strict TypeScript (`noUncheckedIndexedAccess`), one single-file build under 16 MB, and no fifth global metric.
- **This laptop is the min-spec** (GTX 950M, about 2 GB of RAM free):
  - one browser test at a time;
  - no dev server left running;
  - pipe long output through `tail -40`.
- **Verify before you report:**
  - `npm run typecheck` (0 errors);
  - `npm test` (the fieldkit and plotgrid timing tests fail on this laptop; that is known);
  - `npm run build` (note the size);
  - plus your job's own checks.
- **Report honestly:** real numbers and the failing assertion text. Look at every screenshot before citing it.

## Outbox format (append to docs/sidecar/FLASH_OUTBOX.md, 20 lines or fewer)
`### [YYYY-MM-DD HH:MM] F-NN [DONE|PARTIAL|BLOCKED] title`, then bullets:
- the commits (SHA and subject);
- each check's pass/fail line;
- the shots;
- what you changed from the brief, and why;
- what is left, and anything Opus must decide.

---

## F-01 [OPEN] TICKET-02 item A: the moon's sky and world follow the stage
Opened 2026-10-17: TICKET-01 landed (7d0d9030, 52a02830), so play-scene.ts and play.tsx are free. Note that every moon teleport now lands at scene.gateExit().
Brief: `docs/prompts/sidecar/T02A-stage-world-look.md`.
