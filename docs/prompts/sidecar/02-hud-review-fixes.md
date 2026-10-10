# Sidecar TASK-02 — Review fixes on the base HUD (Gemini Flash)

> From: Claude Opus, 2026-10-10, reviewing `a89bab0a` against `docs/shots/base/*.png`. Good base: layout, tokens and mounting are right. These items stop it from reading as finished. Same files as TASK-01; same rules.

## Correctness

1. **Two counts disagree in the Drafting Table.** The primitive list shows `x0` for Structural Cube while the cost table shows `60 / 1` have / need. Show one number everywhere: what the network in range holds (`LatticeView.here`), and say "out of range" when `here` is null.
2. **Weights are not believable.** A "Structural Cube (4m)" at 2 kg and a foundation blueprint at 2.5 kg make the 120 kg cargo bar meaningless. Drop the metre sizes from primitive names (a primitive is a geometry template, not a 4 m block in your backpack) and put every item on one scale against the 120 kg cap: raw substrate about 0.2–0.5 kg a unit, maps about 1 kg, primitives about 4–12 kg, blueprints 0 kg (data), ore 1 kg.
3. **`aimPoint()` only hits the ground.** Walls, pillars and upper floors snap onto pieces, so the aim must hit placed pieces first. Raycast a `pieces` group before the ground and return `{ x, y, z, yaw, normal: { x, y, z }, piece: number | null }` (piece id from `userData.pieceId`). Add `setPieces(group)` so the glue hands you that group.

## Look (load your frontend design skill first)

4. **No emoji as icons** (🎒 📐 ⚙️ in the window titles and buttons). Use `lucide-react`, which the Studio already uses.
5. **Items are flat coloured squares.** Give each `ItemKind` its own glyph, drawn in CSS or canvas, tinted by `item.tint`:
   - raw-pxd: a small dithered pixel cluster
   - raw-vtx: a wireframe triangle with vertex dots
   - map: a swatch with a tiny procedural pattern in its albedo colours
   - primitive: the shape's silhouette (cube, cylinder, beam, frame)
   - blueprint: a cyan grid sheet
   - bulk, tool, weapon, equip: a lucide icon
   Then the hotbar reads at a glance.
6. **Quick Stack is a near-white button** in a dark UI. Make it the dark glass secondary style with a cyan hairline, like the ESC buttons.
7. **The Rebreather equipment slot draws a thin bar** instead of its icon square. Fix the empty or narrow item render.
8. **The Drafting Table subtitle runs into the ESC button.** Let the header wrap, or truncate the subtitle with an ellipsis, at 1280 x 720 and at 1024 wide.
9. **The build ghost is opaque solid colour** (`NoBlending`). Make it a hologram:
   - shader: additive, `depthWrite: false`, a fresnel rim, faint scanlines in world space, and a slow pulse (about 1.2 s)
   - colour: still the grounded / ok / weak / bad tint, and in colour at every stage, like the machine ghost
   - cost: cheap enough for the Low preset

## Done means

The screenshots are re-taken in `docs/shots/base/`, `scripts/test-base-building.mjs` also checks the `aimPoint` piece hit and the one-count rule, typecheck is clean and all three e2e suites are green. Post `[DONE]` with the sha.
