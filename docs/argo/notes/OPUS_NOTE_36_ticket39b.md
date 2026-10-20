# OPUS_NOTE_36: TICKET-39 installed; TICKET-39b, refit the three frames to the real cores (Opus, 2026-10-21)

## Installed
- `argo-ticket39-bundle.json`: all eight files, his 32 kit tests pass against our kitspec and partgen. One fix on install: the palette's `uvBand` pairs needed `as const` (strict tuples).
- **Wired:** `plot-kits.ts` builds the heavy mill, press and water maker through `kitMachineProp` when their generated core has loaded (rank = min(stage, tier)); the press keeps its two working rams, hung at `ramLeft` and `ramRight`. machine-plumes 121/121: every vent, feed and stack stays at its measured socket.
- **The beam on the plot:** part cartridges now fit the plot's kit machines (kit id `plot:<machine id>@<built>`), saved and rebuilt with the stage. The planet Drafting Table's Parts tab prints part cartridges (ruling D.1), straight into the rifle.

## Why the frames ship off (TICKET-39b)
The core bounds in the specs were estimates; the real generated cores differ, so face-mounted parts float or are buried. I measured each core by raycasting it at every 0.25 m of height (faces on +x, -x, +z, -z; `--` = the ray passed through, an open frame):

**mill** (bbox x -2.00..2.00, y 0..4.01, z -2.00..2.00): a +-2.0 m base plinth below y 0.15, then a step to +-1.29 at 0.30, then a body of about +-1.06 to +-1.11 from y 0.55 to 3.05 (the +x side has the stack recess: 0.91 at y 1.05 and 1.80), a waist of +-0.76 at 3.30, and a top lip of +-1.10 at 3.80.
So the front door at z 1.72 hangs 0.6 m in front of the body; the corner columns at +-1.72 stand on the plinth's edge (fine) but the power box at z -1.72, y 0.18 is inside the plinth.

**press-frame** (bbox x -2.00..2.00, y 0..4.00, z -1.92..1.92): a +-2.0 / +-1.92 plinth below 0.15; a bed of +-1.16 (x) by +-0.74 (z) at 0.30 to 0.55; open from 1.05 to 1.30 (the die gap); side cheeks at x +-1.16 by z +-0.46 from 1.55 to 1.80; above 2.05 only the +x cheek (x 1.0 to 1.17); a crown of +-1.16 by +-0.74 at 3.05; a top block of +-0.30 by +-0.83 at 3.30.

**watermaker** (bbox x -3.87..3.86, y 0..3.99, z -3.14..3.14): a skid of x -3.19..3.00, z +-3.14 below 0.30; open at 0.80 to 1.05 (legs); a tank of z about -1.21..1.32 and x about +-3.4 to +-3.8 from 1.80 to 3.30; a top of x -2.49..2.38, z +-0.84 to +-1.07 at 3.55 to 3.80.

**hauler-wheel** (bbox x -0.55..0.55, y 0..1.09, z -0.26..0.26) and **crawler-arm** (bbox x -0.80..0.81, y 0..0.35, z -0.12..0.12): check the hauler and crawler mounts against these too.

**TICKET-39b asks:** refit the mill, press and water maker frames so every part either sits on the real core faces above, on the plinth, or on the frame itself: nothing hanging in the air, nothing buried in the core. Keep the vent, feed and power sockets where they are (they are measured). Keep the columns clear of the core's body (they can stand on the plinth). A unit test per frame that checks each face-mounted part against this table would hold it.

## Two rulings I made (tell me if you disagree)
1. **Like for like:** a part cartridge fits only parts of its own generator. A bolt cartridge fits bolts; a panel fired at a load-bearing column is refused ("That is a can. This cartridge fits panel parts."). Otherwise one shot could turn a column into a panel and leave the crown floating.
2. **Previews drive play (the owner, 2026-10-20):** "where appropriate we want to use previews to stimulate the players creativity, seeing the material preview and imagining what it would look like will trigger them to try it on the model". Every page that edits a preset shows a live view of the exact result, and every choice on it is drawn as a preview and tried on by hover (leave restores, click keeps). The bench's Parts page now does this: a turntable of the printed mesh, part thumbnails, materials as lit balls, hover try-on. Please design the Studio's layouts with this rule (plan 39, pattern item 7).

## Two questions on the palette (4d)
- The trim sheet's bands (the hazard stripe in hull-steel, the copper strip and the status channel in accent-hardware) need a banded texture plus UVs mapped into the bands; our parts have 1 m box UVs, so today each material draws its base colour only. Do you want (a) a small banded texture and a band per slot in the kit specs, or (b) the hazard, copper and status as their own materials (two to three more draw calls per machine)?
- The planet scene has no environment map, so true metals draw black there. Plot kits cap metalness at 0.35 for now. Would you rather we add a small environment map to the planet (one more texture, it lifts every metal) or keep the cap?
