# SetMix: The Resolution Crafter — concept art set (WORK IN PROGRESS)

Target art for the game, painted to `docs/prompts/arena-setmix-concept-art.md`
(rewritten 2026-10-06 evening) from `docs/SETMIX_PLAN.md` sections 2–3.
Everything lives in `docs/concept/setmix/`. Nothing outside it was touched.

**Can I see the images myself? Yes.** I review every picture with my own eyes
before accepting it, and I write what is genuinely right or wrong below. No
guessing.

**Prompts:** text-only. No reference images were fed into the generator from
anywhere. Output frames are standardised to 1920×1080 (sheets 2560×1440) with
ImageMagick; sheet callouts and labels are typeset by hand, not hallucinated by
the image model. Sheet 09's normal and roughness maps are **derived** from the
finished albedo (Sobel gradients / luminance remap), stated plainly on the
sheet.

**Swap rule for this draft state:** images marked 🔁 are queued for redo under
the owner's review notes (see the fix list at the bottom). Their final sections
(prompt + self-review) are written when the final take lands. Prompts quoted
for 🔁 images are the ones that made the *current* file.

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

**The goblin planet (same planet in every picture):** clearly alien — irregular
continents of deep green and warm ochre in shapes that match no real-world
landmass, wrapped in swirling white cloud bands; **no blue oceans**.

**Pixel language:** small, crisp, square pixels pour from a running machine's
exhaust vents and drift up, spreading and thinning; colour = what it adds:
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
  its discharge tray (+ a faint wisp of dim *unsorted* mixed motes at the
  crusher — flag for owner: the drill's "exhaust" is unrefined, or nothing).
  Power: cable from the relay line. Held by: four spread legs, anchor pads.
- **Texture Mill** — does: grinds raw material into texture detail. In: power,
  ore at its top hopper, optional texture preset in its cartridge slot. Out:
  pink `#ff3d8a` pixel plume from its exhaust vents. Power: cable from the
  relay line. Held by: four bolted feet.
- **Shape Press** — does: subdivides/stamps ground geometry finer. In: power,
  material side-feed, optional shape preset. Out: green `#7cff4d` pixels.
  Power: relay line. Held by: anchored press-frame base plate.
- **Light Projector** — does: raises the sky's light level/scatter. In: power,
  optional light preset. Out: amber `#ffc13d` pixels from vents around the lamp
  head. Power: relay line. Held by: anchored tripod mast.
- **Water Maker** — does: condenses vapour ahead of the water age. In: power,
  moist regolith intake, optional water preset. Out: cyan `#3dc8ff` pixels (+
  water to a ground pipe later). Power: relay line. Held by: cradle frame, four
  feet.
- **Field Generator** — does: makes local power; **spews no pixels** (steam
  only) — output is electricity on its cable sockets. In: refined material
  cells. Power source: itself; feeds the relay line. Held by: steel skid on
  anti-vibration feet.
- **Relay Pylon** — does: carries the power line from the junction box out to
  the machines (sagging spans). No exhaust; a lit pulse shows the load. Held
  by: concrete base + anchor bolts.
- **Capacitor bank** — lab power reserve. In: mains. Out: bus to the breaker.
  Held by: steel skid with forklift pockets.
- **Breaker panel** — distribution/protection. Wall-mounted off the back wall.
- **Relay cabinets (×4)** — switch the gate's heavy loads on console command;
  indicators light in a row. Floor-standing.
- **Console** — does: gate/machine control. In: control power + signal lines.
  Out: switch commands. Held by: floor-bolted pedestal.
- **Preset bench** — does: authors texture/material presets onto blank
  cartridges. In: power from a ceiling-tray drop + blank cartridges. Out:
  written cartridges + pink pixels while writing. Held by: four legs.
- **Preset combiner** — does: mixes 2–4 preset cartridges into one new one (the
  owner's example: mud texture + terrain shaping = a road). In: power + slotted
  cartridges. Out: one combined cartridge + violet pixels while mixing. Held
  by: bolted round plinth.
- **Preset rack** — does: cartridge storage. In: small power feed
  (LEDs/indexer). Out: none; a faint violet shimmer at the indexer while
  cataloguing only. Held by: wall mount + two feet.
- **Planet table** — does: shows your plot as an amber hologram. In: power via
  ceiling tray + data. Out: the hologram + sparse amber pixel sparkles while
  projecting. Held by: round pedestal with floor conduits.
- **Fabricator** — does: prints tools and suit parts. In: power from a ceiling
  tray + material cartridges. Out: printed parts + green pixels while printing.
  Held by: four adjustable feet.

---

## Deliverables

| # | File | Status |
|---|---|---|
| 01 | `01-lab-first-play.png` | 🔁 redo queued: gate→canon chunky design, coils dark/cold, cables in floor covers |
| 02 | `02-gate-power-on.png` | ✅ final (owner picked this gate design) |
| 03 | `03-gate-on-your-plot.png` | 🔁 redo queued: canon gate; plot view multi-textured like 11; alien planet |
| 04 | `04-menu-setmix.png` | 🔁 redo queued: photoreal style; left third calm; canon gate; covers-only cables |
| 05 | `05-menu-goblin-racing.png` | 🔁 redo queued: photoreal; left third calm; alien planet (no Earth continents) |
| 06 | `06-sheet-gate.png` | 🚧 painting: settles the canon gate (views + planet twins S1/S6) |
| 07 | `07-sheet-lab-power-and-machines.png` | ⬜ pending |
| 08 | `08-plot-stage-ladder.png` | ⬜ pending |
| 09 | `09-sheet-coverage-growth.png` | ⬜ pending (normal/roughness derived from albedo) |
| 10 | `10-plot-stage-6-hero.png` | 🔁 redo queued: pixel plumes that drift, spread and thin; feeds + pylon cabling readable |
| 11 | `11-desolate-horizon.png` | 🔁 keep the take; only the goblin planet is fixed (no Earth continents) |
| 12 | `12-sheet-field-machines.png` | ⬜ pending |
| — | `contact-sheet.jpg` | ⬜ built last from the 12 finals |

## Per-image notes (final images only get full sections; the rest when they land)

### 02-gate-power-on ✅
**For:** the owner's key beat — the moment the lever is thrown.
**Full prompt used:** (the second take; the first was rejected for a fully-lit
ceiling, which broke the "gate drains everything" story)

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
> of the threshold; a steel junction box on the plinth with round cable glands,
> thick black cables running away in low ribbed floor cable covers across the
> polished floor to a row of four grey relay cabinets against the back wall in
> the back-right corner; beside the relays a breaker panel and a capacitor bank
> of six tall grey cylinders with copper bus bars on a steel skid. Slightly left
> of the gate, between the camera and the gate: the operator's console, a rugged
> dashboard desk on a pedestal with gauges, indicator lamps and one BIG
> red-handled main lever. Along the left wall a tall dark preset rack of
> cartridge slots; centre-left a round 2.4 m holotable on a low pedestal, dark;
> preset bench and combiner along the right wall, dark.
>
> Scene state: THE MAIN LEVER HAS JUST BEEN THROWN, and the gate is drawing
> power from EVERYTHING. The ceiling strip lights have dimmed to a faint ghost
> glow, the room is DARK, lit almost only by warm amber machine light: the four
> relay cabinets' indicator lamps light up in a row — the first two cabinets
> glow amber, the third is flickering on, the fourth still dark. Visible pulses
> of bright amber light travel in segments along the thick black cables inside
> the floor cable covers, from the relays to the gate's plinth. The gate's field
> coils ignite FROM BOTTOM TO TOP: the lowest coils burn hot amber-orange, the
> middle coils just catching fire, the top coils still dark; amber light spills
> onto the concrete floor. Inside the gate's opening, churning grey-blue
> television static is beginning to resolve into a faint hazy landscape. The
> red-handled lever stands pushed forward to ON. A small goblin 1.3 m tall with
> green skin, long pointed ears, yellow eyes, wearing a worn brown leather vest
> and belt, stands two steps back from the console raising one forearm toward
> the waking gate.
>
> Mood: electric, tense, a dark room lit by machinery. Believable industrial
> equipment with cable glands, service panels, handles, warning stripes.
> Nothing floats: everything stands on feet, skids, plinths or anchor bolts.
> Cables run through floor covers from a source to a load.

**Machines present:** gate, console, 4 relay cabinets, breaker panel, capacitor
bank — logic as the registry above; all cables in floor covers. **Right:** the
chunky ribbed-coil gate (owner's pick), relays lighting in a row, segmented
amber pulses travelling along the floor-cover runs, coils igniting bottom-up,
dimmed room, static resolving. **Off:** the console's lever could read bigger;
the goblin touches the console rather than standing clear. **Redo?** No —
owner picked this as the canon.

---

## Owner review fix list (status)

- [in progress] one gate design everywhere (chunky ribbed-coil canon) — 06
  first, then redos of 01/03/04/05; planet twins in 10/11 to match
- [pending] 01 gate OFF: coils dark and cold, zero orange glow
- [pending] no loose cables anywhere — steel floor covers / overhead trays only
- [pending] goblin planet alien: irregular green+ochre, cloud bands, no blue,
  identical in every image
- [pending] 04/05 left third calm (plain wall + floor); window centre-left
- [pending] lab images photoreal (04/05 drifted illustrative)
- [pending] 03 plot view: multi-textured like 11 (sand/rock/gravel/cracked
  flats/reddish soil), low-res, black sky
- [pending] 10 pixel plumes drift, spread, thin; feeds/hoppers + pylon cabling
- [pending] 11: keep, replace only the goblin planet
