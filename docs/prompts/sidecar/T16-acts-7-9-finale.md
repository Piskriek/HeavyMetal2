# T16: Acts VII to IX, the 11-enclave hologram, the finale hand-off, the menu hero and the CRT portrait (TICKET-16)

**Spec:** OPUS_NOTE_22, brief 35 (`docs/prompts/sidecar/35-acts-7-to-9-and-finale.md`), Argo's ARGO_NOTE_04, and `docs/argo/notes/ARGO_NOTE_15_ticket16_voice_and_portrait.md` (the voice lines and the portrait). **Source:** `arena-gathered/argo-ticket16/` (8 files). **Opus's staging run:** the questline suite passes 4 of 4.

**Start only when Opus opens it,** after T14 (landed 306e7dae: `goblin-front.tsx`, `play.tsx`, the credits) and once `play-scene.ts` is free. **The voice files** (`public/vo/A7-01.mp3` to `A9-03.mp3`, plus the two POL-57 barks) **and the portrait** (`public/ui/haddy-portrait.webp`) come from Opus's RUN.world batch. If they're not committed yet when you start, build against their ids, and the narrator test reads them when they land.

## Copy or merge
- **Copy (new):** `packages/questline/src/act789-chain.ts` and its test (`packages/questline/tests/charm-and-act789.test.ts`), `apps/web/src/play/planet-table-hologram.ts`, and `apps/web/src/shell/haddy-crt-portrait.tsx`.
- **Merge by hand:**
  - `packages/questline/src/index.ts` (+2). (`packages/narrator/src/fidelity.ts` is already done: Opus applied Argo's +15 registrations early so `npm test` stays green.)
  - `apps/web/src/base/campaign-chain.ts` (+84: the A7 to A9 rows);
  - `apps/web/src/shell/goblin-front.tsx` (+104 −7): the menu hero (POL-01, POL-64), merged onto T14's version, which adds the Ending Credits entry first.
- **`play-scene.ts` Window E** (ARGO_NOTE_15 and the bundle): the 11 enclave domes on the 4.2 km horizon (A9-01). One labelled section.
- **`play.tsx`:** the Planet Table's E commit (A9-02), then the 12 s golden-hour heal through `evaluateFinaleWindowHeal`, then the epilogue voice (A9-03), then `creditsDirector.start()`; also the CRT portrait in the top-left HUD (POL-40). Use a free HUD zone, and never overlap the stage panel.

## Do
1. **Install** and run the questline tests in the repo.
2. **Acts VII to IX play in order** after B-05 (A7-01 to A9-03), with the combat and peaceful (Aggression off or calm) parity Argo built into the predicates.
3. **POL-70:** the Planet Table hologram shows the 11 enclaves and the 85 % consensus.
4. **The finale hands off into the credits video (T14),** then post-credits freeplay.
5. **POL-57:** the 0 % voice recall and the 12 kW brownout barks are wired.
6. **Gate the credits behind the finale (Opus, 2026-10-18, after the owner questioned an always-visible button):**
   - T14 adds an "Ending Credits" item to the title screen. Hide it until the finale has played: A9-03 sets a saved `endingSeen` flag.
   - Add "Play ending credits" to the Esc debug menu, so the owner and the tests can preview it any time.
   - The lab monitor (as T14 landed it, POL-306): E still opens the Bridge Incident Log (campaign beat 9c), J is the jukebox with both replays, and R plays the Overclocked track. R stays available; J's credits replay waits for `endingSeen`.
   - The test: a fresh save shows no Ending Credits item; after the finale it appears; the debug entry works on a fresh save.
7. **T14's leftovers (Opus's review, 306e7dae; details in the registry):**
   - POL-301: a `PlayScene` hook for the stage-look post pass per credits chapter, so chapter 1 shows the 0a wireframe;
   - POL-302: expose the lab room's `setStorm` and `setMonitorEqualizer` through `PlayScene`, and wire the credits' storm calls and the equaliser;
   - POL-303: `setAltCam` with a target drifts (XYZ read-back, YXZ rebuild); fix it in `play-scene.ts`;
   - POL-304: hide the held weapon's viewmodel while the credits run;
   - POL-305: gate `window.__credits` and `window.__creditsDirector` with the other debug hooks.
8. **POL-38:** commit the voice files' `.mp3.json` metadata where the narrator expects it (or move it out of `public/` as the asset notes say). Follow the repo's existing pattern.

## Verify
- **Extend `scripts/test-campaign.mjs`** with A7-01 to A9-03 through the debug checkpoints. The whole campaign must pass, the old 45 beats plus the new ones, with zero console errors and zero HUD overlaps.
- **A finale check:** the Planet Table commit runs the heal and starts the credits.
- **Shots:** the hologram, the horizon domes, the menu hero and the portrait. Look at every one.
- Report the build size (Argo estimates +16 KB).
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test` and the extended campaign.

## Stay inside
The files above, `play-scene.ts` (Window E only), `play.tsx` (the finale and portrait only), `scripts/test-campaign.mjs`, and the checkpoint files the campaign needs. Use POL-241 to POL-250 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
