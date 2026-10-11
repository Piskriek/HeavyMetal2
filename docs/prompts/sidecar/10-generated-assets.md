# Sidecar TASK-10: the generated meshes replace the stand-ins (rovers, fabricator, machines, fixtures) (Gemini Flash)

> From Claude Opus, 2026-10-11. The owner chose "Lean file + HD pack". The loader is landed: `apps/web/src/assets/gen.ts`.
> Lattice pieces (TASK-10b), weapon parts (TASK-10c) and the lab (TASK-10d, after its concept sheet) come later.

## What you get
- **Loading:** `loadGen(id, level)` returns a fresh clone. Geometry and materials are shared between clones.
  - The level is `'low' | 'mid' | 'high'`.
  - Low is inlined in the single file. Mid and high come from the HD pack (`hd/<id>/`) beside `index.html`, and fall back to low when the pack is missing.
  - `GEN[id].size` is the real size in metres.
- **Frame:** every model is at real scale, **bottom-centre at the origin**. The front direction is not normalised, so check each one.
- **The assets** (see `apps/web/src/assets/gen/registry.json` as they land):
  - rovers: `scout-body`, `scout-wheel`, `hauler-body`, `hauler-wheel`, `crawler-body`, `crawler-arm`, `vehicle-seat`, `steering-wheel`;
  - the fabricator: `fabricator-frame`, `fabricator-head`;
  - machines: `mill`, `press-frame`, `press-ram`, `projector-mast`, `projector-head`, `watermaker`;
  - fixtures: `bin`, `repeater`, `drafting`, `weapon-bench`, `life-support`.

## Do
1. **Pick the level the way the canon says** ("Terraforming IS graphical fidelity"):
   - stage 1–2 gives `low`, stage 3–4 `mid`, stage 5–6 `high`;
   - cap it by the Graphics setting (`genLevelFor(profile.quality)`), and by whether the HD pack is reachable;
   - swap the level when the plot's stage changes.
   - Preload the models a screen needs behind its loading bar (the hard rule: never start a screen choppy).
2. **Rovers** (replace the `@hm/rovergear` bodies; keep its sockets, colliders and physics frame):
   - Put the body so its wheel arches sit on `@hm/rover`'s hubs. Keep a per-rover `VEHICLE_FIT = { offset, yaw, scaleX? }` table, tuned by eye.
   - The crawler's generated body is 4.57 m wide but the physics track is 2.4 m: use `scaleX` so the track units sit over the contact points.
   - **Wheels:** the generated wheels' axle runs along z (their thinnest axis). Turn them so the axle is along x, then spin them as now.
   - **Seats and steering wheels:** `vehicle-seat` at every `seat` socket (the hauler has two), and `steering-wheel` in front of the driver's seat. The steering wheel turns with steer input.
   - `crawler-arm` sits at the hinge on the front and takes `rotation.x`.
   - **Lamps:** the generated bodies have their lamps painted in. Keep a small emissive disc (the existing `setLamp`) at each lamp, so they still glow while driven.
3. **The fabricator:**
   - `fabricator-frame` stands on the hardpoint ring (origin at the ring's top centre).
   - `fabricator-head` rides the gantry beam and slides in x while printing.
4. **Machines on hardpoints:** `mill`; `press-frame` with two `press-ram` (they stroke up and down while pressing); `projector-mast` with `projector-head` in its yoke (it tilts); and `watermaker`.
   - These models include their own round mounting ring. Seat that ring on the hardpoint's socket so there is one ring, not two, and nothing floats.
   - Keep each machine's pixel plume at its vent.
5. **Fixtures:** `bin`, `repeater`, `drafting`, `weapon-bench`, `life-support` at their placements and turns, inside their footprints (FOOTPRINT in `@hm/structure`).
6. **Rendering:** each generated asset is one mesh and one material, so a placed piece is one draw. Many copies of one asset may share it through the batcher (`source(key)` returning the loaded mesh), as in TASK-08.

## Rules
- Nothing floats: wheels touch the ground, rings sit on sockets, rams stay in their frames.
- Load through `loadGen` only; never fetch `hd/` directly.
- Stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change.

## Done means
- Typecheck shows 0 errors, the tests are green, and `npm run build` succeeds. The bundle grows by about 4.4 MB at most (the low levels).
- The e2e loads every asset above at `low` with no errors, and at `high` when the dev server serves the HD pack.
- Shots in `docs/shots/assets/`:
  - each rover side-on, beside its old stand-in;
  - the fabricator printing;
  - the four machines working on their pads;
  - the fixtures in the shelter;
  - one stage-1 shot and one stage-6 shot of the same outpost (low and high levels).
- Post [DONE].
