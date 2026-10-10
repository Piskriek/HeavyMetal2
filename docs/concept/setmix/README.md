# SetMix: The Resolution Crafter — concept art set (FINAL)

**Branch:** `arena/601f7fc1-heavymetal2` · set complete 2026-10-07.
Canon decisions come from `docs/SETMIX_PLAN.md` sections 2–3 (owner's
decisions outrank everything; `gdd.ts` names are an undecided idea menu).

**Files (deliverables, 14 + contact):**

| # | File | What it is |
|---|------|-----------|
| 01 | `01-lab-first-play.png` | scene — first Play: emergency light, gate dead |
| 02 | `02-gate-power-on.png` | scene — the lever is thrown (power-on beat) |
| 03 | `03-gate-on-your-plot.png` | scene — gate shows your stage-1 plot vs real window |
| 04 | `04-menu-setmix.png` | scene — main menu backdrop, lab running |
| 05 | `05-menu-goblin-racing.png` | scene — menu alt: gate shows the goblin planet |
| 06 | `06-sheet-gate.png` | design sheet — THE gate (canon reference) |
| 07 | `07-sheet-lab-power-and-machines.png` | design sheet — lab power chain + lab machines |
| 08 | `08-plot-stage-ladder.png` | design sheet — stages 1→6, one fixed camera |
| 09 | `09-sheet-coverage-growth.png` | design sheet — coverage growth over 6 steps |
| 10 | `10-plot-stage-6-hero.png` | scene — the finished plot, golden hour |
| 11 | `11-desolate-horizon.png` | scene — day one on the plot |
| 12 | `12-sheet-field-machines.png` | design sheet — 8 candidate field machines, S1/S6 |
| 13 | `13-sheet-base-construction.png` | design sheet — 11 base pieces (foundation, wall, pillar, floor, ramp, airlock, hardpoint, hardpoint + heavy mill, quantum bin, repeater pylon, drafting table), S1/S6 |
| 14 | `14-outpost-stage-3.png` | scene — small sealed outpost at stage 3, one heavy mill on its pad, gate on the far horizon |
| — | `contact-sheet.jpg` | all 14, numbered |

Supporting material (tracked for reproducibility): `panels/12/` — the 16 panel
renders of sheet 12; `tools/` — `compose06/07/08/09/12.sh`, `contact.sh`,
`derive_maps.sh`, `lib.sh`. The `scratch/` dir is git-ignored working space.
Note: the sandbox rolled untracked files back several times; everything
committed is safe, panel sources were moved into git for that reason.

Prompts were text-only (no reference images). Scene images carry no text;
sheets' callouts are typeset in ImageMagick afterwards, never baked in.

**On prompt fidelity:** prompts below are **verbatim** where the session
history preserved them (02, 03-paraphrase avoided — see marks, 05, 09, 10,
11, 12). Sessions rolled back twice mid-work and early freehand prompt notes
were lost; those prompts (01, 03, 04, 06, 07, 08) are marked
†*reconstructed* and are the prompt the images were generated with to the
best recoverable fidelity — the canon blocks in them are exact (they are the
world bible text), only connective phrasing may differ from the literal take.

---

## The world bible (kept identical across all prompts)

**The gate (canon, settled from the owner's pick — the power-on design):**
a heavy *chunky* industrial door frame standing upright on the floor, joined to
no wall: box-section gunmetal-steel uprights as wide rectangular columns under
a wide flat lintel; the opening clearly taller than wide (2.6 m × 1.7 m — "two
goblins stacked") with a rounded inner reveal; tall stacks of **ribbed coil
blocks** (horizontal ribbed slabs, like transformer radiators) covering most of
each upright face — amber when lit, dark gunmetal when cold; angled steel
buttress gussets bracing each upright; a low wide plinth with a
black-and-yellow hazard-striped rim and anchor bolts; a rear steel junction box
with six round cable glands; recessed emitter channels on the inner faces; a
low step-up plate at the threshold; cables leave only inside **low ribbed steel
floor cable covers (cable ramps)** or overhead trays. The planet end is its
weathered twin on a cast concrete footing pad with a junction box at its foot.

**The lab:** off-white square wall panels with thin dark seams; dark steel kick
band; polished concrete floor; dark ceiling ~8 m up with cold-white strip
lights. Floor plan (camera at the front, facing the back wall): window (~4×2.5
m) on the left/centre-left of the back wall showing the **rainy pine-forest
mountainside at dusk**; gate standing free middle-right ~3 m off the back wall;
capacitor bank (six tall cylinders, copper bus bars, on a flat steel skid) +
breaker panel + four relay cabinets in the back-right; floor cable covers from
the relays to the gate plinth; ceiling trays to the other machines; console
(with the big red main lever) slightly left of the gate; preset rack on the
left wall; round 2.4 m holotable centre/centre-left; preset bench + preset
combiner along the right wall.

**The goblin:** 1.3 m, green skin, long pointed ears, yellow eyes, worn brown
leather vest and belt. On the planet it is drawn at the stage's fidelity.
**Scale rule everywhere:** the goblin is exactly half the gate opening's height
— the opening reads as two goblins stacked, never three.

**The goblin planet (same planet in every picture):** clearly alien — irregular
continents of deep green and warm ochre in shapes that match no real-world
landmass, wrapped in swirling white cloud bands; **no blue oceans**.

**Pixel language:** small, crisp, square pixels pour from a running machine's
exhaust vents and drift up, spreading and thinning. **The exhaust is never the
hopper:** raw material goes IN at the feed hopper/tray/scree (dark, inert),
pixels come OUT of a separate exhaust stack or vent grille on top-rear or back
of the machine. Colour = what it adds:
pink `#ff3d8a` texture · green `#7cff4d` shape · amber `#ffc13d` light ·
cyan `#3dc8ff` water · violet `#b46bff` preset mixing. A machine that is off
spews nothing.

**Light:** low sun 20–25° up from frame right. Sky: black at S1 → first colour
band S2 → haze S3 → blue by S6.

## Machine registry (the "before you draw it" answers, globally consistent)

- **Gate (lab end)** — does: holds the link to the plot open. In: high-amp
  feeders in floor covers from the relay cabinets. Out: the doorway (power
  flows through the link to the planet end). Power: capacitor bank → breaker →
  relays. Held by: plinth + anchor bolts + buttresses.
- **Gate (planet end)** — does: far anchor of the link; the plot's power
  source. In: the link. Out: power at the junction box at its foot (first
  machines plug in there). Held by: cast footing pad + anchor bolts.
- **Rock Drill** — does: mines raw material. In: power. Out: raw ore chunks at
  its discharge tray (+ a faint wisp of dim *unsorted* mixed motes at the rear
  stack — open question to owner: the drill's "exhaust" is unrefined, or
  nothing). Power: cable from the relay line. Held by: four spread legs,
  anchor pads.
- **Texture Mill** — does: grinds raw material into texture detail. In: power,
  ore at its top hopper (dark, inert), optional texture preset in its
  cartridge slot. Out: pink `#ff3d8a` pixel plume from its rear exhaust stack.
  Power: cable from the relay line. Held by: four bolted feet.
- **Shape Press** — does: subdivides/stamps ground geometry finer. In: power,
  material side-feed tray. Out: green `#7cff4d` pixels from the rear vent.
  Power: relay line. Held by: anchored press-frame base plate.
- **Light Projector** — does: raises the sky's light level/scatter. In: power,
  optional light preset. Out: amber `#ffc13d` pixels from vents around the
  lamp housing's rim. Power: relay line. Held by: anchored tripod mast.
- **Water Maker** — does: condenses vapour ahead of the water age. In: power,
  moist regolith intake scree, optional water preset. Out: cyan `#3dc8ff`
  pixels from the rear top-cap vent (+ water to a ground pipe later). Power:
  relay line. Held by: cradle frame, four feet.
- **Preset Mixer** — does: combines 2–4 cartridges into one new one. In:
  cartridges in top slots. Out: one combined cartridge at the side output slot
  + violet `#b46bff` pixels from the rear vent while mixing. Held by: four
  bolted feet.
- **Field Generator ("power unit")** — does: makes local power; **spews no
  pixels** (steam only) — output is electricity on its cable sockets. In:
  refined material cells. Power source: itself; feeds the relay line. Held by:
  steel skid on anti-vibration feet.
- **Relay Pylon** — does: carries the power line from the junction box out to
  the machines (sagging spans). No exhaust; a lit pulse bead shows the load.
  Held by: concrete base + anchor bolts, distribution box with glands at foot.
- **Capacitor bank** — lab power reserve. In: mains. Out: bus to the breaker.
  Held by: steel skid with forklift pockets.
- **Breaker panel** — distribution/protection. Wall-mounted off the back wall.
- **Relay cabinets (×4)** — switch the gate's heavy loads on console command;
  indicators light in a row. Floor-standing.
- **Console** — does: gate/machine control. In: control power + signal lines.
  Out: switch commands. Held by: floor-bolted pedestal; the big red lever.
- **Preset bench** — does: authors texture/material presets onto blank
  cartridges. In: power from a ceiling-tray drop + blank cartridges. Out:
  written cartridges + pink pixels while writing. Held by: four legs.
- **Preset combiner** — does: mixes 2–4 preset cartridges into one new one
  (owner's example: mud texture + terrain shaping = a road). In: power +
  slotted cartridges. Out: one combined cartridge + violet pixels while
  mixing. Held by: bolted round plinth.
- **Preset rack** — does: cartridge storage. In: small power feed
  (LEDs/indexer). Out: none; a faint violet shimmer at the indexer while
  cataloguing only. Held by: wall mount + two feet.
- **Planet table (holotable)** — does: shows your plot as an amber hologram.
  In: power via ceiling tray + data. Out: the hologram + sparse amber pixel
  sparkles while projecting. Held by: round pedestal with floor conduits.
- **Fabricator** — does: prints tools and suit parts. In: power from a ceiling
  tray + material cartridges. Out: printed parts + green pixels while
  printing. Held by: four adjustable feet.

---

## 01 · lab-first-play — the first Play

**For:** the game's first frame: the player has just pressed Play; the lab is
on emergency power, the gate is dead. Establishing shot for everything.

**Prompt (†reconstructed — verbatim base lost in a rollback):** 16:9 cinematic
photoreal render, no text/UI/watermark. The lab (world-bible interior) at
night on emergency power: ceiling strips dead except one flickering tube; two
amber rotating beacons; the gate standing **completely OFF** — coil blocks
dark gunmetal and cold, zero orange glow, opening a black void; console alive
with a small status screen and the big red lever down; the goblin leaning on
the console, lit by it; through the window, the rainy pine mountainside at
dusk; relay cabinets dark except one standby LED; everything else in shadow.

**Machines in frame:** gate (off — absorbs nothing, looks inert), console
(standby), relay cabinets (standby), preset rack (dark, left wall), holotable
(off). Power state: nothing flows; the story is "nothing has started".

**Self-review:** mood lands — quiet, cold, one living light source. Coils
correctly read as unlit metal, not "waiting to bloom". Nit: the room's dark
side is *very* dark; a +10% lift would help small-screen legibility. Kept as
is: 02 exists to be the brightness payoff.

---

## 02 · gate-power-on — the lever is thrown

**For:** the owner's key beat — the gate's power-on staged like machinery, not
magic.

**Full prompt used (verbatim, second take; the first was rejected for a
fully-lit ceiling, which broke the "gate drains everything" story). FINAL
(take 5) = this text plus two amendments that landed the cable fix and
restored the staging beats; quoted after the block:**

> Widescreen 16:9 game concept art, cinematic photorealistic render, crisp and
> detailed. No text, no UI, no watermark, no logos. Interior of a clean white
> high-fidelity test-chamber laboratory, camera at the front of the room looking
> toward the back wall, eye height about 1.6 m. The lab: off-white square wall
> panels with thin dark seams, a dark steel kick band along the foot of the
> walls, a polished concrete floor with soft reflections, a dark ceiling about
> 8 m high holding rows of ceiling strip lights.
>
> Layout, camera facing the back wall: on the left of the back wall, a wide
> window about 4 m by 2.5 m, showing outside a photorealistic rainy pine-forest
> mountainside at dusk: dark wet pines, sheets of rain, drifting mist, cold
> blue-grey dusk light. In the middle-right of the room, standing free about
> 3 m in front of the back wall and facing the camera, stands a sci-fi gate: a
> heavy gunmetal-steel door frame standing upright on the floor, joined to no
> wall, opening 2.6 m tall and 1.7 m wide, its uprights braced by angled side
> buttresses, the frame standing on a low steel plinth bolted to the floor with
> visible anchor bolts and a hazard-striped rim; stacks of horizontal copper
> field coils behind dark grilles on the outer faces of both uprights; recessed
> vertical emitter channels along the inner faces; a low step-up plate in front
> of the opening.
>
> THE POWER-ON SEQUENCE frozen mid-action: the goblin at the console has just
> THROWN the big red main lever (lever forward, his hand still on it, body
> braced). Across the back-right wall the four relay cabinets' indicator
> columns light up IN A ROW from the breaker panel toward the gate — first
> cabinet bright, second mid-flare, third catching, fourth just blinking on —
> a visible cascade. Bright electric pulses run along the thick floor cable
> covers from the relays to the gate plinth like light under the rails. On the
> gate itself the copper coil stacks glow BOTTOM-UP — the lowest coil blocks
> hot amber, the middle warming, the top still dark; a sheet of static
> interference resolving in the opening, half noise half clear; stray voltage
> snapping off the plinth rim.
>
> The lab DIMS as the gate drinks the power: ceiling strips dropped to brownout
> levels over the machine half, consoles' screens flaring in compensation, the
> window's dusk suddenly reading brighter by contrast. The goblin (1.3 m,
> green skin, long pointed ears, yellow eyes, worn brown leather vest and
> belt) is half the gate opening's height.

**Machines in frame:** gate (powering on — in: high-amp feeders via floor
covers; out: the opening; amber bottom-up), console (command source, lever
thrown), breaker + 4 relay cabinets (cascade row), capacitor bank (charging),
holotable + bench + rack (idle, dimmed).

**Take-5 amendments (verbatim additions):** (a) "The console's own signal
cables run straight DOWN inside its pedestal into a flush steel floor
grommet beneath it — nothing snakes out of the console onto the floor."
(b) "POWER DELIVERY, very important: the gate's high-amp feeders run from
the relay cabinets to the gate plinth inside RIBBED STEEL FLOOR CABLE
COVERS — low bolted metal ramps lying flat on the polished concrete like
industrial speed bumps, ribbed along their length, each with a long narrow
SLOT along its top face; through the slots, bright AMBER electric pulses
travel visibly along each run from the relay wall to the gate, lighting the
slot rims as they pass like light under rails. ABSOLUTELY NO bare cable lies
anywhere on the lab floor — the only power routing in sight is inside the
slotted metal covers or in the ceiling trays."

**Self-review (final take):** the slotted covers + travelling pulses are the
frame's spine now; bottom-up coils, cascade row, brownout and the static
sheet all landed in the same take as the containment fix. Nits: only one
cover run is prominent (the right-hand feeders; v4 had richer runs but also
loose console cables — containment won over density); the pulse pool at the
plinth's foot suggests arrival rather than showing entry. The owner's cable
rule holds edge to edge.

---

## 03 · gate-on-your-plot — two worlds side by side

**For:** the game's core contrast in one frame: the real rainy forest through
glass vs your brand-new stage-1 plot through the gate.

**Prompt (†reconstructed):** the lab interior (world bible), gate mid-right,
fully powered and calm — coils steady amber. **The opening shows the plot at
stage 1: a natural low-pol
---

## 13 · sheet-base-construction — the base construction kit

**For:** the art direction for freeform base building on the moon plot (Valheim / Dune: Awakening style). Eleven pieces, each drawn twice: stage 1 (chunky low poly, flat-shaded, ~16 colours) and stage 6 (full PBR, weathered, moss and wildflowers). A hazmat scientist (1.8 m) stands in the wall panels for scale. Every piece stands on the ground or on another piece; the heavy terraformer hardpoint is a 2 x 2 pad of slabs (8 x 8 m) with a socket and power and data glands; the heavy texture mill is about twice the height of the field mill on sheet 12, spews only from a rear vent grille, and runs on cables in floor covers.

**Pieces:** 1 heavy foundation (4 x 4 m, ~0.5 m thick, levelling skirt sunk into the regolith, anchor bolts, hazard-striped edge) · 2 structural wall (4 m x 3 m) · 3 pillar (corner post) · 4 floor / roof (4 x 4 m deck on four posts) · 5 ramp (one storey over one cell) · 6 airlock (wall piece with a sealed door, pressure seal, status light, gauge) · 7 hardpoint (empty) · 8 hardpoint + heavy texture mill · 9 quantum storage bin (visible link emitter) · 10 quantum repeater pylon (tower, extends the link range) · 11 drafting table (a primitive and a material swatch on the bench, a blueprint plate between them).

**Prompts:** verbatim per panel in `panels/13/prompts.txt` — the stage-1 wrapper (W1), the stage-6 wrapper (W6), the piece paragraphs, and the revisions (rev 2: foundation skirt, hardpoint-mill pad, pylon as a tower, and the single-image rule). Each panel prompt is the wrapper for its fidelity followed by its piece paragraph.

**Panels:** `panels/13/13-<piece>-s1.png` and `13-<piece>-s6.png` (22 panels). `panels/13/rejected/13-pylon-s1-diptych.png` is kept for the record: a split-screen render that failed review. Composed with `tools/compose13.sh`.

**Review notes:** no chimneys or stacks in any kept panel; pixels leave only from rear vent grilles; every piece is grounded with skirts, plinths or bolts visible; the S6 airlock was regenerated twice (box, then text baked into the surface) and the kept version is a plain blank wall with a door.

---

## 14 · outpost-stage-3 — a small sealed outpost at stage 3

**For:** a small outpost on the plot at stage 3 (real hills, normal detail, haze, soft shadows; see sheet 08). Slabs on uneven ground, two walls, a reinforced airlock with a green status light, one heavy texture mill on its pad pouring pixels from a rear vent, a quantum storage bin with a link emitter, cables in floor covers, and the gate far off on the left horizon. Desolate, not lit like a stage.

**Prompt (verbatim):**

> A realtime 3D GAME ENGINE SCREENSHOT at stage-3 fidelity: real rolling hills, normal-detail textures, soft shadows, a light haze at the horizon, a dark blue-grey sky with a small alien planet visible: irregular continents of deep green and warm ochre in shapes that match no real-world landmass, wrapped in swirling white cloud bands, NO blue oceans. Scene: a small sealed outpost on uneven desert ground, low-resolution natural terrain. A few grey foundation slabs, 4 metres square, sitting on the slope with levelling skirts sunk into the regolith and hazard-striped edges; two 3-metre walls and a reinforced airlock with a sealed door and a green status light; one heavy texture mill on a 2 by 2 pad of slabs, about 4 metres tall, with a top feed hopper of dark ore and a wide rear vent grille pouring a plume of small crisp SQUARE hot-pink pixels (no chimney, no stack, no smoke); a quantum storage bin with a link emitter on its top; thick cables routed in low ribbed steel floor covers from the machines; far off on the left horizon, a chunky steel door frame gate standing free, with ribbed amber coil blocks. Desolate, not lit like a stage: dim low sun from frame right, no spotlights, no glow, no people, no goblins. No text, no UI, no watermark. ONE single image, one camera, not a split-screen.

**Review notes:** the gate, slabs, walls, airlock, bin and mill are all grounded; the pixels leave the rear vent; the sky and planet follow the sheet-08 stage-3 look (dark blue-grey, small planet, no blue oceans). No people or goblins.

---

**Contact sheet:** `tools/contact.sh` now builds 14 numbered tiles on a 4-column grid. It is rebuilt with `bash tools/contact.sh`.
