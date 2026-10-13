# TASK-30: rifts in the Breach's language, the stage wave's bright band, the frame-rate check at stages 4 to 6 (Wave C)

After Wave B, and after TASK-23b-2.

**The sources:**
- Argo's `18-monsters-combat.md` (P1-MON-04, which absorbs POL-23);
- `14-lighting.md` (P1-LIGHT-04, P1-LIGHT-05);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, brief 30, which wins where it differs. Monsters keep their own colours (O3); the dormant leak is in Act IV, and live spawns start after F-03 (O4).

**Already done, not here:** TASK-23b-2 (Wave A) carries:
- P0-MON-01 (the overlay, quantisation and slices, `remapStrength` at 0.20);
- P0-MON-02 (the wind-up flash);
- P0-MON-03 (the safe dome);
- P1-MON-05 (era escalation);
- the Act IV dormant leak.

The Studio's `remapStrength` slider is brief 31. Read 23b-2's [DONE] report first and take any open item it lists that belongs here.

## Where it lives
- **The Breach's shader:** the window vista, `apps/web/src/play/lab-vista.ts`. It is a glitch-sliced cyan column, 120 m tall.
- **The stage wave:** already in the post pass, `POST_FRAGMENT` in `apps/web/src/play/portal-shaders.ts` (`uWaveCentre`, `uWaveR`, `uSkyRise`, `uLookIn` and `uLookOut`). The new stage's look shows inside the radius and the old one outside; it sweeps to the horizon and up the sky.
- **The stand-ins (POL-23):** the field nodes you harvest raw pixels and vertices from, today a dodecahedron, torus, icosahedron and cone. TASK-23b-2's leaks sit at wreck sites.

## Build
1. **One glitch-shard language for leaks and field nodes (P1-MON-04, POL-23).** Reuse the Breach's slicing shader at ground scale.
   - **A leak is a 3.5 m vertical shard column,** sliced and sliding sideways, in its archetype's rim colour, with three low-poly rubble fragments orbiting it, on its wreck site. **Sealing** (Extract held on it; the beam shows Seal amber via TASK-21d's hook) takes 3 s: its slices lock back into line and it compresses into an Anomaly Core you pick up. Keep 23b-2's seal rules and drops; this is the look.
   - **A field node is a smaller shard cluster (about 1.2 m)** in the metric colour of what it yields (#ff3d8a pixels, #7cff4d vertices, by the existing node kinds). It shrinks as it is harvested.
   - Both are believable objects grounded on the terrain: square shards, nothing floating apart from the orbiting fragments, which stay within a metre of the column. No lettering.
   - This reading (that POL-23's stand-ins are the field nodes, and they share the leak's language) is Opus's. Argo has been told, and can still object.
2. **The stage wave's band (P1-LIGHT-04).**
   - Keep the wave's inside and outside looks. Add the **6 m leading band**: a glowing wireframe grid over the ground at the front, in the colour of the metric that triggered the stage (#ff3d8a, #7cff4d, #ffc13d, #3dc8ff).
   - Time it to about 450 m in 4.5 s if it is not already.
   - **A machine's first activation** sends a small local wave: 30 m, one second, its metric colour. It only brightens; it does not change the look.
   - All in the existing post pass; no new pass.
3. **Frame rate at stages 4 to 6 on Low (P1-LIGHT-05).**
   - POL-04 was closed on 8 October (TASK-08 held 60 fps at stage 4 on Low on the older planet). **Measure first**, with TASK-24's fps method on the GTX 950M, at stages 4, 5 and 6 with a fight running.
   - If any is under 60 on Low, apply Argo's three steps in this order until it holds:
     1. two ground-noise octaves beyond 80 m;
     2. no shadow-map draws for objects beyond 250 m;
     3. bake the stage sky once on the transition.
   - Report the before and after per step.

## Tests
- **Unit:**
  - the seal's slice-alignment progress (0 to 1 over 3 s, and back if interrupted);
  - the node's shrink against its reserve;
  - the band's position and colour over time;
  - the local wave's radius.
- **Extend `scripts/test-campaign.mjs`** (or `test-planet-monsters.mjs`):
  - seal a leak: the column aligns, a core is collected;
  - harvest a node: it shrinks;
  - push a stage: the band sweeps, with its colour sampled from a frame.
- **Shots:**
  - a leak before, during and after sealing;
  - a field node full and half-harvested;
  - the stage band mid-sweep at stages 1, 3 and 5;
  - a machine's first activation.
  
  Look at every one.
- **The fps table** for stages 4 to 6 on Low, before and after.
- **The usual green set,** with the build size.

## Report
On the board:
- the shots;
- the fps table;
- the results;
- which items TASK-23b-2 left that you took.
