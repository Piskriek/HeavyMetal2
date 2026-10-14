# Wave worker: the standing rules for every brief from 25 on (read this first, then your brief)

You are a Haiku worker building one brief in `C:\MarbleGp` (branch `feat/monster-mash-exploration`). FIDELITY is a three.js, React and Vite game that builds to a single HTML file.

The owner tests the results as an objective observer. Opus reviews your report. Argo (the creative lead) wrote the plans your brief cites.

## Read, in order (skim; don't read whole large files)
1. Your brief: `docs/prompts/sidecar/<NN>-*.md`.
2. The plans your brief cites: `docs/argo/plans/`. For briefs 25 to 27, also `docs/argo/notes/ARGO_NOTE_02_briefs_25_26_27_guide.md`.
3. `arena-gathered/argo-relay/TRIAGE.md`. Argo pre-wrote code for most briefs: v1 is in `arena-gathered/argo-relay/`, v2 (strict-fixed but thinner) in `arena-gathered/argo-relay-v2/`. `INDEX.txt` and `docs/argo/plans/32-code-drop-index.md` map his files to briefs.
4. The live code you will change. Find it with Grep. The game shell is `apps/web/src/play/play.tsx` (very large: read only the ranges you need).

## Using Argo's drop
- **Land, review, wire. Never paste blindly.**
  - For each file, take the better of v1 and v2: v2's strict guards and purity fixes, v1's full behaviour.
  - Check it against the live code it plugs into. The drop was written without seeing the repo, so names, numbers and paths can be wrong.
- **On any conflict, the brief wins.** Examples: the gate supplies 12 kW, not 100 kW; the song is 144 BPM.
- **Packages:**
  - A new package needs a `package.json` (`@hm/<name>`) and its tsconfig path. Copy how an existing package such as `packages/plotsim` is set up, including any vite alias.
  - Tests use `node:test` with `node:assert/strict`, and live in `packages/<pkg>/tests/` or beside the app file. If the folder is new, add it to `TEST_FILES` in `scripts/test.mjs`.

## Hard rules (the owner's and the project's)
**Code**
- Simulation packages are pure and deterministic: no `Date.now`, `Math.random` or I/O. Visual code uses a seeded generator, and the credits and music follow `AudioContext.currentTime`.
- Strict TypeScript, including `noUncheckedIndexedAccess`.
- `npm run build` must stay under the 16 MB single-file cap. Big assets go beside the page (`public/`), never inline.

**Performance**
- The minimum spec is a GTX 950M laptop (this PC), which must run smoothly on low settings.
- Where a look costs frame rate, ship it behind the Graphics setting with an Auto choice, rather than dropping it.
- New screens preload behind a visible loading bar; never start choppy.

**Art and look**
- Machines and props are grounded, believable and cabled. Use square or rectangular sections (round only where function needs it).
- Nothing floats, and there is no lettering on art.
- Machines spew colourful pixel plumes only while operating.
- Legal art only.
- The hotbar is spec V3; don't change it unless your brief says so.

**UI**
- For UI work, load the `frontend-design` skill (Skill tool, `frontend-design:frontend-design`) before designing.
- Match the existing HUD vocabulary; no bare browser defaults.

## Git (other workers and Opus share this tree and its index)
- Commit only your own paths: `git commit -m "..." -- <paths>`. Check `git diff --cached --stat` first.
- Never use `git add -A`, `stash`, `reset`, `checkout -- .`, `clean` or `push`.
- Commit in small steps, one feature at a time. End each message with your Co-Authored-By line.

## Machine limits (about 2 GB of RAM free)
- Run one browser test at a time, never two at once.
- Pipe long output through `tail -40`.
- Don't leave dev servers running; the test scripts start and stop their own.

## Verify, in this order
1. `npm run typecheck`: 0 errors.
2. `npm test`: everything passes.
3. `npm run build`: note the size.
4. The browser tests your brief names, plus your new checks. Shots go to `shots-run/` (gitignored).
5. Last: `node scripts/test-campaign.mjs` must still pass 40 of 40, and `node scripts/test-base-building.mjs` must exit 0.

## Report
Append `### [date] SIDECAR → OPUS: [DONE] TASK-<NN>` (or `[DONE, PARTIAL]`) to `docs/SIDECAR_COMMS.md` and commit it. Include:
- what was built, file by file;
- the real verification numbers;
- what you left out and why;
- the drop files used and what you changed in them;
- the commit hashes.

Polish you couldn't do goes to `docs/DEFERRED_POLISH_REGISTRY.md` as the next POL number.

Then reply to Opus in under 150 words: the state, the commits, and the decisions Opus must make.
