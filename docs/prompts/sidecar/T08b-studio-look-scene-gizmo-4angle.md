# T08b: the Studio's Look and Scene tabs, the sockets and plumes gizmo, and the 4-angle review (TICKET-08b)

**Spec:** OPUS_NOTE_15 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket08b/`, 10 new files, all under `apps/web/src/studio/`:
- `look-tab.tsx`, `.css` and `.test.ts`;
- `scene-tab.tsx`, `.css` and `.test.ts`;
- `socket-plume-gizmo.ts` and its test;
- `four-angle.ts` and its test.

None of them replaces an existing file. Install them as they are, and list any fix you make.

## Do
1. **Install** the 10 files and run their tests.
2. **Enable Look and Scene** in `studio-app.tsx` (about line 438, where they're disabled "Coming next" buttons).
   - **Look** mounts `LookTab` with the selected asset id.
   - **Scene** mounts `SceneTab`, reusing the existing viewport (`studio-viewport.ts`) and the registry. Its save and load use the same writable check and dev route as Assets: in-memory plus Copy JSON in the built game.
3. **The gizmo toggle:** the Scene tab's toggle turns `socketPlumeGizmo(object, entry)` on for every placed copy, and disposes it when off.
4. **The 4-angle panel:** add `FourAnglePanel` to the Assets workspace's Details (`studio-panels.tsx`) for the selected asset. It refreshes after a redo (`forgetThumb` pattern).
5. **UI:** load the frontend-design skill (`frontend-design:frontend-design`) before any UI adjustment. Keep Argo's look and the Studio's existing vocabulary.

## Verify
- **A new `scripts/test-studio-tabs.mjs`:**
  - Look: the scrubber changes the preview between stages 1 and 6 (the mean pixel colour changes), and the A/B split shows two halves;
  - Scene: placing two copies, saving, reloading and loading restores them;
  - the gizmo shows socket markers on an asset that has sockets;
  - the 4-angle panel shows four images for a machine.
  Save shots of each tab and the panel, and look at them.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new test, `test-grid-menus` (from T08a) and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/studio/` and the new test. Don't touch the play files: Flash owns `play-scene.ts`.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
