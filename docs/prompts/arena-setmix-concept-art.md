# Arena art agent: SetMix concept art (the lab, the gate, the stages, the machines)

Owner, 2026-10-06 20:30 (OWNER_ASKS): concept art to work towards. The brief comes from the game's own design: `docs/SETMIX_GAME_CONCEPT.md` and the winning design document `arena-gathered/setmix/site/src/data/gdd.ts` (LAB_MACHINES, FIELD_MACHINES, RESOURCES, PLAY_ARC). Copy everything below the line into the Arena Codex agent.

---

You are the concept artist for **SetMix: The Resolution Crafter**, a game where terraforming a planet raises its graphical fidelity. A scientist works in a white high-fidelity lab. A freestanding gate in the lab opens onto a desolate, low-poly moon. Machines on the moon raise four metrics (Pixel Density, Vertex detail, Light, Water), and the world climbs six stages, from a 1990s flat-shaded moon to a lush PBR forest.

Repository: https://github.com/Piskriek/HeavyMetal2. Start from `main`. Your session can only push to its own `arena/<id>-heavymetal2` branch: commit there, and touch nothing outside `docs/concept/setmix/`.

**Read these first. They are the source of truth for what every machine is and does:**
- `docs/SETMIX_GAME_CONCEPT.md`: the premise, the lab, the gate, Play mode against Studio mode.
- `arena-gathered/setmix/site/src/data/gdd.ts`: `LAB_MACHINES` (Material Synthesizer, Fusion Matrix, Hardware Fabricator, Planet Table, Cartridge Archive), `FIELD_MACHINES` (Pixel Chimney, Harmonic Mesh Vibrator, Lumen Mast, Clathrate Sublimator, Template Injector spire, Coherence Beacon, Compute Reactor, Relay Pylon), `RESOURCES`, and `PLAY_ARC` (Act I "Cold Boot": "One flickering bench, one console. The Portal is the only thing drawing full power, and it is drawing it from everything else.").
- `docs/OWNER_ASKS.md`, the entry at 2026-10-06 20:30: the owner's own words on the gate, the lab and the stages.

## The owner's rules (do not bend these)

1. **The gate** is a sci-fi door frame **standing upright in the room, not built into any wall**.
   - The opening is as tall as two goblins stacked: 2.6 m tall and about 1.7 m wide.
   - Thick cables run from it across the floor to control boxes and power relays.
2. **Believable machines, never abstract shapes.** Before you draw a machine, write down in the README what it does, where its power comes from, and how it is held up. Then draw that.
   - Everything stands on the floor: plinths, feet, steel skids, anchor bolts. Nothing floats.
   - Cables run from a source (relay cabinet, breaker panel, reactor) to a load (gate, console, machine). They sag between supports and are routed along floor covers, trays or conduits.
   - Machines have service panels, vents, cable glands, warning stripes, handles and indicator lights.
   - The owner's words: "make the machines believable, not floating butt plugs please, use reasoning with this stuff."
3. **A window and a doorway show different places.** The lab has an observation window onto the real outside: the desolate moon, black sky and stars. The gate shows somewhere else.
4. **The stages change the models as well as the textures.**
   - At stage 1, everything on the planet is low poly and flat shaded, with crisp pixel textures (a 1990s look).
   - Over the stages it all turns high poly and smooth.
   - At the last stage everything is high-fidelity PBR: textures, models and lighting.
5. **Flora grows into the ground as a coverage layer**: dust, moss, vines, grass, leaves. It spreads over the stages like vines, as surface detail rather than big geometry. The last stage is a lush PBR forest.

## The world, kept the same in every image

- **The goblin (for scale):** 1.3 m tall, green skin, pointed ears, yellow eyes, a leather vest and belt. In the lab the scientist is a person; on the moon the player is this goblin.
- **The lab:** a clean white test-chamber lab with off-white square wall panels and thin dark seams, a dark steel band along the foot of the walls, a polished concrete tile floor, cold white strip lights in a dark ceiling, and 7 to 8 m ceilings. It is inspired by clean sci-fi labs. Do not copy any existing game's logos, signage or characters.
- **The lab's floor plan** (camera at the front, looking at the back wall):
  - The gate stands free in the middle-right of the room, facing the camera.
  - The observation window is in the back wall, on the left.
  - Power relay cabinets and a breaker panel stand against the back wall, on the right.
  - The operator's console (with a big main lever) stands between the camera and the gate, a little left of the gate, facing it.
  - The Planet Table (a 2.4 m holotable) is centre-left.
  - The Cartridge Archive (a wall of slots) runs along the left wall.
  - The Fusion Matrix and the Material Synthesizer stand along the right wall.
  - The Hardware Fabricator bay is in the back-right corner.
- **Your plot on the moon:**
  - A round plot about 110 m across, holding a crater about 52 m across with a central peak.
  - On the peak stands the **Pixel Chimney**: a 9 m white tower on a plinth that breathes coloured pixel motes.
  - Boulders lie about, and from stage 4 a lake fills the crater.
  - The plains run to a far horizon. Other players' finished plots show there as green patches under glowing air bubbles, with beacons.
  - The goblin planet (green and ochre, with clouds) hangs in the sky.
- **The light:** a low sun (about 20 to 25 degrees) from the right of the main view. The sky is black at stage 1 and blue by stage 6.

## The images

Make PNGs at 1920x1080 unless noted, saved in `docs/concept/setmix/`. Scene images have no text in them. Design sheets may carry short plain-English callouts.

1. `01-lab-cold-boot.png`: Play mode, the first visit (Act I).
   - The lab runs on emergency light. One bench and one console are lit; the other machines are dark, some under dust covers.
   - The gate is **off**: a dark, empty frame with cold coils.
   - The cables from the gate run across the floor to the relay cabinets. The window shows the black-sky moon outside.
   - A goblin stands by the console for scale.
2. `02-gate-power-on.png`: the moment the main lever is thrown.
   - Relays close and their indicator lights come on in a row. Power pulses visibly along the cables to the gate.
   - The gate's field coils light from bottom to top. The lab lights dim, because the gate draws from everything else.
   - The surface in the gate is forming: static resolving into a picture.
3. `03-gate-on-your-plot.png`: the gate on, showing **your plot at stage 1** (low poly, four tones, black sky).
   - The window beside it shows the moon's real outside from the lab.
   - Two different places, side by side.
4. `04-home-setmix.png`: the main menu's backdrop in the SetMix version.
   - The lab is fully lit (Act III).
   - The left third of the frame stays calm and uncluttered, because a menu goes there.
   - The gate on the right shows **a fully realised plot at stage 6**: lush forest, the lake, the chimney overgrown.
5. `05-home-goblin-racing.png`: the same framing in the Goblin Racing version. The gate shows **the goblin planet**: green and ochre, with clouds, close and huge in space.
6. `06-sheet-gate.png` (2560x1440): an engineering design sheet of the gate.
   - Front, side and back views, and a three-quarter render.
   - Callouts for: the base plinth bolted to the floor, side buttresses, field coils, emitter channels on the inner faces, the cable junction box at the rear with its glands, service hatches, and the step up.
   - A goblin silhouette for scale.
7. `07-sheet-lab-equipment.png` (2560x1440): a design sheet of the lab's power and machines.
   - The power relay cabinet, the breaker panel, and the operator console with its main lever.
   - Cable trays and floor cable covers, and the lab's power source (a Compute Reactor or a capacitor bank on a steel skid).
   - Simple, grounded versions of the Material Synthesizer, the Fusion Matrix, the Planet Table and the Hardware Fabricator.
   - Each machine shows where its power comes in and what holds it up.
8. `08-plot-stage-ladder.png` (2560x1440): a 3 by 2 grid of the same camera on your plot, stages 1 to 6.
   - Stage 1: flat-shaded, a four-tone palette, nearest-neighbour pixel textures, black sky.
   - Stage 2: dithered colour, a glint in the sky.
   - Stage 3: blocks bevelling into smooth hills, a haze.
   - Stage 4: water fills the crater.
   - Stage 5: the coverage layer creeping out from the water and the chimney, and the first trees, from low poly to smooth.
   - Stage 6: the lush PBR forest.
   - The rocks, trees and chimney change detail with the stages, not just the textures.
9. `09-plot-stage-6-hero.png`: the target, your plot at stage 6.
   - Golden-hour light from the right, layered canopy, and warm sun shafts through the gaps.
   - The Pixel Chimney's foot is overgrown with vines. The crater lake is clear, with reeds and lily pads at its edge.
   - Moon striders (gold, long-legged grazers) are in a clearing; violet sky mantas glide high.
   - The goblin planet is a pale daytime moon in a blue sky.
   - No bare ground is left.
10. `10-sheet-coverage-growth.png` (2560x1440): one 2 m square of ground over six steps.
    - The steps: bare regolith, dust, moss spreading in vine-like tendrils, grass and clover, leaf litter and ferns, then the full forest floor.
    - Below them, the last step split into albedo, normal and roughness.
11. `11-desolate-horizon.png`: stage 1 seen from your plot.
    - A vast, desolate 1990s-looking moon, with the chimney's plume.
    - Far across the plains, other players' finished plots: green under glowing air bubbles, beacons on their chimneys.
    - The goblin planet hangs over it all. It should make a new player want to start.
12. `12-sheet-field-machines.png` (2560x1440): the planet's machines in a lineup with a goblin for scale.
    - The machines: the Pixel Chimney, the Harmonic Mesh Vibrator, the Lumen Mast, the Clathrate Sublimator, the 24 m Template Injector spire with its three cartridge slots, the Coherence Beacon, the Compute Reactor and the Relay Pylon.
    - The top row shows them at stage 1 (low poly, flat shaded). The bottom row shows the same machines at stage 6 (high-fidelity PBR).
    - Each has its foundation or anchors, and its cable or pipe connections.

## What to hand in

- The 12 PNGs.
- `docs/concept/setmix/contact-sheet.jpg`: all 12, labelled by number.
- `docs/concept/setmix/README.md`. For each image:
  - what it is for;
  - **the full prompt you used**;
  - for every machine in it, one line each on what it does, where its power comes from and what holds it up;
  - an honest self-review: what came out right, what is off, and what you would redo.

  If you cannot see images yourself, say so plainly in the README rather than guessing.
- Keep the world consistent across images: the same gate, lab layout, goblin, chimney and plot. Use text-only prompts; do not feed in reference images from elsewhere.

Commit everything to your own branch with a message that lists the 12 files.
