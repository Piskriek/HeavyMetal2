# T03: Argo's machine inspector, E routing, the bench and machine scale (TICKET-03)

**Spec:** OPUS_NOTE_09 (in the Setmix Drive; summarised here).
**Source:** `arena-gathered/argo-ticket03-inspector/`: `apps/web/src/base/machine-inspect.ts`, its `.test.ts`, `apps/web/src/base/ui/machine-inspector.tsx` and `machine-inspector.css`. Argo wrote it against the real types; install it as it is, and list any fix you make.

## The bugs (from the owner's playtest)
- **BB-10:** E on a placed machine jumps straight to the refinery or fabricator window, or for heavies gives only a one-line message. There's no machine inspector. The E handler is in `apps/web/src/play/play.tsx`, about lines 2742–2822.
- **BB-11:** E on a placed bench does nothing. The Drafting Table only opens with K (`base/ui/base-hud.tsx`, about line 108, with its `draftingLock`).
- **BB-09:** the machines are waist-high miniatures (`play/machine-props.ts`, `machineProp`).

## Do
1. **Install** the four files.
2. **Route E:** E on any machine (a hardpoint with a machine, or a plot machine) opens the inspector.
   - Its `onAction('refine')` opens the refinery modal, and `onAction('fabricate')` the fabricator modal, both as today.
   - `'toggle'` switches the machine on or off through the existing world action. Find it; don't invent one.
   - Esc and Tab close it. Free the mouse while it's open, and lock it again on close, the way the other modals do.
3. **The bench:** E on a `bench` piece opens the Drafting Table through the same `draftingLock` as K. When locked, show the same locked toast.
4. **Machine size:** Argo drafted `machineSize(kind)` and the plume colours. Find them with grep for `machineSize` and `PlumeColour` in his files.
   - Scale `machineProp` so each machine reaches its table height.
   - Make `apps/web/src/base/machine-footprints.ts` use the same sizes, so the colliders match what you see.
   - Leave the plume emitters alone: they live in `play-scene.ts`, a later job.
5. **UI:** before adjusting any UI, load the frontend-design skill (Skill tool, `frontend-design:frontend-design`). Argo's panel should already match the HUD; keep changes minimal.

## Verify
- **A new `scripts/test-machine-inspector.mjs`** (boot pattern: `scripts/test-base-building.mjs`). Place a mill and a fabricator through the base API, aim at each and press E, and assert:
  - the inspector shows the right status;
  - its buttons open the refinery and the fabricator;
  - E on the bench opens the Drafting Table;
  - Esc closes everything.
  Save shots of the inspector and of a full-size machine beside the player.
- Run `npm run typecheck` on the laptop. Run everything heavy on the 3D PC through `scripts/test-on-3dpc.sh "<cmd>"`: `npm test`, `npm run build`, your new test, `node scripts/test-base-building.mjs` and `node scripts/test-ticket01-collision.mjs` (the colliders changed).

## Stay inside
- `apps/web/src/base/` (the new files and `machine-footprints.ts`), `apps/web/src/play/machine-props.ts`, and the E handler and modal state in `apps/web/src/play/play.tsx`.
- **Do not touch `play-scene.ts`:** Flash is editing it right now.

## Git
The tree and index are shared with Flash. Run `git diff --cached --stat` first, then `git commit -m "..." -- <your paths>`. Never commit `apps/web/dist/index.html`, and never push.
