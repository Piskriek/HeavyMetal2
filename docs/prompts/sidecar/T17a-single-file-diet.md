# T17a: the single-file diet (vista and unused models to the HD pack), plus small co-op and CSS fixes (TICKET-17, part a)

**Spec:** Argo's `docs/argo/notes/ARGO_NOTE_18_next_batch_ticket17_onward.md` (TICKET-17), corrected by Opus's measurements below. **Why:** the single file is 15.14 MiB of the 16 MiB cap (about 15.26 MiB once the turret lands). Every later ticket needs room.

## Opus's measurements (18 October, at 16032e39)
- **The 130 inline models are base64 in `dist/index.html`,** so each costs about 4/3 of its size on disk. Together they're 6.5 MB on disk, about 8.7 MB of the file.
- **Vista-only (13 models, 654 KB on disk):** chiller-block, comms-mast-solid-a, cooling-tower-square-b, datacentre-annex-b, datacentre-hall, office-block-ruin-b, overpass-segment, pump-house-a, pylon-tower, shipping-container, silo-square-a, substation-block-a and warehouse-small-b. They're referenced only from the lab's window vista code.
- **No literal reference outside `thumb-map.ts` (12 models, 561 KB):** life-support, checkpoint-booth-a, conveyor-housing-b, gantry-crane-solid-a, boulder-block-b, sign-gantry-b, water-tank-square-a, fuel-tank-square-b, lab-bunker-a, road-section-a, billboard-blank-b and portable-office-b.
  - **Check each one for dynamic references before moving it:** a name built from a pattern (`-a`/`-b` variants), the vista kit, `NEIGHBOUR_MODELS` in `wreck-sites.ts`, the Studio's scene tab listing the registry, or the life-support piece. Keep any you find in use inline.
- **Already done, so skip:** Argo's "quantise the inline lows" (`runworld-post.mjs` already quantises and meshopt-compresses every level), POL-87 and POL-93 (F-15), and the co-op roster and badge fixes (T14).

## Do
1. **A size report tool:** `scripts/size-report.mjs` lists every inline data URL in `apps/web/dist/index.html` with its base64 size and the asset id, then the code that references each id (excluding `thumb-map.ts`), and the totals. Run it before and after, and put both summaries in the report.
2. **An inline flag.**
   - `docs/runworld/assets.json` gets `"inline": false` on the models you move.
   - `scripts/runworld-pack.mjs` then writes their low level to `apps/web/public/hd/<id>/low.glb` beside the mid and high, not to `apps/web/src/assets/gen/`, and `registry.json` records `"inline": false`.
   - Move the existing files with `git mv` (they're LFS). Don't re-run the pack over every asset: never run it without explicit ids.
3. **Loading (`apps/web/src/assets/gen.ts`).**
   - A non-inline id loads its low from `hd/<id>/low.glb` on demand: async and cached, the way the HD mid and high load.
   - `getGenSync` returns null until it has loaded.
   - The lab's `preloadLabGenerated` (`lab-room.ts`) fetches the vista lows behind the existing "Fitting the lab" loading bar (the owner's rule: preload behind a visible bar, never start a screen choppy).
   - If a fetch fails (a `file://` open of the single file with no HD pack), the window shows its existing Static view, with no page error.
4. **The Studio and the thumbnails** still list the moved models and can show them when the HD pack is there.
5. **Small fixes:**
   - POL-83: scope the bare `.play` rule in `play.css` to the play screen's root.
   - POL-71: the legacy "Waking the goblin" and "animals" loader labels in `crafter.tsx` and `lab.tsx`.
   - POL-115: in `OutpostRoom`, hold non-owner commands until `version > 0`.
   - POL-117: pass the join username into `rosterOf`.
   - POL-282, the presses' half (Argo's ARGO_NOTE_17): the press and heavy press pours get a small downward settle in `machinePlumeGravity` (`machine-props.ts`). Everything else stays as it is.

## Verify
- **Size:** the build goes from about 15.14 MiB to 14.0 MiB or less. Report the exact bytes and the size report's before and after.
- **The lab, with the HD pack:** the window vista still shows every moved model in the Full view. Use the lab test (`scripts/test-lab-overhaul.mjs`) and a window shot; look at it.
- **The lab, without the HD pack:** serve the build with `public/hd` hidden. The window falls back to the Static view, with zero page errors, and the loading bar doesn't stall.
- **The rest:**
  - `npm test`;
  - `node scripts/test-campaign.mjs`, unchanged (45 of 45; Flash is editing that file, so don't touch it);
  - `scripts/test-machine-plumes.mjs` (with a check for the presses' fall);
  - `scripts/test-coop-outpost.mjs` (with checks for POL-115 and POL-117);
  - `scripts/test-studio-tabs.mjs`.
- **Runs:** `npm run typecheck` on the laptop; the rest through `scripts/test-on-3dpc.sh --worker-only --only "<your paths>"`.

## Stay inside
- `scripts/size-report.mjs` (new), `scripts/runworld-pack.mjs`, `docs/runworld/assets.json`, `apps/web/src/assets/gen.ts`, `apps/web/src/assets/gen/` (moving files out), `apps/web/src/assets/gen/registry.json` and `apps/web/public/hd/`;
- `apps/web/src/play/lab-room.ts` and `lab-vista.ts` (loading only);
- `apps/web/src/play/play.css`, `apps/web/src/crafter/crafter.tsx` and `apps/web/src/lab/lab.tsx` (the labels only);
- `apps/web/src/rooms/OutpostRoom.ts`, `apps/web/src/net/outpost-session.ts` and `machine-props.ts` (the presses' gravity only);
- the tests named above, except `test-campaign.mjs`.

Flash owns `packages/questline/`, `campaign-chain.ts`, `goblin-front.tsx`, `shell.tsx`, `haddy-crt-portrait.tsx`, `play.tsx`, `apps/web/src/credits/` and `scripts/test-campaign.mjs` (F-23). A Haiku owns `packages/plotsim/`, `packages/structure/`, `packages/cartlab/`, `turret-view.ts`, `window-c-hooks.ts`, `play-scene.ts`, `catalog.ts`, `world.ts`, `weapons.ts`, `gen-props.ts` and `scripts/test-ticket13.mjs` (T13a). Never touch those. Use POL-311 to POL-320 for new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
