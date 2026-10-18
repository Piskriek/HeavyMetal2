# T11a: co-op Phase 2 core (roles, guardrails, rate limit, undo, the server tick, slots, the inspector switch) (TICKET-11, part A)

**Spec:** OPUS_NOTE_18 and Argo's `docs/argo/notes/ARGO_NOTE_11_ticket11_coop_phase2.md`. **Source:** `arena-gathered/argo-ticket11/` (20 files).
- Argo built them on the installed Phase 1 files and the real RUN SDK types, and none of those files has changed since. So copy them, except the files listed under T11b.
- **Opus's staging run:** 24 of 27 pass. The three failures are listed under "Fix while installing".

## This part installs
- `apps/web/src/net/`: `coop-guardrails.ts` (new) and its test, `protocol.ts`, `outpost-client.ts`, `outpost-session.ts`, and their tests;
- `apps/web/src/rooms/`: `OutpostRoom.ts`, `outpost-harness.ts`, and their tests;
- `apps/web/src/base/`: `world.ts` (the switch command, POL-73), `machine-inspect.ts` (POL-77) and its test (POL-74), `plot-height.ts` (POL-111 constants, POL-112 gate pad) and its test;
- `apps/web/src/crafter/shared-planet.ts` (POL-84 slots, POL-85 sync mode);
- `apps/web/src/play/remote-peers.ts` and its test (the avatar controller; T11b wires it into the scene).

## Fix while installing
1. **`machine-inspect.test.ts`** imports `createPlot` (and maybe more) from `@hm/plotsim`, which doesn't export it. Argo's context had no plotsim. Rewrite those lines against plotsim's real exports, and keep his test cases.
   - His file drops about 117 lines of the old test. Check that no existing case is lost: count the `test(` calls before and after, and keep every old case.
2. **`coop-guardrails.test.ts`, the POL-85 case:** it expects 'synced' and reads back 'desynced', most likely because there's no localStorage in Node. Inject the storage (a small get/set interface with a Map in tests) rather than touching a global.
3. **`outpost-client.test.ts`** doesn't parse (line 58, column 105: likely an apostrophe inside a single-quoted string). Fix the quoting.

## Not in this part (T11b, after F-09 and F-15)
- `play-scene.ts` Window B: the avatars, `importBeamField`, the gate pad pose, and no local ticks in a session (ARGO_NOTE_11 §3);
- `play.tsx`, the session wiring (`sendBeamIntent` instead of local ticks);
- `apps/web/src/shell/planetary-grid.tsx`, the roster controls: Flash's F-15 is restyling it.

**Until T11b lands,** a co-op session still sends client ticks, so the room may tick twice. That only affects RUN co-op sessions, never solo play, and T11b fixes it.

## Verify
- **Unit:** all of Argo's suites green in the repo, including the convergence harness: roles, kicks, the rate limit, undo, the 1 Hz server tick, and the room waiting for the host's seed (POL-115).
- **Co-op browser test:** `scripts/test-coop-outpost.mjs` (the RUN-mode dev server, two pages) still passes. Add a check that a Field Observer's build is refused.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, `test-coop-outpost`, `test-machine-inspector`, `test-grid-menus` and `test-campaign` (45 of 45). Report the plain and RUN build sizes.

## Stay inside
The files listed under "This part installs".
- Never touch `play-scene.ts` or `play.tsx`: F-09 has them.
- Never touch `apps/web/src/studio/`, `apps/web/studio-server/` or `planetary-grid.*`: Flash's F-15 has them.
- Never touch the audio files or packages: T09a has them.
- Never register, deploy or publish anything on RUN.
- Use POL-161 to POL-170 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
