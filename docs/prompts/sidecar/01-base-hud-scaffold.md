# Sidecar TASK-01 — Live channel + base HUD scaffold (Gemini Flash)

> From: Claude Opus, 2026-10-10. Plan: [`docs/BASE_BUILDING_ARCHITECTURE.md`](../../BASE_BUILDING_ARCHITECTURE.md). Contract: [`apps/web/src/base/view.ts`](../../../apps/web/src/base/view.ts).
> Standing order: work through this task top to bottom without waiting for a go-ahead. Post on the board only when DONE, BLOCKED, or a decision is needed.

## Step 0 — open the live channel (do this first, keep it running all session)

We share one working tree (`C:\MarbleGp`, branch `feat/monster-mash-exploration`). Start the watcher in a terminal you keep open:

```bash
node scripts/sidecar-watch.mjs --me flash
```

It prints a line when I post on the board, commit, push, or when the tree switches branch. When it prints `BOARD OPUS -> FLASH ...`, read that entry in `docs/SIDECAR_COMMS.md` section 6 and act on it. Then post your first entry (format in section 5 of the board):

`### [YYYY-MM-DD HH:MM] FLASH → OPUS: [FYI] Watcher running, starting TASK-01`

Shared-tree rules (section 5 of the board): never `checkout`/`switch` branches, `stash`, `reset --hard`, `clean`, `add -A` or `commit -a`. Stage only your own paths. Every commit ends with the trailer line `Agent: Gemini-Flash`. Commit, then push.

## Step 1 — the base HUD on a mock view

Build the windows the base-building milestone needs, drawing ONLY from the `BaseView` contract and acting ONLY through `BaseActions` (`apps/web/src/base/view.ts`; do not change that file: ask on the board). The real simulation (Arena packages + my glue) plugs in later behind the same interface.

Files you own for this task (create them):
- `apps/web/src/base/mock-view.ts` — a `BaseViewSource` with believable data: ore (bulk), raw Pxd in 3 hues, raw Vtx, 4 texture maps (Regolith Basalt, Polished Obsidian, Reflective Quartz, Luminescent Moss), 4 primitives (Structural Cube, Cylinder Column, Chamfered Beam, Chassis Frame), 3 blueprints, the Extraction Beam (tool, in the `beam` equipment slot) and the combat shotgun (weapon, hotbar). Implement the actions locally with real stacking rules (merge same item up to `stack`, swap otherwise, half-split on right-drag, weight limit), and two networks (one holding the lab bridge, one out of range) for the lattice window.
- `apps/web/src/base/ui/hotbar.tsx` — always visible on the planet: 9 slots bottom centre, keys 1–9 select, counts and item tint, the selected slot clearly lit. Check whether the mouse wheel is already bound in play before adding wheel cycling.
- `apps/web/src/base/ui/inventory-window.tsx` — Tab (and I) toggles it (D8: E stays interact; `preventDefault` on Tab so the browser does not move focus). 9 x 4 grid with row 0 marked as the hotbar, equipment column (visor, shield, rebreather, beam, sidearm), weight bar, drag and drop between any slots, tooltips with name, kind, count, weight.
- `apps/web/src/base/ui/drafting-window.tsx` — pick a primitive and a map, preview the blueprint: its piece kind, "reach" bars for `vKeep` / `hKeep`, weight, cost list showing have / need per item; the Draft button is disabled while short and says what is missing.
- `apps/web/src/base/ui/lattice-window.tsx` — the linked storage networks: boxes and relays per network, totals grid, a "you are here" badge on `here`, a clear out-of-range state.
- `apps/web/src/base/ui/build-readout.tsx` — under the reticle while building: OK or the refusal in plain words (occupied → "Something is already there", ground → "Ground in the way", steep → "Too steep for a foundation", overlap → "Overlaps another structure", needs-floor → "Needs a floor under it", needs-pad → "Needs a 2 x 2 pad of grounded foundations", unsupported → "Not enough support") and a support meter coloured blue (1.0) → green → yellow → red (under 0.2).
- `apps/web/src/base/base.css` — use the tokens in `docs/UI_DESIGN_SYSTEM_AND_TOKENS.md` (glass panels, Oxanium / Outfit / Inter, hairline borders, glow on the active element). Load your frontend design skill before writing any window. No browser-default controls anywhere. Each window opens and closes with a short animation and a click sound through the existing sound module.
- `scripts/test-base-building.mjs` — Playwright, like `scripts/test-planet-monstermash.mjs`: reach the planet, press 1–9 and check the selected slot, press Tab and see the inventory, drag a stack onto another of the same item and check the merge, open the drafting window with a debug key or URL flag and check the disabled Draft button when short, screenshot each window into `docs/shots/base/`.

Mounting: add the minimum lines to `apps/web/src/play/play.tsx` to mount the hotbar on the planet and the windows on their keys, behind `?base` for now (no change for players who do not pass it). Free the mouse while a window is open, like the existing panels do. Tell me on the board which lines you added.

## Step 2 — the ghost API in the play scene (small)

In `apps/web/src/play/play-scene.ts` add, next to `setBuilding`, a generic ghost the glue can drive: `setPieceGhost(group: THREE.Group | null)`, `placePieceGhost(pose: { x: number; y: number; z: number; yaw: number } | null, tint: 'grounded' | 'ok' | 'weak' | 'bad')`, and `aimPoint(): { x: number; y: number; z: number; yaw: number } | null` (where the reticle meets the ground or a piece, and the camera's yaw). Keep `setBuilding` working for the existing machines. Plain stand-in boxes for pieces are fine in a `apps/web/src/base/stand-in-pieces.ts` (label them stand-ins: the real meshes come from an Arena battle after the concept art is approved).

## Done means

`npm run typecheck` clean, `node scripts/test-base-building.mjs` green, the existing `scripts/test-fidelity-sync-studio.mjs` and `scripts/test-planet-monstermash.mjs` still green, screenshots committed. Then post `[DONE]` on the board with the commit sha, the test output, and anything you skipped and why. Visual rough spots you could not finish go into `docs/DEFERRED_POLISH_REGISTRY.md`.

## Do not touch

`packages/structure`, `packages/lattice`, `packages/substrate`, `packages/plotsim`, `apps/web/src/base/world.ts`, `apps/web/src/base/view.ts`, `docs/BASE_BUILDING_ARCHITECTURE.md`, `docs/prompts/**` (mine). Do not build the simulation rules into the mock beyond what a believable demo needs: the rules come from the packages.
