# T08a: the honest Planetary Grid screen, dark Settings and Community, the Studio's Audio tab (TICKET-08a)

**Spec:** OPUS_NOTE_13 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket08a/`, 9 files:
- `apps/web/src/shell/planetary-grid.tsx`, `.css` and `.test.ts`;
- `apps/web/src/shell/dark-modal.tsx` and `.css`, and `dark-forms.css`;
- `apps/web/src/studio/audio-tab.tsx`, `.css` and `.test.ts`.

Install them as they are, and list any fix you make.

## The root causes
- **The Grid button:** the main menu's Planetary Grid button only does `setPlaySyncMode('synced'); go('play')` (`shell.tsx:343`, `goblin-front.tsx:79/123`). There's no screen, and no networking anywhere (synced is local: `crafter/shared-planet.ts`, `play/plot-code.ts`, and the visiting flow in `play.tsx`).
- **Light modals:** Community (`shell/community.tsx`) and Settings (`shell/settings-body.tsx`) use the legacy light `studio.css` / `shell.css` look.
- **Dead Studio tabs:** `studio-app.tsx` (about line 438) has Scene, Look and Audio as disabled "Coming next" buttons.

## Do
1. **Install** the 9 files and run their tests.
2. **The Grid screen:** the main menu's Planetary Grid button opens `PlanetaryGridScreen` (a new shell screen route) instead of jumping into play.
   - `myCode`: the player's current plot code (`encodePlot` of the saved plot, or null before they've played).
   - `slot`: their shared-planet slot.
   - `syncMode`: the persisted play sync mode.
   - `recent`: the last 8 visited codes, kept in profile storage (`apps/web/src/storage/`).
   - `onToggleSync`: flips the persisted mode.
   - `onVisit(code)`: enters play in the existing visiting flow with that code.
   - `onSpawn('lab' | 'gate')`: enters play at the lab, or at the moon gate (`scene.gateExit()`; gate spawn is allowed only once the gate has been powered in the saved campaign, otherwise show why).
   - `onBack`: back to the menu.
   - The Expedition button keeps starting desynced play directly.
3. **Dark modals:** wrap Settings and Community in `DarkModal`, and swap their light form classes for `dark-forms.css`. No light `studio.css` look may remain on those two screens. Don't restyle the Studio itself.
4. **The Audio tab:** enable it in `studio-app.tsx` with `AudioTab`.
   - `levels` comes from `public/audio/levels.json`, loaded the way the game's audio loads it.
   - `writable` uses the same dev-endpoint check the Assets workspace uses. In the built game it's read-only.
   - `onChange` writes through the same dev route the Studio uses for registry changes. If there's no such route for audio levels, keep the edits in memory and offer "Copy JSON".
   - Scene and Look stay disabled; that's TICKET-08b.
5. **UI:** load the frontend-design skill (`frontend-design:frontend-design`) before any UI adjustment. Keep Argo's look.

## Verify
- **A new `scripts/test-grid-menus.mjs`:**
  - the Grid button opens the screen, the code copies, an invalid code shows its reason, and a valid code visits;
  - Lab spawn lands in the lab, and Gate spawn lands at the gate exit, facing out;
  - Settings and Community open in the dark modal, and Esc closes them;
  - the Studio's Audio tab lists the sounds and plays one (an AudioContext node starts).
  Save shots of the Grid screen, Settings, Community and the Audio tab, and look at them.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, your new test, `test-build-ux` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/shell/`, `apps/web/src/studio/studio-app.tsx`, the new studio files, `apps/web/src/storage/` (only for the recent codes), and the new test. **Flash is working in `play-scene.ts` and nearby files: don't touch them.** Change `play.tsx` only if the visiting or spawn entry needs a parameter; keep it minimal, and say so in your report.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
