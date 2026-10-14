# TASK-23c: the packed props in the world (lab clutter, wreck sites, the window view)

After TASK-23b. The registry (`apps/web/src/assets/gen/registry.json`) holds 114 generated models. 38 of them are new props that nothing places yet:
- 10 lab clutter props: crate-large, crate-small, cardboard-stack, filing-cabinet, server-rack, locker, toolbox, coolant-can, sample-case, old-monitor;
- 28 from batch 2, with option ids such as `barrier-block-a`. The list is in the last two RESUME log entries.

The earlier plan (RESUME §5, item 1): lab clutter you can clear to free floor for a machine, which yields salvage.

## Build
1. **Lab clutter.**
   - Place the lab props (and the lab-scale batch-2 ones: tool cabinet, specimen freezer, gas cabinet, closed shelving, workbench) in the lab's corners and along its walls. Follow sheet 21's layout (`apps/web/src/play/lab-room.ts`): never on the power-wall path, the gate approach or the window.
   - Hold E on a piece to clear it (a short dissolve). It yields salvage items into the inventory: a few primitives and ore, scaled to its size. It frees that floor for good (saved per profile).
   - Load behind the lab's loading step (`loadGen`, at the tier's level). Instance repeats.
2. **Wreck sites on the plot.** Each TASK-23b leak sits at a wreck site: a cluster of 2 to 4 wasteland props (wrecked van or truck cab, crushed container, barrier blocks, a ruin), placed on the ground with their bases snapped to it.
   - Sealing a leak restores its props one fidelity rung (the junk-model ladder).
   - A few sites without leaks are scenery, never within 30 m of the gate pad.
3. **The window view.** Swap or add the batch-2 wasteland pieces into the vista: comms mast, silo, pump house, substation, cooling tower, warehouse, datacentre annex, office ruin, billboard, sign gantry. Use the low level and stay in the vista budget (40 calls, 120k triangles), instanced.
4. **The weapon-bench set** (owner 2026-10-13: "you need to model individual tools, the bench and the tools cant be one object"). Opus packs `weapon-bench` (now generated empty), `bench-jig`, `bench-printer`, `tool-wall`, `tool-drill`, `tool-wrench`, `tool-mallet`, `tool-scanner` and `tool-screwdriver` as separate models.
   - Place the jig at the centre of the bench top and the printer at one end of it.
   - The tool wall goes flat on the wall behind the bench, with the tools hung in its slots (each tool its own object, a little proud of the panel); the mallet and the wrench lie on the bench top.
   - Every item rests on its surface: no gaps, nothing floating. Check with a shot from three sides.
   - The weapon bench's E interaction still works (the bench piece itself).
5. **Budgets:** the lab within the frame budget on Low; report draw calls before and after.

## Tests
- **Unit:** the clutter-clear bookkeeping (the salvage yield, saved once, never twice).
- **Extend `scripts/test-campaign.mjs`:** clear one lab prop; salvage arrives; reload; the prop stays gone.
- **Shots:** the lab with its clutter, a wreck site at stage 1 and 6, and the window view. No overlays, each looked at.
- **The usual green set.**

## Report
On the board: the placements, the draw calls, the results and the shots.

## Additions from Argo's master plan (owner-approved 13 October)
- **P0-LORE-01, micro-logs:**
  - **Which props:** `old-monitor`, `server-rack`, `filing-cabinet`, `sample-case`, plus 4 lunar wreck transponders at the wreck sites.
  - **On hover:** a 2-sentence forensic readout.
  - **On salvage (E):** a "Bridge Incident Log" entry in a small databank panel (HUD style, frontend-design skill), with a short CRT data-chirp.
  - Text lives in the UI, never on the models (rule 12). Use Argo's examples as the tone ("BRIDGE TELEMETRY [T-00:04:12]: ...").
  - **The texts are written** (Argo, 14 October): `docs/argo/plans/22-lore-micrologs.md` §2 has all eight hover readouts and Bridge Incident Logs (LOG-01 to LOG-08). Use them as written. Readouts 1, 3, 6 and 7 start with a stray space: trim it and capitalise the first word ("Phosphor burn-in…", "Dented steel drawers…").
  - **The four transponders use packed props,** half-buried or tipped at their wreck sites, never floating; no new art is needed:
    - 01, the survey beacon: `battery-pack-a`;
    - 02, the telemetry box: `terminal-old-a`;
    - 03, the cargo skid's power box: `control-box`;
    - 04, the optical transceiver: `radar-panel-b`.
  - **Argo's file names `filing-cabinet` and `sample-case` as salvageable** (they dissolve and unlock their log on salvage), and `old-monitor` and one `server-rack` as permanent fixtures, as the owner decided.
- **Owner decision:** `old-monitor` and one `server-rack` stay as permanent, re-readable fixtures. Every other clutter prop dissolves into salvage.
