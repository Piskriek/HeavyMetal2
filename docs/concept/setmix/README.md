# SetMix: The Resolution Crafter — concept art set (FINAL)

**Branch:** `arena/601f7fc1-heavymetal2` · set complete 2026-10-07.
Canon decisions come from `docs/SETMIX_PLAN.md` sections 2–3 (owner's
decisions outrank everything; `gdd.ts` names are an undecided idea menu).

**Files (deliverables, 12 + contact):**

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
| 13 | `13-sheet-base-construction.png` | design sheet — 11 base pieces, S1 low poly / S6 full PBR, same design at both stages |
| 14 | `14-outpost-stage-3.png` | scene — a sealed four-cell outpost at stage 3, mill on its pad, cables in floor covers, gate on the horizon |
| 15 | `15-sheet-base-roofs-openings.png` | design sheet — 16 pieces (12–27): roofs, corners, ridge, gable, half and window walls, doorframe, interior door, stairs, ladder, railing, brace, life-support unit, airlock vestibule; S1/S6, same design at both stages |
| 16 | `16-outpost-roofed.png` | scene — the stage-3 outpost grown by two cells: pitched roof, gable end, window wall, outside stair to a railed deck, mill on its pad, gate and Earth |
| 17 | `17-sheet-heavy-terraformers.png` | design sheet — the three heavy terraformers (28 shape press, 29 light projector, 30 water maker), S1/S6, each on the sheet 13 hardpoint socket |
| — | `contact-sheet.jpg` | all 12, numbered |

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
stage 1: a natural low-poly desert built from many materials** — tan sand
sheets, grey fractured rock, dark gravel fans, cracked dry-lake flats, drifts
of reddish soil — under a black starless sky, the plot's first machine
cluster and a relay pylon tiny in the distance; the gate's planet end
visible at the plot centre. **The window shows photoreal rain, wet pines,
mist.** The goblin stands on the step plate between the two, exactly half the
opening's height ("two goblins stacked, never three"). All cabling inside
closed steel floor covers / ceiling trays; zero loose cable.

**Machines in frame:** gate (running), console, relays + capacitor bank
(steady), holotable (off), plus the plot-side miniatures through the opening.

**Self-review:** does the side-by-side job: same room light hits both worlds.
The plot's multi-material mix reads correctly (not one pale ground), though
the reddish-soil variety is weaker inside the opening than in 11's wide shot —
the owner's eye may still prefer 11's desert as reference. Goblin ratio
locked at 1:2.

---

## 04 · menu-setmix — the main menu backdrop

**For:** the game's main menu background — the lab fully alive in steady
state, with the gate showing the *finished* plot (stage 6). The menu's left
third must stay calm for the UI.

**Prompt (†reconstructed — canon block exact):** photoreal lab interior,
evening. **Composition rule: the LEFT THIRD stays completely calm — plain lit
wall panels and empty polished floor; no machine, hologram, goblin or rack
there.** Window centre-left (rainy pines, dusk). Gate right of centre, canon
build (chunky Π, three stacked ribbed copper-coil blocks per upright face,
buttress plates, hazard-striped plinth, step plate), its opening showing the
plot at stage 6 — a lush golden forest with a lake. Machines centre-to-right,
all fully inside frame: console with the big red lever (thrown), round
holotable with the amber hologram + amber sparkles, preset bench writing a
cartridge (pink square pixels from the writing head's vent), preset combiner
mixing (violet pixels), fabricator printing (green pixels) — all four plumes
on-screen at once, drifting and thinning. Relays + breaker + capacitor bank
back-right. All cables in ceiling trays with neat vertical drops + closed
floor cable covers; no bare cable. The goblin at the holotable, half the
opening height.

**Machines in frame:** full registry's lab set, all running except the rack
(indexer idle): gate, console, holotable, bench, combiner, fabricator, relay
cabinets, breaker, capacitor bank.

**Self-review:** frame keeps the calm third clean and still reads "everything
works". All four pixel colours present. Nit surviving to print: the console's
big red lever reads small at this camera distance (it's there, thrown
forward) — acceptable, but if the menu zoom crops left, the lever story
moves to 02 anyway. Photoreal grade kept (an earlier illustrated take was
rejected).

---

## 05 · menu-goblin-racing — the alt menu: look what you could reach

**For:** the second menu backdrop (the "goblin racing" shell) — same framing
as 04, but the open gate frames the goblin home planet hanging in space.

**Full prompt used (verbatim, 4th take — 04's framing restored after take 3
moved the gate to centre):**

> Widescreen 16:9 game concept art, cinematic PHOTOREALISTIC render, crisp and
> detailed, shot like a straight photograph — NOT an illustration. No text, no
> UI, no watermark, no logos. Interior of a clean white high-fidelity
> test-chamber laboratory at evening: off-white square wall panels with thin
> dark seams, dark steel kick band, polished concrete floor with soft
> reflections, dark ~8 m ceiling with cold-white strips on but dimmed.
>
> CAMERA GEOMETRY, important: this is the main-menu framing — the gate stands
> well RIGHT OF CENTRE, its vertical midline at roughly 68% of the frame
> width; the whole LEFT THIRD of the frame stays completely CALM — plain lit
> wall panels and empty polished floor only, no furniture, no hologram, no
> person. On the centre-LEFT of the back wall a wide window (~4×2.5 m) shows
> a photoreal rainy pine-forest mountainside at dusk: dark wet pines, sheets
> of rain, drifting mist.
>
> The lab gate: a massive CHUNKY industrial door frame standing upright,
> joined to no wall, ~3 m off the back wall: two WIDE heavy box-column
> uprights of gunmetal steel capped by a THICK RECTANGULAR LINTEL BEAM, a
> solid-block Π silhouette; the front face of each upright almost entirely
> covered by THREE stacked RIBBED COPPER-COIL BLOCKS like transformer
> radiator slabs, glowing steady warm amber; at each side a big angled
> triangular steel BUTTRESS plate leans from the floor against the upright's
> outer flank; the frame bolts to a LOW WIDE PLINTH with a continuous
> black-and-yellow HAZARD-STRIPED rim and big anchor bolts; a low steel
> step-up plate before the threshold. THE GATE'S OPENING IS A WINDOW INTO
> DEEP SPACE, dominated by the HUGE goblin home planet seen through the
> doorway: irregular continents of deep green and warm ochre in shapes
> matching no real-world landmass, wrapped in swirling white cloud bands, NO
> blue oceans; sparse starfield around its limb; the planet nearly fills the
> doorway and its soft glow spills into the room.
>
> Machines, from centre toward the right wall, every one fully inside the
> frame: a console pedestal with a BIG RED LEVER thrown forward, standing
> left of the gate; the round 2.4 m holotable at centre carrying an amber
> hologram of a game plot, with a light drift of small SQUARE AMBER (#ffc13d)
> pixel sparkles rising from its projector rim vent; a preset bench where a
> cartridge is being written, small SQUARE HOT-PINK (#ff3d8a) pixels drifting
> up from the writing head's exhaust vent; a round preset combiner on a
> bolted plinth with two cartridges slotted, small SQUARE VIOLET (#b46bff)
> pixels rising from its mixing chamber's vent grille; a fabricator printer
> at the right wall printing a part, small SQUARE GREEN (#7cff4d) pixels
> pouring from its rear exhaust vent — its whole plume visible inside the
> frame. ALL FOUR colour plumes appear at once: small crisp four-sided square
> pixels that drift sideways and thin as they rise, each from a dedicated
> exhaust vent, never from a feed hopper. Back-right wall: four relay
> cabinets with lit indicators, breaker panel, capacitor bank of six tall
> cylinders with copper bus bars on a flat steel skid.
>
> CABLES: everything runs inside closed low grey STEEL FLOOR CABLE COVERS and
> CEILING CABLE TRAYS with neat short vertical tray drops; absolutely no bare
> loose cable on the lab floor.
>
> A small goblin — 1.3 m tall, green skin, long pointed ears, yellow eyes,
> worn brown leather vest and belt — stands beside the gate on its step
> plate, looking up and pointing at the giant planet. SCALE RULE: the goblin
> is EXACTLY HALF AS TALL AS THE GATE OPENING — the 2.6 m opening reads as
> exactly two goblins stacked, never three; the crown of his head rises to
> the opening's mid-height line.

**Machines in frame:** same full lab set as 04, all running; the difference is
cosmic (deep space in the doorway) not mechanical.

**Self-review:** framing now matches 04 (gate ~2/3 across, left third clean);
all four plumes visible and uncropped; planet correctly alien. Honest nit:
the goblin renders at ≈0.4× the opening (≈2.6:1) rather than the literal
0.5× — inside the "never three goblins" tolerance but shy of perfect; a
future pass could nudge him taller without touching anything else.

---

## 06 · sheet-gate — the one gate design

**For:** THE gate reference. Every image in the set is built from this sheet;
it exists to end design drift (several earlier takes invented new gates).

**Prompt (†reconstructed — one-shot sheet: four views in a 2×2 arrangement were
prompted as four panels, then composited):** four renders of the canon gate —
front, side, back, three-quarter — on a neutral mid-grey studio background,
soft key from frame right, plus two small insets (the planet twin at stage 1:
bare concrete footing on low-poly desert; and at stage 6: moss-covered in lush
forest) and a goblin silhouette at the base of the front view for scale.
Composited to 2560×1440 with header + seven typeset callouts:
**(1)** opening 2.6 × 1.7 m — two goblins stacked; **(2)** three ribbed
copper-coil blocks per face — amber lit, cold gunmetal off; **(3)** buttress
gussets carry the side loads; **(4)** hazard-striped plinth + anchor bolts;
**(5)** rear junction box + six cable glands; **(6)** removable step plate at
the threshold; **(7)** the planet twin weathers on its cast footing pad —
same frame, same coils.

**Machines in frame (design):** gate only (both ends), goblin as scale figure.

**Self-review:** the sheet did its job — after it landed, 03/04/05/11 all pass
the canon checklist. Nit: the stage-6 inset is busier (more creeper cover)
than the actual 06-twin shown in 10; treat 10 as the weathered-twin reference
going forward.

---

## 07 · sheet-lab-power-and-machines — where every watt lives

**For:** the lab's infrastructure argument: power flows capacitor bank →
breaker → four relay cabinets → control boxes → console/gate, all in trays
and covers; plus portrait cards of the lab machine candidates with their
in→out stories.

**Prompt (†reconstructed — composite):** top band: a straight-on elevation of
the lab's back-right wall with the full power chain standing in line —
capacitor bank (six cylinders, copper bus bars, flat skid) → breaker panel →
four relay cabinets in a row → small wall control boxes → console with red
lever — connected only by overhead cable trays and vertical drops; caption
lines typeset after. Bottom band: five machine portrait cards on neutral
background — preset bench (pink pixels rising from the writing head's vent as
crisp square tiles), combiner (violet), cartridge rack, holotable (amber
hologram of the plot + sparkles), fabricator (green) — each card typeset with
name + "does" line + in/out/support + pixel colour.
Footer: colour legend (pink texture / green shape / amber light / cyan water /
violet presets), the combiner example (mud texture + terrain shaping = road),
and an OWNER note: "mark the machines to build".

**Machines in frame (design):** capacitor bank, breaker, relay cabinets ×4,
control boxes, console, preset bench, combiner, rack, holotable, fabricator —
all registry entries.

**Self-review:** the chain reads left-to-right unambiguously; caption clipping
was fixed by shorter titles + two 14-pt spec lines per card. The bench pixel
language that finally worked (after "pixel motes" produced golden sparkle
dust): *"SQUARE-SHAPED particles, small crisp hard-edged flat squares like
tiny confetti tiles, each one visibly four-sided, hot pink, NOT dots/sparks/
dust/smoke"* — recorded here because every future pixel prompt should reuse
it. Nit: the combiner's violet plume is subtle at card size.

---

## 08 · plot-stage-ladder — one camera, six worlds

**For:** the stage system's whole argument in one sheet: the same plot, the
same shot, six fidelities — and pixels visible at every stage.

**Prompt (†reconstructed; per-panel shared block + per-stage deltas, then
composed):** each panel: photoreal/lit render of the plot from "a fixed
camera: standing on a low rocky rise 30 metres from the planet end of the
gate, looking outward across the plot to a far flat horizon" — gate at frame
left (canon planet twin), machine cluster mid (rock drill, boxy texture mill
with pink plume, shape press with green plume), lattice relay pylon with
sagging spans, goblin right. Six renders, one per stage, deltas:
**S1** natural multi-textured low-poly desert, black sky; **S2** textures
refine, "a THIN BAND OF DEEP INDIGO-VIOLET COLOUR hugging the land", first
sun glint; **S3** "THE WORLD STOPS BEING MADE OF BOXES" — smoothed hills,
haze, soft shadows; **S4** "WATER FILLS THE LOW GROUND" — turquoise basin;
**S5** green branching VINE-LIKE TENDRILS from water and machine feet, first
mid-poly trees caught mid-transition; **S6** lush golden PBR forest, god
rays, machines and gate moss-covered but running, plumes still pouring, the
goblin planet a pale daytime moon.

**Composed** (`tools/compose08.sh`): 3×2 grid of 820×461 cells w/ caption
strips + four-column legend footer (MODELS / TEXTURES / LIGHT / WORLD) and
the closing line: *natural from stage 1 on — "natural, just low rez". No
flat colour palette, no single texture over everything.*

**Machines in frame:** planet-twin gate, drill, mill, press, relay pylons —
each climbing the model-ladder with the world.

**Self-review:** the ladder argument survives at thumbnail size — coverage
creep is legible S2→S6. Nit: the waterline sits at slightly different heights
relative to the hills between S3/S4 (independent renders); the legend row
disclaims this as "concept continuity, not surveyed terrain".

---

## 09 · sheet-coverage-growth — six steps of green winning

**For:** *how* coverage actually grows — not a slider, a creep: out of the
water and the machines, tendril by tendril. And what the ground's maps look
like at the end.

**Full prompt used (verbatim shared block; each panel = shared block + its
STEP paragraph):**

> Videogame environment study panel for a terraforming game, rendered like a
> realtime 3D game engine screenshot, flat-shaded low-poly look, soft 3D
> lighting, absolutely NO comic outlines, NO cel shading, NOT a cartoon. No
> text, no UI, no watermark. FIXED CAMERA, an oblique top-down view tilted
> about 55 degrees, of ONE marked 2-by-2 metre square of wild ground, the
> square nearly filling the frame, its front edge toward the camera; four low
> dark corner posts with taut ORANGE string lines mark the square. Context
> anchors that must appear: at the TOP edge of frame, the bolted steel feet
> and skid of a field machine cast a long shadow into the square; along the
> square's LEFT edge a THIN water runnel runs in a shallow ditch. Low raking
> sunlight from frame right, soft long shadows. The ground is stage-1 low
> poly: large flat facets of tan sand, grey rock chips, dark gravel, one
> reddish soil patch at the back-right.

Step paragraphs (verbatim):
- **STEP 1 — BARE:** "inside the square there is only bare stage-1 ground…
  Absolutely nothing grows anywhere; dry, lifeless, brand-new ground. The
  orange string lines are clean and untouched."
- **STEP 2 — FIRST SPECKLES:** "scattered TINY GREEN SQUARE pixel-specks,
  small crisp four-sided green tiles, dust the wet left corner of the square
  where the runnel touches it, and a thinner scatter… under the machine feet
  along the top edge. Everywhere else the ground stays completely bare."
- **STEP 3 — TENDRILS:** "branching VINE-LIKE green tendrils creep from the
  wet left corner in forking search patterns… reaching about a third of the
  square, hugging the surface like ground-vines; tiny blocky low-poly moss
  pads sit at the tendril root points; a faint drifting haze of small green
  square pixel motes hangs just above the newest tendril tips."
- **STEP 4 — PATCHY CARPET:** "the green tendrils have knitted into PATCHY
  LOW TURF covering about half the square — blocky low-poly grass clumps and
  small angular ferns thickest along the wet left side… where the turf has
  closed, the ground facets look FINER and the surface slightly
  higher-resolution; the right half remains bare."
- **STEP 5 — CLOSING COVER:** "mid-poly turf is nearly complete… denser grass
  tufts with more facets than before, clover patches, small FIRST SAPLING
  NUBS at two corners, and small cyan-rimmed puddle beads sitting in the low
  hollows; only THIN BARE SEAMS of cracked dry flat ground remain."
- **STEP 6 — FULL COVER:** "completely covered in lush ground life at full
  PBR fidelity — dense detailed grass with individual blades and dew glints,
  soft moss, clover patches, tiny white and pink flowers, and ONE small
  leaning sapling overhanging the wet left corner; NO bare ground remains…
  the orange string lines are partly swallowed and hidden by the growth."

**Composed** (`tools/compose09.sh` + `tools/derive_maps.sh`): 3×2 grid +
footer: step-6 square split into **ALBEDO / NORMAL / ROUGHNESS** (normal via
Sobel gradients of luminance, roughness remapped to a mostly-rough range —
concept targets, not engine exports).

**Machines in frame:** one machine's skid+feet only (the anchor that coverage
radiates from).

**Self-review:** the creep story reads instantly. Honest nits: (a) step-2's
speckles photograph brown-green at sheet size; (b) the derived maps are
luminance-derived approximations — fine as concept targets, not masks to
ship; (c) panels are independent renders, so the red-soil patch migrates
slightly step to step.

---

## 10 · plot-stage-6-hero — the payoff

**For:** what the player is *for*: the finished plot in its best light — and
proof that the machines don't stop when the world gets pretty.

**Full prompt used (verbatim, 4th take, for the generated base plate) — and
note the finishing method: the model kept giving the moon Earth continents
(three regenerations), so the final moon is an ImageMagick COMPOSITE, not a
generation: the alien disc was cut from `11-desolate-horizon.png`
(planet-texture area x=514..710, y=49..245 — deliberately inside the limb to
exclude the night-side rim), resized to 206 px, paled (`-modulate 124,48,100`,
56% colourise to the sky's `#b8d0ea`, gamma 1.16, level 12%), the old
Earth-moon melted into sky haze with a soft-masked heavy blur patch, and the
new disc blended in at 82% with a feathered circle mask (r=103 at centre
790,130 — exactly where the old moon sat). Reproduce from the two source
PNGs; no AI pass involved. The prompt that generated the base plate:**

> Widescreen 16:9 game concept art, cinematic photorealistic render, crisp
> detail. No text, no UI, no watermark. A finished terraformed game plot at
> STAGE 6, golden hour: a lush meadow-and-forest bowl in full PBR fidelity —
> tall wet grass, ferns, reeds between the trees, NO bare patch of ground
> anywhere; long warm shadows rake from a low sun at frame RIGHT; light haze;
> everything moist and glowing.
>
> Left of frame stands the PLANET END of the industrial gate, weathered and
> moss-covered but running: a chunky box-section frame — two WIDE box-column
> uprights capped by a thick rectangular lintel, the face of each upright
> covered by THREE stacked RIBBED COPPER-COIL BLOCKS glowing steady amber
> behind creepers, big angled triangular BUTTRESS plates bracing both flanks,
> the frame on a low hazard-striped plinth bolted to a wide cast concrete
> FOOTING PAD; at the pad's edge a steel JUNCTION BOX with cable glands; the
> gate opening shimmers with soft depth haze looking into a white-lit lab.
>
> Mid-ground machine cluster, all RUNNING and mossy at their bases, each with
> TWO CLEARLY SEPARATE OPENINGS: a TEXTURE MILL — front top FEED HOPPER
> heaped with raw ore chunks, mouth dark and still, while a stubby EXHAUST
> STACK at its rear top edge pours a drifting plume of small crisp SQUARE
> hot-pink (#ff3d8a) pixels; a SHAPE PRESS — sloped side FEED TRAY of crushed
> rock, inert, while a wide REAR VENT GRILLE pours small SQUARE green
> (#7cff4d) pixels; a LIGHT PROJECTOR on a bolted tripod mast — vent grilles
> around the BACK RIM of its lamp housing pour small SQUARE amber (#ffc13d)
> pixels (never from the lens); a WATER MAKER — gravel INTAKE SCREE at its
> base inert, while a vent on the tank's rear top cap pours small SQUARE cyan
> (#3dc8ff) pixels. Every plume DRIFTS with the breeze, SPREADING and
> THINNING as it rises, dissolving into the haze — never rigid columns.
> Thick power cables lie on the ground from the junction box and rise onto
> sagging spans strung between lattice relay pylons; a drop cable hangs to
> each machine.
>
> Beyond: a turquoise lake with reeds, forested far shore, wooded hills. High
> in the blue sky hangs the goblin home planet as a PALE DAYTIME MOON —
> ghostly and faint, and UNMISTAKABLY ALIEN, NOT EARTH: irregular patchwork
> continents of deep green and warm ochre in shapes that match NO real-world
> landmass — no Africa, no Americas, nothing familiar — wrapped in swirling
> white cloud bands, with ABSOLUTELY NO BLUE OCEANS anywhere on its disc.

**Machines in frame:** planet-twin gate, drill (background), mill, press,
light projector, water maker, relay pylons — all weathered, all working.

**Self-review:** hero shot delivers; the four plumes demonstrably exit
*behind* the feeds, and the moon is now verifiably the same alien planet as
03/05/11 because it IS the same pixels. Nits: the mill's plume rises very
close above its hopper (the stack sits directly behind it) — at small sizes
it can still read hopper-born; sheet 12's mill portrait is the unambiguous
reference. At full zoom a faint crop-edge brightness step ghosts at the
disc's top rim; invisible at viewing size.

---

## 11 · desolate-horizon — day one

**For:** the emotional opposite of 10: the moment before everything. The
loneliest picture in the set, and the owner's favourite take (kept through
three targeted fixes: alien planet in v2, canon twin-gate + hopper/stack in
v5, style discipline throughout).

**Full prompt used (verbatim, 5th take):**

> Wide 16:9 REALTIME 3D GAME SCREENSHOT of a low-poly game world rendered in
> a modern engine: flat-shaded triangles with soft physically-based lighting,
> gentle global illumination, clean anti-aliased edges, subtle bloom on light
> sources. STRICTLY a 3D render look — absolutely NO line art, NO ink
> outlines, NO cel shading, NOT an illustration, NOT a comic. No text, no UI,
> no watermark.
>
> A brand-new barren terraforming plot under a pitch-BLACK starless sky;
> camera stands on a low rocky rise at the plot edge looking across a wide
> flat basin. The land is one natural low-poly desert built from MANY
> flat-shaded materials mixed in patches: tan sand sheets, grey angular
> fractured rock ridges, dark gravel fans, pale cracked dry-lake polygons,
> drifts of reddish-brown soil. Utterly lifeless. A few tiny low cyan glimmer
> pools far away.
>
> Left foreground: the PLANET END of an industrial gate, in stage-1 low poly
> with this EXACT chunky silhouette: two WIDE heavy box-column uprights of
> dark gunmetal joined at the top by a THICK RECTANGULAR LINTEL BEAM — a
> solid chunky Π shape, NOT a truss, NOT a mast; the front face of each
> upright is covered by THREE stacked RIBBED COIL BLOCKS (dark with the
> faintest amber tick of first power at their grilles); big angled triangular
> BUTTRESS plates lean against both outer flanks; the frame bolts to a LOW
> WIDE PLINTH with a muted grey-yellow hazard-striped rim standing on a wide
> CAST CONCRETE FOOTING PAD; at the plinth's foot a boxy steel JUNCTION BOX
> with round cable glands; the gate opening is dark smoky glass.
>
> Beside the footing pad the plot's FIRST machine has just started: a
> low-poly boxy TEXTURE MILL on four bolted feet. At its FRONT a top FEED
> HOPPER heaped with faceted grey ore chunks — the hopper mouth completely
> dark and still. A thick power cable lies on the ground running from the
> gate's junction box to the mill. At the mill's REAR a clearly SEPARATE
> stubby EXHAUST STACK with a vent grille — from THAT stack, never from the
> hopper, the plot's FIRST pixels rise: a thin plume of small crisp SQUARE
> hot-pink (#ff3d8a) voxels drifting up and slightly sideways, spreading and
> thinning as they climb into the black sky, catching soft bloom. A small
> 1.3 m goblin (green skin, long pointed ears, yellow eyes, worn brown
> leather vest, same low-poly 3D style) stands watching, hand shielding his
> brow.
>
> Far across the basin: two or three distant neighbour plots glow faintly
> greener — low blankets of green faceted turf and tiny low-poly tree shapes
> crowded around tiny distant gate frames; from one far plot a FRIEND'S
> BEACON fires — a thin bright-white vertical laser pillar straight up into
> the black sky.
>
> Overhead, HUGE in the black sky, the goblin home planet: clearly alien —
> irregular continents of deep green and warm ochre in shapes that match no
> real-world landmass, swirling white cloud bands, NO blue oceans; its faint
> pale-green planetshine washes the scene; a dying sliver of a dim low sun on
> the horizon at frame right. Mood: hopeful desolation.

**Machines in frame:** planet-twin gate (stage-1 low poly — its canonical
day-one state), texture mill #1 (the plot's first runner; hopper inert, rear
stack live), and by implication the future five.

**Self-review:** strongest image in the set — the exhaust/anatomy lesson and
the canon gate both landed in the same frame. Nits: the two neighbour plots
mirror each other a little too neatly; the beacon pylon at the horizon reads
as a small drum tower rather than a mast (it's far enough away to be
forgiven).

---

## 12 · sheet-field-machines — the eight candidates

**For:** the machine bible for the field: eight working-name candidates, each
drawn twice (stage-1 arrival / stage-6 veteran), each photograph answering the
same four questions — what holds it up, where does power come from, what goes
in, where do the pixels come OUT. Pixels exit only through dedicated exhaust
stacks/vents, never through the feed.

**Full prompt used (verbatim template; every panel = wrapper + machine
paragraph; the S6 row re-wraps identical machine paragraphs in the S6
photoreal wrapper quoted after):**

> A realtime 3D GAME ENGINE SCREENSHOT, Blender/Unity style render at stage-1
> low-poly fidelity: flat-shaded triangle meshes, soft physically-based
> lighting, gentle ambient occlusion, clean anti-aliased edges — STRICTLY a
> 3D render, absolutely NO line art, NO black contour outlines, NO cel
> shading, NOT a cartoon or illustration. No text, no UI, no watermark.
>
> ONE terraforming machine alone, three-quarter view, filling about two
> thirds of frame height, centred on a small patch of low-poly desert ground
> (tan and grey flat facets); black starless sky behind, dimming lighter at
> the horizon; soft key light from frame right, one soft shadow.

Machine paragraphs (verbatim):
1. **ROCK DRILL** — "a chunky faceted mast frame held by FOUR SPREAD LEGS with
   wide anchor pads bolted down, a fat central auger bit half-sunk into a
   shallow dusty pit; at its FRONT a discharge tray heaped with faceted grey
   ore chunks — dark and inert; a side intake chute with a dark mouth; at the
   REAR top a short EXHAUST STACK with a vent grille venting only a FAINT
   THIN WISP of dim unsorted grey-beige motes drifting up and thinning. A
   thick power cable leaves the rear socket and runs along the ground
   off-frame. Big simple flat low-poly panels, rivet dots, one service hatch,
   a small amber status lamp."
2. **TEXTURE MILL** — "a boxy grinding mill on FOUR BOLTED FEET. TWO CLEARLY
   SEPARATE OPENINGS: at the FRONT, a top FEED HOPPER heaped with raw faceted
   ore chunks, its mouth completely dark and still — material only goes IN
   here; at the REAR top edge, a stubby vertical EXHAUST STACK with a grille
   pouring out a drifting plume of small crisp SQUARE hot-pink (#ff3d8a)
   pixels that spread and thin as they rise. On the machine's flank a
   CARTRIDGE SLOT holds one pink-striped texture preset cartridge. A thick
   power cable… hazard-striped toe strip along the base."
3. **SHAPE PRESS** — "a low wide press frame on an ANCHORED BASE PLATE with
   four corner bolts, two vertical hydraulic stamps cycling over a flat die
   bed. at the SIDE, a sloped FEED TRAY holding crushed rock — dark and
   still… at the REAR, a wide EXHAUST VENT GRILLE pouring a drifting plume of
   small crisp SQUARE green (#7cff4d) pixels… CARTRIDGE SLOT with one
   green-striped shape preset cartridge… grease-dark press columns."
4. **LIGHT PROJECTOR** — "a tall anchored TRIPOD MAST, each leg footed with a
   bolted pad, carrying a big round faceted LAMP HEAD tilted upward… Vent
   grilles around the BACK RIM of the lamp housing — clearly separate from
   the lamp's front lens — pour a drifting plume of small crisp SQUARE amber
   (#ffc13d) pixels… base housing CARTRIDGE SLOT with one amber-striped light
   preset… a tiny ladder-rung strip up the mast."
5. **WATER MAKER** — "a ribbed cylindrical condenser tank lying cradled in a
   frame with FOUR FEET… at the SIDE BASE, an INTAKE SCREE heap of gravel —
   dark and still… on the tank's top cap at the REAR, a raised EXHAUST VENT…
   small crisp SQUARE cyan (#3dc8ff) pixels… end cap CARTRIDGE SLOT with one
   cyan-striped cartridge; a small drain tap drips… frost streaks under the
   vent."
6. **PRESET MIXER** — "a waist-height rounded cabinet on FOUR BOLTED FEET;
   slanted top ROW OF FOUR CARTRIDGE SLOTS — two plugged with violet-striped
   preset cartridges, two dark and empty; a small round porthole in front
   glows VIOLET… at the REAR a raised EXHAUST VENT with grille pouring…
   small crisp SQUARE violet (#b46bff) pixels… a single empty output slot on
   the side."
7. **POWER UNIT** — "a heavy enclosed field generator block on a flat steel
   SKID with anti-vibration feet and forklift pockets; FRONT wide slot where
   refined material cells slide in — one cell half-inserted, a small rack of
   three more beside; FLANK two big round CABLE SOCKETS, one mated… NO
   PIXELS come out of this machine anywhere — it makes electricity, not
   pixels: only a small translucent STEAM WISP from a cooling vent on the top
   rear; load indicator strip glows green."
8. **RELAY PYLON** — "a tapered LATTICE STEEL MAST on a square CONCRETE
   FOOTING PAD with four anchor bolts; porcelain insulator strings carry one
   thick span cable entering and leaving with a gentle sag; a small bright
   WHITE PULSE BEAD travels up the mast core; DISTRIBUTION BOX at foot with
   three round cable glands and one thick drop cable leaving off-frame. NO
   pixels, NO exhaust — it only carries power."

S6 wrapper (verbatim): "Photorealistic 3D render — a videogame machine-design
study at STAGE 6 fidelity: full PBR materials, worn painted metal, rust at
seams, grease and patina… it has RUN for decades and is weathered: moss
patches, small vines and flowers cling to its housing and pool around its
feet; it stands in a LUSH MEADOW — tall grass, clover, small wildflowers, NO
bare ground; soft blue sky with a few thin clouds; warm sun from frame right…"
(+ deliberately softened paint/weathering details per machine: "worn
safety-yellow paint flaking to bare steel", "chalky mineral streaks under the
vent", "galvanized steel gone matte grey-brown", etc.)

**Composed** (`tools/compose12.sh`, sources in `panels/12/`): 8 columns × 2
fidelity rows; name + job + in/out + support lines under every portrait;
footer columns: POWER (junction box → generator → spans → drops), WHAT PIXELS
ADD, IN vs OUT (the owner's exhaust rule), FOR THE OWNER.

**Machines in frame (design):** the whole field registry, which is the point.

**Self-review:** the anatomy rule holds in 16/16 portraits; in/out lines are
identical across rows by design (same feed, same stack). Nits: (a) poses are
independent renders, so columns match in anatomy rather than in exact pose;
(b) the S1 pylon is rendered cleaner/less painterly than its row-mates
(technical look suits infrastructure); (c) the S6 press's intake mouth reads
large, slightly cartoonish in proportion.

---

## contact-sheet.jpg

`tools/contact.sh` — 12 numbered tiles, 4×3, labeled by number and slug. The
owner's one-glance checklist: every canon fix visible at once (gate silhouette
in 6 frames, alien planet in 3, four plumes where required, calm left thirds
in 04/05).

---

## Process notes (for whoever regenerates anything)

- **Toon trap:** "low-poly game render" prompts randomly land as cel-shaded
  cartoons. The wording that reliably lands 3D: *"A realtime 3D GAME ENGINE
  SCREENSHOT, Blender/Unity style… absolutely NO line art, NO black contour
  outlines, NO cel shading, NOT a cartoon"*.
- **Pixel trap:** "pixel motes" → sparkle dust. Use: *"SQUARE-SHAPED
  particles, small crisp hard-edged flat squares like tiny confetti tiles,
  each one visibly four-sided, hot pink (#ff3d8a), NOT dots/sparks/dust/
  smoke"*.
- **Earth trap:** without explicit "no blue oceans, no real-world landmass",
  every planet drifts Earth-like, more so as a daytime moon. State it in
  EVERY planet prompt.
- **Hopper trap:** without "TWO CLEARLY SEPARATE OPENINGS"-style phrasing,
  plumes rise out of the feed hopper. State both openings, and which one is
  dark.
- **Sandbox trap:** this environment rolled untracked files back repeatedly;
  keep generated panels in git (see `panels/12/`), commit after every
  accepted image.
- Sheets are composed with ImageMagick (`tools/compose*.sh`); callouts are
  typeset, never generated.

## Open questions back to the owner

1. **Drill exhaust:** it currently vents a faint *unrefined* wisp (dim,
   unsorted motes) — keep, or should a drill spew nothing at all?
2. **05's goblin** renders ≈0.4× the opening (target 0.5×) — inside "never
   three" tolerance; nudge or accept?
3. **Machine shortlist:** which of the eight field machines (sheet 12) and
   which lab machines (sheet 07) get built first?

---

## 13 · sheet-base-construction — the base construction kit

**For:** the art direction for freeform base building on the moon plot (Valheim / Dune: Awakening style). Eleven pieces. Each piece is one design, drawn twice: stage 1 (chunky low poly, flat-shaded, about 16 flat colours) and stage 6 (the same design at full PBR resolution, clean and in service, on the lush terraformed plot). Fidelity stages raise the resolution of one world; they are not time passing, so no rust, decay or ruin. A hazmat scientist (1.8 m) stands in the wall panels for scale. The heavy terraformer hardpoint is a 2 x 2 pad of slabs (8 x 8 m) with a short socket cylinder, power and data glands; the heavy texture mill is about twice the height of the field mill on sheet 12, spews only from a rear vent grille, and runs on cables in floor covers.

**Pieces:** 1 heavy foundation (4 x 4 m, about 0.5 m thick, levelling skirt sunk into the ground, anchor bolts, hazard-striped edge) · 2 structural wall (4 m x 3 m) · 3 pillar (corner post) · 4 floor / roof (4 x 4 m deck on four posts) · 5 ramp (one storey over one cell) · 6 airlock (wall piece with a sealed door, pressure seal, status light, gauge) · 7 hardpoint (empty) · 8 hardpoint + heavy texture mill · 9 quantum storage bin (link emitter on top) · 10 quantum repeater pylon (tower, extends the link range) · 11 drafting table (a primitive and a material swatch on the bench, a blueprint plate between them).

**Prompts:** verbatim in `panels/13/prompts.txt`. Wrapper W1 (stage 1), wrapper W6 (rev 3: the same piece at full PBR, no rust, no decay) and the clause that forbids any lettering, logos, labels or signs on any surface (rev 3b) are recorded there, with each piece paragraph and the revisions.

**Panels:** `panels/13/13-<piece>-s1.png` and `13-<piece>-s6.png`. `panels/13/rejected/` keeps the renders that failed review (split-screen and baked-text versions), for the record. Composed by `tools/compose13.sh`.

**Review notes:** no chimneys or stacks in any kept panel; pixels leave only from rear vent grilles; every piece is grounded, with skirts, plinths or bolts visible; no text baked into any kept image.

---

## 14 · outpost-stage-3 — a sealed four-cell outpost at stage 3

**For:** a small sealed outpost on the plot at stage 3 (real hills, normal detail, haze, soft shadows; see sheet 08). Four cells in a 2 x 2 block, each enclosed by walls on every side, roof panels on top, and one airlock door as the only way in. One heavy texture mill stands on its 2 x 2 pad, pouring pixels from its rear vent. A quantum storage bin with a link emitter sits inside. Every cable runs in low ribbed steel floor covers. The gate stands far off on the left horizon, and Earth is in the sky.

**Prompt (verbatim):**

> A realtime 3D GAME ENGINE SCREENSHOT at stage-3 fidelity: real rolling hills, normal-detail textures, soft shadows, a light haze at the horizon, a dark blue-grey sky with a small alien planet visible: irregular continents of deep green and warm ochre in shapes that match no real-world landmass, wrapped in swirling white cloud bands, NO blue oceans. Scene: a small SEALED OUTPOST on uneven desert ground: four grey 4-metre cells in a 2 by 2 block, each cell enclosed by 3-metre steel walls on every side, a flat roof panel on top of every cell, and a single reinforced airlock door in one outer wall as the only way in; the base sits on grey foundation slabs with levelling skirts sunk into the regolith and hazard-striped edges. Beside the base, one heavy texture mill on a 2 by 2 pad of slabs, about 4 metres tall, with a top feed hopper of dark ore and a rear vent grille pouring a plume of small crisp SQUARE hot-pink pixels (no chimney, no stack, no smoke). A quantum storage bin with a link emitter stands inside the base. Every cable runs inside low ribbed steel floor cable covers, never loose on the ground: from the mill back across the ground in covers toward a repeater pylon mast and a junction box, and from the far gate's junction box. Far off on the left horizon, a chunky steel door frame gate standing free, with ribbed amber coil blocks. Desolate, not lit like a stage: dim low sun from frame right, no spotlights, no glow, no people, no goblins. No text, no UI, no watermark. ONE single image, one camera, not a split-screen.

**Review notes:** the slabs, walls, roof panels, airlock, bin and mill are grounded; the pixels leave the rear vent; cables run in covers; the sky and planet follow the sheet-08 stage-3 look (dark blue-grey, small planet, no blue oceans). No people or goblins.

---

**Status (lead engineer review, 2026-10-10):** complete. All eleven S1/S6 pairs are one design; the S6 hardpoints were redrawn in 9c47f00a to the S1 bolted cylinder socket with cable glands on its pad. The owner: "art looks good". Roofs, openings and circulation pieces follow on sheet 15.

---

## 18 · sheet-life-support — pressure and the starter shelter

**For:** the art direction for the two owner-approved systems: a sealed room only stops the sync drain while a powered life-support unit runs inside it, and new players get a free one-cell starter shelter placed in one action. Three pieces, continuing sheets 13, 15 and 17 (kit, joints and roof). Each piece is one design, drawn twice: stage 1 (chunky low poly, flat-shaded, about 16 flat colours) and stage 6 (the same design at full PBR, clean and in service, on the lush terraformed plot).

**Pieces:** 31 life-support unit (floor-standing, about 1.9 m tall, 1.1 m wide, 0.7 m deep; louvred intake low down, three swappable scrubber canisters behind a clear window, fan housing on top, oxygen bottle strapped to one side, power and data cables rising into a wall conduit, pressure dial, green status bar; no pixels) · 32 airlock vestibule (one-cell cutaway, near wall and roof removed; outer and inner airlock doors, pressure panel with a cycle button, amber and green beacons, grating and drain, suit hook) · 33 starter shelter (one 4 x 4 m cell on a skirted foundation, three plain walls and one airlock wall, the sheet 15 21-degree roof, life-support unit and drafting table inside, bin by the door; S1 beside the gate portal, S6 as a roof-off cutaway).

**Prompts:** verbatim in `panels/18/prompts.txt`. Wrapper W1 (stage 1), wrapper W6 (the same piece at full PBR, no rust, no decay), and the clause that forbids any lettering, labels or signs on any surface.

**Panels:** `panels/18/18-<piece>-s1.png` and `18-<piece>-s6.png`. `panels/18/rejected/` keeps the renders that failed review (`18-lifesupport-s1-rev1`, `18-vestibule-s6-rev1`). Composed by `tools/compose18.sh`.

**Review notes:** no chimneys, stacks or smokestacks; the life-support unit emits no pixels; every piece is grounded with skirts, plinths or bolts visible; no text baked into any kept image; the scientist (1.8 m) gives the scale on piece 31. Known gap: on 31 the cables run beside the unit rather than into a clearly drawn wall conduit. Noted for a later pass.

---

## 19 · sheet-vehicle-fabricator — the vehicle fabricator and the rover catalog

**For:** the art direction for vehicles as a fixed catalog of designed rovers. Each rover prints whole at a Vehicle Fabricator on the base, and better rovers unlock as the world's fidelity rises. Four pieces, continuing sheets 13 to 18 (kit, pad, cable covers, paint and lamp style). Each piece is one design, drawn twice: stage 1 (chunky low poly, flat-shaded, about 16 flat colours) and stage 6 (the same design at full PBR, clean and in service, on the lush terraformed plot).

**Pieces:** 34 vehicle fabricator (a heavy station on a 2 x 2 slab hardpoint pad: a 5 m steel gantry straddling a printing bed, a print head on the rail, a control console at one corner, power and data cables in ribbed floor covers; S1 empty, S6 mid-print with a scout half formed in glowing wireframe, the print the only glow) · 35 scout (stage 2, a light one-seat moon buggy about 3.2 m: open tubular roll cage, four wire-mesh wheels, tool rack, headlamps, whip antenna) · 36 hauler (stage 4, a six-wheeled flatbed about 6 m: two-seat cab, steel storage bin with the sheet 13 link dish, tow hitch, side steps, flat deck left clear behind the bin) · 37 crawler (stage 6, a tracked survey vehicle about 7 m: armoured cab, folding beam-drill arm, sensor mast, heat-sink spine).

**Prompts:** verbatim in `panels/19/prompts.txt`. Wrapper W1 (stage 1), wrapper W6 (the same piece at full PBR, no rust, no decay), and the clause that forbids any lettering on any surface. The rover shown on the S6 print is the scout.

**Panels:** `panels/19/19-<piece>-s1.png` and `19-<piece>-s6.png`. `panels/19/rejected/` keeps the hauler S6 renders that failed review (`19-hauler-s6-rev1`, `19-hauler-s6-rev2`). Composed by `tools/compose19.sh`.

**Review notes:** no chimneys, stacks or smokestacks; no smoke; the fabricator's print is the only glow on the station; every piece is grounded (wheels, tracks, pads and bolts touch the ground); cables run in low ribbed floor covers; no text baked into any kept image; the scientist (1.8 m) stands beside each piece for scale. The hauler S6 emitter matches the S1 mushroom cap, slightly larger in the S6.

**Revision 4 (lead-engineer review):** the fabricator S6 now shows the half-printed scout resting on the bed, wheels and lower chassis solid, only the roll cage wireframe. The hauler S6 emitter is the small sheet 13 link dish, with no beam or glow. Old renders are in `panels/19/rejected/` (`19-fabricator-s6-rev1`, `19-hauler-s6-rev3`). Open point: the hauler S1 still draws its thin beam.

**Revision 5:** the hauler S1 is redrawn to the revised S6 design: a rectangular storage bin with the small finned link dish, and no beam. No piece on sheet 19 now has a beam. Old S1 renders are in `panels/19/rejected/` (`19-hauler-s1-rev1`, `19-hauler-s1-rev2`).

---

## 20 · sheet-weapons — the weapon bench and the modular weapon

**For:** the art direction for the modular weapon: ONE frame with FOUR part slots (core, barrel, sight, cell). Parts are crafted at a Weapon Bench and swapped in the field. Lab family kit: gunmetal and slate paint, hazard bands, amber lamp style. Three pieces, continuing sheets 13 to 19.

**Pieces so far:** 38 weapon bench (2.4 x 1.2 m, 0.95 m high, braced legs; padded jig clamp holding the frame, pegboard of tools and parts, a parts printer box with its door shut and a green lamp, a power cable down a leg into a ribbed floor cover; a scientist at the bench for scale) · 39 weapon frame, bare (side-on on a neutral backdrop; four empty mounts: core, barrel, sight, cell; grip, long stock, hazard band on the trigger guard, amber lamp) · 40 part variants (pending: 3 cores, 3 barrels, 3 sights, 2 cells, each drawn at S1 and S6 on the frame).

**Panels:** `panels/20/20-bench-s1.png`, `20-bench-s6.png`, `20-frame-s1.png`, `20-frame-s6.png`. `panels/20/rejected/` keeps the frame S6 renders that failed review (`20-frame-s6-rev1`, `-rev2`, `-rev3`). Prompts in `panels/20/prompts.txt`. The sheet `20-sheet-weapons.png` is not yet composed, because piece 40 is pending.
