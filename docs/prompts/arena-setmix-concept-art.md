# Arena art agent: SetMix concept art (rewritten 2026-10-06 evening)

From the approved plan, `docs/SETMIX_PLAN.md` (Phase 2), and the owner's words in `docs/OWNER_ASKS.md`. It replaces the earlier brief, which had a chimney in it. Everything below the line is pasted into the Arena agent (Agent mode, repo `Piskriek/HeavyMetal2`).

Design notes for this brief:
- The memorable things are the free-standing gate and the machines spewing pixels. Everything else is quiet and disciplined.
- The lab is engineered equipment, not glossy sci-fi: the gate is a bolted door frame with cable glands, not a glowing ring.
- The planet is a real, natural place at low resolution, not an abstract palette.

---

You are the concept artist for **SetMix: The Resolution Crafter**. In this game, terraforming a planet raises its graphical resolution.

- A scientist works in a white, high-fidelity lab.
- A gate stands free in the lab. Through it you walk out onto your plot on a desolate planet, which you see at low resolution.
- You build machines on the plot. They run on power and on materials you mine, and while they run they spew colourful pixels into the air.
- Over six stages, the planet's textures, models and light climb from low-res to high-fidelity PBR. Water, a ground cover and finally a lush forest grow in.

Your pictures are the target the game is built towards, so they must be consistent, logical and buildable.

**Repository:** https://github.com/Piskriek/HeavyMetal2. Start from `main`. Your session can only push to its own `arena/<id>-heavymetal2` branch, so commit there. Touch nothing outside `docs/concept/setmix/`.

**Read first:**
- `docs/SETMIX_PLAN.md`, sections 2 and 3. These are the owner's decisions and outrank everything else.
- `docs/SETMIX_GAME_CONCEPT.md`: the premise.
- `arena-gathered/setmix/site/src/data/gdd.ts`: a design document of ideas. The owner has not decided any of it, so don't treat its machine names or its four-colour stage 1 as decisions. Where it disagrees with the plan, the plan wins.

## The owner's rules (do not bend these)

1. **The gate** is a sci-fi door frame **standing upright in the room, joined to no wall**.
   - Its opening is as tall as two goblins stacked: 2.6 m tall and about 1.7 m wide.
   - It stands on a plinth bolted to the floor.
   - Thick cables run from it, along floor covers or trays, to control boxes and power relays.
2. **Machines are believable** ("not floating butplugs please, use reasoning with this stuff"). Before you draw a machine, write down in the README:
   - what it does;
   - what goes in: power, and any material or preset;
   - what comes out;
   - where its power comes from;
   - what holds it up.

   Then draw exactly that:
   - Everything stands on feet, skids, plinths or anchor bolts. Nothing floats.
   - Cables run from a source to the load. They sag between supports and follow trays, conduits or floor covers.
   - Give machines the parts real equipment has: service panels, vents, cable glands, handles, warning stripes and indicator lights.
3. **Machines spew colourful pixels while they run** ("it should feel logical and connected").
   - The pixels are small, crisp squares that pour from a machine's exhaust vents and drift up into the air, thinning as they rise.
   - Their colour says what the machine adds to the world:
     - pink `#ff3d8a`: texture detail;
     - green `#7cff4d`: shape detail;
     - amber `#ffc13d`: light;
     - cyan `#3dc8ff`: water;
     - violet `#b46bff`: presets being mixed.
   - A machine that is off spews nothing.
   - The chain must be readable in every picture: material goes in at a feed or hopper, power arrives by cable, the machine works, and pixels come out. A preset cartridge in a machine's slot changes the pixels it spews.
4. **The window and the gate show different places.** The lab's window looks out on the scientist's own world: a high-fidelity, real, rainy pine-forest mountainside at dusk. The gate shows the SetMix planet. Their contrast is the game's goal: make the planet as real as the view from your window.
5. **The planet is natural at every stage, stage 1 included.** The owner: "the whole idea is so that it looks natural just low rez."
   - Stage 1 is a real, natural desolate place: rock, dust, gravel, scree and cracked flats, several ground materials blended by slope and height. It is drawn at low resolution: low-poly shapes, low-res textures and simple light, like a late-1990s 3D game.
   - Never a flat colour palette, and never one texture over everything.
   - You can see very far.
6. **Models climb the stages, not just textures.** At stage 1, everything on the planet (rocks, machines, the gate's planet end and later the plants) is low poly and flat shaded. Over the stages it all turns high poly and smooth. At stage 6, everything is high-fidelity PBR: textures, models and light.
7. **The coverage layer.** Plant life spreads over the ground like vines: dust, moss, vines, grass and leaves creeping out across the ground as surface detail, not big geometry. Stage 6 is a lush PBR forest.
8. **No chimney, and no tower at the centre of the plot.** The centre of every plot is the planet end of the gate.

## The world, the same in every image

**The goblin (for scale):**
- 1.3 m tall, with green skin, pointed ears and yellow eyes, wearing a leather vest and belt.
- On the planet the goblin is drawn at the stage's resolution: low poly at stage 1.

**The lab:**
- A clean white test-chamber lab: off-white square wall panels with thin dark seams, a dark steel band along the foot of the walls, and a polished concrete floor.
- Cold white strip lights in a dark ceiling, 7 to 8 m up.
- Clean and clinical. Copy no existing game's logos, signage or characters.

**The lab's floor plan** (camera at the front, looking at the back wall):
- The gate stands free in the middle-right of the room, facing the camera, about 3 m in front of the back wall.
- The window, a wide pane about 4 m by 2.5 m, is in the back wall on the left.
- The lab's power source stands in the back-right corner: a capacitor bank on a steel skid. Next to it, against the back wall, are a breaker panel and a row of power relay cabinets.
- Cables run in floor covers from the relays to the gate, and in ceiling trays to the other machines.
- The operator's console stands a little left of the gate, between the camera and the gate, facing it. It has a big main lever and a few control boxes.
- Along the left wall: the preset rack, a wall of physical cartridge slots.
- Centre-left: the planet table, a 2.4 m holotable showing your plot.
- Along the right wall: the preset bench (where presets are made) and the preset combiner (where two or more presets are mixed into a new one; the owner's example is a mud texture combined with terrain shaping to make a road).

**The plot on the planet:**
- About 1 km across.
- At its centre stands **the planet end of the gate**: a twin of the lab's frame on a cast footing pad. This is where you step out.
  - Power from the lab comes through the link to a junction box at its foot, and the player's first machines plug into that junction.
  - The player's machines stand round it.
- The land is natural: rolling ground, old craters, ridges, gullies, boulder fields and dust flats.
- Other players' plots lie a kilometre and more away. From afar they read as patches of greener, wetter, sharper land.
- The goblin planet (green and ochre, with clouds) hangs in the sky.

**The light:**
- A low sun, 20 to 25 degrees up, from the right of the main view.
- The sky is black at stage 1, first glints of colour at stage 2, haze at stage 3, blue by stage 6.

## The images

Make PNGs at 1920x1080 unless noted, in `docs/concept/setmix/`. Scene images have no text in them. Design sheets may carry short, plain-English callouts.

1. `01-lab-first-play.png`: the first time the player enters the lab in Play.
   - Emergency light only. One console is lit; the other machines are dark, some under dust covers.
   - The gate is **off**: a dark frame with cold coils and an empty opening.
   - The cables from the gate run across the floor to the relays.
   - The window shows the rainy forest mountainside at dusk.
   - A goblin stands by the console.
2. `02-gate-power-on.png`: the main lever is thrown.
   - Relays close and their indicator lights come on in a row.
   - Power pulses visibly along the floor cables to the gate.
   - The gate's coils light from bottom to top, and the lab lights dim because the gate draws from everything else.
   - Static in the opening resolves into a picture.
3. `03-gate-on-your-plot.png`: the gate is on, showing **your plot at stage 1** as seen from the planet end of the gate: natural, multi-textured, low-res, desolate, under a black sky.
   - The window beside it shows the rainy forest.
   - Two different places side by side.
4. `04-menu-setmix.png`: the main menu backdrop in the SetMix version.
   - The lab is fully lit, its machines running and spewing their pixels.
   - The left third of the frame stays calm and uncluttered, because the menu goes there.
   - The gate, on the right, shows **a fully realised plot at stage 6**: lush forest, water, machines overgrown with vines.
5. `05-menu-goblin-racing.png`: the same framing in the Goblin Racing version. The gate shows **the goblin planet**: green and ochre with clouds, close and huge in space.
6. `06-sheet-gate.png` (2560x1440): an engineering sheet of the gate.
   - The lab gate in front, side and back views and a three-quarter render.
   - Callouts for:
     - the plinth and its anchor bolts;
     - the side buttresses;
     - the field coils;
     - the emitter channels on the inner faces;
     - the cable junction box at the rear with its glands;
     - the service hatches;
     - the step up.
   - Beside it, its planet twin on the footing pad, with the junction box at its foot, at stage 1 (low poly) and stage 6 (PBR).
   - A goblin silhouette for scale.
7. `07-sheet-lab-power-and-machines.png` (2560x1440): the lab's power chain and machines.
   - The power chain: the capacitor bank on its skid, the breaker panel, the relay cabinets, the control boxes, and the console with its lever. Show the cable trays and floor covers between them.
   - The lab machines as **candidates for the owner to choose from**: the preset bench, the preset combiner, the preset rack, the planet table, and a fabricator for tools and suit parts.
   - For each, show where its power comes in, what holds it up, and the pixels it spews while running.
8. `08-plot-stage-ladder.png` (2560x1440): a 3 by 2 grid with the same camera on your plot at stages 1 to 6. The gate's planet end and a few machines are in view.
   - Stage 1: natural and multi-textured, low poly, low-res textures, simple light, black sky.
   - Stage 2: finer textures, the first sun glint and a thin band of colour at the horizon.
   - Stage 3: shapes smoothing into real hills, normal detail, haze, shadows.
   - Stage 4: water fills the low ground.
   - Stage 5: the coverage layer creeping out from the water and the machines, and the first trees, low poly turning smooth.
   - Stage 6: the lush PBR forest.
   - The rocks, machines and gate change detail with the stages, not just their textures. The machines' pixels can be seen at every stage.
9. `09-sheet-coverage-growth.png` (2560x1440): one 2 m square of ground over six steps.
   - The steps: bare natural ground, dust, moss spreading in vine-like tendrils, grass and clover, leaf litter and ferns, the full forest floor.
   - Below, the last step split into albedo, normal and roughness.
10. `10-plot-stage-6-hero.png`: the target, your plot at stage 6.
    - Golden-hour light from the right, layered canopy, warm sun shafts through the gaps.
    - The gate's planet end and the machines are overgrown at their feet but still running and spewing pixels.
    - A clear lake with reeds at its edge.
    - The goblin planet is a pale daytime moon in a blue sky.
    - No bare ground is left.
11. `11-desolate-horizon.png`: stage 1 seen from beside the gate's planet end.
    - A vast, natural, desolate land drawn low-res, running to a far horizon.
    - Your first machine beside the gate, spewing its first pixels.
    - Far across the plains, other players' plots show as greener, wetter, sharper patches. One friend's plot has a beacon.
    - The goblin planet hangs over it all.
    - It should make a new player want to start.
12. `12-sheet-field-machines.png` (2560x1440): **candidate planet machines for the owner to choose from**, in a lineup with a goblin for scale.
    - At least: a drill that mines raw material; one machine for each colour of pixel (texture detail, shape detail, light, water); a power unit; a power relay pylon.
    - Give them plain working names that say what they do.
    - Top row: each at stage 1 (low poly, flat shaded). Bottom row: the same machines at stage 6 (high-fidelity PBR).
    - Each one shows its footing, its power cable, its material feed, its cartridge slot (where it takes one) and its pixel exhaust running.

## What to hand in

- The 12 PNGs.
- `docs/concept/setmix/contact-sheet.jpg`: all 12, labelled by number.
- `docs/concept/setmix/README.md`. For each image, write:
  - what it is for;
  - **the full prompt you used**;
  - for every machine in it, one line each on what it does, what goes in, what comes out, where its power comes from and what holds it up;
  - an honest self-review: what came out right, what is off, and what you would redo.
- If you cannot see images yourself, say so plainly in the README rather than guessing.
- Keep the world consistent across the images: the same gate, lab layout, goblin, machines and plot.
- Use text-only prompts, and feed in no reference images from elsewhere.

Commit everything to your own branch with a message that lists the 12 files, then reply here with the branch name.

---

## Follow-up 1 (sent 2026-10-07, after reviewing the first 10 images)

The agent ran out of turn time after 7 finished images with nothing committed. My review of what it had made:

Good work so far. I'm reviewing for the owner. Please do these, in this order.

1. **Commit and push now** what you have (the finished PNGs, your scripts' outputs, a first README) to your branch `arena/601f7fc1-heavymetal2`, so nothing is lost. Then commit again after each image or two.

2. **Finish the set:** 06, 07, 08, 09 and 12 (the sheets), then the contact sheet and the README.

3. **Fixes from my review of what you made:**
   - **One gate design everywhere.** The gate changes between images: a slim frame with coil strips, then a chunky frame with ribbed coil blocks, then an octagonal frame. Settle it on sheet 06 first: I prefer the chunky frame with ribbed amber coil blocks on the uprights, angled buttresses and the hazard-striped plinth, as in your power-on image. Then redo 01, 03, 04 and 05 so the gate matches it, and so the gate's planet end in 10 and 11 is its twin.
   - **01 (first Play): the gate is OFF.** Its coils must be dark and cold, with no orange glow. Only the console and the emergency lights are lit.
   - **Cables never lie loose on the floor.** There are no coils or loose runs of cable on the lab floor anywhere: they run inside low steel floor covers (cable ramps) or overhead trays, from the relay cabinets to the gate's rear junction box and to each machine. Loose cable across a lab floor is not believable.
   - **The goblin planet must not look like Earth.** In 05 and 11 it shows Earth-like continents (Africa can be seen). Make it clearly alien: green and ochre land in irregular shapes that match no real continent, with swirling cloud bands. Keep it the same planet in every image.
   - **Menu backdrops 04 and 05: keep the left third calm.** No planet table, hologram, goblin or rack in the left third: plain lit wall panels and floor there, with all the activity (gate, machines, pixels) from the centre to the right. The window can sit centre-left.
   - **One rendering style.** 04 and 05 drifted towards an illustrated look. Keep the lab images photoreal like 01 to 03.
   - **03: the stage-1 planet in the gate** reads as one pale ground. Make it like your 11: natural and multi-textured (sand, rock, gravel, cracked flats, reddish soil), low-res and low poly, black sky.
   - **10 (stage 6 hero): the pixels** pour as rigid straight columns. Make them pour out of each machine's exhaust vents and drift up with the air, spreading and thinning as they rise. Show each machine's feed or hopper, and its power cable going to the relay pylon line.
   - **11 is the best of the set:** natural and low-res, the hopper machine spewing square pink pixels and cabled to the junction at the gate's foot, the neighbours' plots and the friend's beacon. Keep it, fixing only the goblin planet.

4. When the set is complete, reply here with the branch name, the list of files and your self-review.

---

## Follow-up 2 (sent 2026-10-07, after reviewing 01, 03, 04 redone and 06)

Thanks: 01 and 06 are right, and 03 and 04 are much better. Keep going with your list (05, 10, 11, then 07, 08, 09, 12, the contact sheet and the README), committing as you go. Three fixes from my review, to fold in:

1. **The gate's size.** On 06's front view the opening is about two goblins tall: that is the canon (2.6 m). On 03 the goblin stands in the opening and it reads about three goblins tall. Keep the goblin-to-opening ratio of 06's front view in every image.
2. **04's gate is not the canon.** It has slim uprights with no lintel block, no buttresses and no hazard-striped plinth. Redo 04 with the 06 gate, and make sure 05 uses it too.
3. **Loose cables, still.** On 03 the cables leave the rear junction box loose across the floor; on 04 a loose cable runs from the console to the holotable and on to the machines. In the lab, every cable runs inside the steel floor covers or the ceiling trays. On the planet, cables on the ground are fine.

When the set is complete, reply here with the branch name, the list of files and your self-review.

---

## Follow-up 3 (sent 2026-10-07, after reviewing 05, 07, 10 and 11)

05 and 07 are right, and 10 and 11 are much better. Please carry on with 08, 09 and 12, then the contact sheet and the full README, committing as you go. Two more fixes, the first of which matters most for sheet 12:

1. **The exhaust is not the hopper.** On 10 and 11 the pixels rise out of the feed hopper, the same opening the raw material goes into. Material goes in at the hopper; the pixels come out of a separate exhaust vent or stack, on top or at the back, away from the feed. Design every machine on sheet 12 this way, then fix the machines on 10 and 11 to match.
2. **11's gate is not 06's twin.** On 11 the gate's planet end is a lattice tower with one tall coil column. Redraw it as the planet twin shown on 06 (box-section uprights with the ribbed coil blocks, angled buttresses, the plinth on a cast footing pad, the junction box at its foot), low poly at stage 1. Keep everything else on 11: the land, the neighbours' plots and the beacon are exactly right.

When the set is complete, reply here with the branch name, the list of files and your self-review.

---

## Nudges after follow-up 3 (2026-10-07)

The agent stops after 10 images or about 10 minutes a turn; each turn was restarted with "Keep working" and a short queue: the exhaust apart from the hopper on sheet 12, 10 and 11; 11's gate as the 06 twin; 05 back to 04's framing; 10's goblin planet (kept coming out as Earth). Last message, sent with the set otherwise complete:

Great set, and a clear README. Two last fixes, then you are done:
1. 10's goblin planet still shows Africa and Arabia over blue seas, despite the prompt. Stop regenerating it: composite the alien planet disc from 11 into 10 with ImageMagick (cut the disc, pale it and soften its edge for a daytime sky, place it where the current one is).
2. 02 (power-on): the cables run loose across the floor. Put them in the same ribbed steel floor covers as 01 and 03, with slots along the top so the amber power pulses still show through as they travel to the gate.
Commit each, update the contact sheet, then reply with the branch name.

## My review log

# Art review notes (for follow-up 2, sent when the agent's turn ends)

Reviewed at e715d9f3 (01, 03, 04 redone; 06 added):
- 01 RIGHT: gate off (dark coils, wall through the opening), emergency light, floor covers, rainy forest, dust covers.
- 03: planet natural and multi-textured, goblin planet alien: good. BUT the opening reads ~3 goblins tall (goblin in the opening plane); the canon is 2.6 m (two goblins), as on 06's front view. Cables leave the rear junction box loose across the floor: put them in floor covers.
- 04: left third calm: good; pixels on the right. BUT the gate is not the canon (no lintel block, no buttresses, no hazard plinth): redo with the 06 gate. A loose cable runs console -> holotable -> machines: floor covers.
- 06 STRONG: canon gate; front view ~2.2 goblins; twin at S1 and S6 (lab seen through the S6 opening).

Still to see: 05 (redo), 07, 08, 09, 12, 10 and 11 (fixes), contact sheet, README.

Reviewed at 2526bcd3 (05, 10, 11 redone; 07 added):
- 05 RIGHT: canon gate, alien goblin planet, calm left third, pixels mid. Opening still ~2.6 goblins (minor); a cable leaves the plinth along the floor at bottom right (check: cover or loose).
- 07 EXCELLENT: power chain capacitor -> breaker -> relays -> control boxes -> console, tray and conduit; five candidate lab machines with in/out, pixels, support.
- 10 MUCH BETTER: overgrown canon gate, junction -> lattice pylon -> sagging lines to machines; pixels drift and thin. BUT the pixels rise out of the feed hoppers: the exhaust must be a separate vent or stack (material in at the hopper, pixels out of the exhaust).
- 11: goblin planet alien now; land perfect. BUT the gate's planet end is a different design (a lattice tower with one tall coil column), not 06's twin. Same hopper-as-exhaust slip.

Reviewed at 6f8a8d99 (03, 04 redone; 08 added):
- 03 RIGHT now: canon gate, opening ~2.4 goblins, cables in a ribbed floor cover to the relays, natural low-poly planet in the gate.
- 04 RIGHT now: canon gate, forest plot, left third calm, machine power dropped from ceiling trays, pixels from the machine tops.
- 08 STRONG: natural from S1 (multi-textured, low poly, black sky) through colour band, haze, water, coverage + first trees, lush forest; the twin gate and machines climb in detail. Minor: the camera moves a little between panels; pixels still rise from the hoppers (made before follow-up 3).

Reviewed at 9ad658ca (10, 11 redone; 09 added):
- 09 RIGHT: six steps from bare mixed ground, speckles at water and machine feet, vine tendrils, patchy turf, closing cover, full PBR; derived albedo/normal/roughness. Growth starts at water and machines.
- 11 RIGHT: the 06 twin in low poly, the hopper machine with its own exhaust stack, natural land, neighbours and the friend's beacon, alien goblin planet.
- 10: exhaust stacks fixed, canon gate overgrown. BUT the goblin planet looks like Earth again (blue oceans, an Africa-like continent): use the alien green-and-ochre planet of 03, 05 and 11.
Still to come: 05 redo, 12, contact sheet, README.

Reviewed at 9a0a0651 (05 redone):
- 05: goblin at half the opening, alien planet, four plumes in frame: good. BUT the gate moved to the centre (about 34-65% across); the owner's menu has the gate on the right (18:40), and 05 must use 04's framing (gate right of centre, left third calm).

Reviewed at 42fc0421 (05, 10 redone; 12 assembled):
- 05 RIGHT: gate right of centre, left third calm, goblin half the opening, alien planet, four plumes.
- 12 STRONG: eight machines, S1 chunky low poly and S6 weathered PBR; each grounded, fed at a dark feed, pixels from its own stack; the power unit gives steam only; the pylon carries the spans. BUT every S6 caption reads "no pixels - a white pulse bead shows the line load" (the pylon's caption copied to all eight): fix the captions to match the S1 row. Panels small, bottom quarter of the sheet empty: make the panels bigger.
- 10: STILL Earth (Africa and Arabia over blue seas) despite the commit message. The image model keeps drawing Earth for a planet in a day sky: composite the alien planet disc from 11 (paled for daylight) into 10 with ImageMagick instead of regenerating.
