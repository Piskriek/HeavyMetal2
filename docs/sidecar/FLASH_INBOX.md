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
- **Run the heavy checks on the 3D PC worker (since 2026-10-17), not on this laptop.** The worker is 24 threads; a browser test takes about 20 s there.
  - `scripts/test-on-3dpc.sh "<command>"` tests your **working tree** as it is. No commit or push is needed: it snapshots your files through a temporary index (the shared index is untouched), sends the snapshot to the worker over SSH, and runs the command there.
  - Examples: `scripts/test-on-3dpc.sh "npm test"`, `scripts/test-on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"`.
  - When another worker (Haiku) is editing in the same tree, add `--only "<your paths>"`. The snapshot is then HEAD plus only your files, so the other worker's half-done edits don't break your run. Example: `scripts/test-on-3dpc.sh --only "packages/groundshader apps/web/src/play/play-scene.ts apps/web/src/play/plot-ground.ts" "npm test"`.
  - Use it for `npm test`, `npm run build` and every browser test. Run only quick checks on the laptop (typecheck, a single unit file).
  - Screenshots stay on the worker. To look at one, copy it back: `scp -i ~/.ssh/id_ed25519_fidelity RAMPAGE@192.168.0.9:/c/MarbleGp/<path> <local path>`.
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

## F-01 [DONE] TICKET-02 item A: the moon's sky and world follow the stage
Opened 2026-10-17: TICKET-01 landed (7d0d9030, 52a02830), so play-scene.ts and play.tsx are free. Note that every moon teleport now lands at scene.gateExit().
Brief: `docs/prompts/sidecar/T02A-stage-world-look.md`.

## F-02 [DONE] TICKET-02 C0: the plot's biome input (terrain, hydro water, keep-outs)
Brief: `docs/prompts/sidecar/T02C0-biome-input.md`. Pure module and unit tests; no browser test.

## F-03 [DONE] TICKET-01 leftovers: windows, doors, roofs, ramps on slopes, and your F-01 clamp
Brief: `docs/prompts/sidecar/T01b-collision-leftovers.md`. Start it only after F-02 is DONE.

## F-04 [DONE] TICKET-02 D: install Argo's @hm/sky and wire it into the moon's sky
Brief: `docs/prompts/sidecar/T02D-sky-install.md`. Bundle in `arena-gathered/argo-ticket02-sky/` (verified by Opus).

## F-05 [DONE] TICKET-02 C: install Argo's @hm/plotbiome
Brief: `docs/prompts/sidecar/T02C-plotbiome-install.md`. Start it only after F-04 is DONE (both touch tsconfig and the lock).

## F-06 [DONE] TICKET-02 F: plotbiome's tufts, bushes and trees in the moon world
Brief: `docs/prompts/sidecar/T02F-biome-scatter.md`. Bake once at stage 6, show by `appear`; Vegetation setting with Auto; at least 30 fps on Low at stage 6.

## F-07 [DONE] TICKET-02 F2: grass at stage 2 and bushes at stage 4 (F-06 follow-up)
Brief: `docs/prompts/sidecar/T02F2-early-stages.md`. Tufts on Low, machines and the gate feed the input, water sources; fps on the laptop, everything else via scripts/test-on-3dpc.sh.

## F-08 [DONE] TICKET-02 B+E: Argo's coverage shader and water surfaces, wired in
Brief: `docs/prompts/sidecar/T02BE-coverage-water.md`. Start it only after F-07 is DONE. In play.tsx touch the loading step only (Haiku is on the E handler).

## F-09 [OPEN] TICKET-02 P: performance pass, stage 6 on Low at 45 fps or more on the laptop
Brief: `docs/prompts/sidecar/T02P-performance-pass.md`. Measure per layer first; expensive looks go behind Graphics settings with Auto, never deleted.
