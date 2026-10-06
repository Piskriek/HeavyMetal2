# SetMix: the plan from scratch (2026-10-06, evening)

**State: PROPOSED. Nothing is built from this until the owner says yes.** Written by the new planning session from `docs/handoff/NEW_SESSION_PLAN.md`, the owner's words in `docs/OWNER_ASKS.md` (13:40 onwards), `docs/SETMIX_GAME_CONCEPT.md`, the winning Arena design (`arena-gathered/setmix/site/src/data/gdd.ts`), `docs/SETMIX_WORLD.md` and the code on `main`.

## 1. How this session works

1. **The owner's words decide.** Every feature traces to a line in `OWNER_ASKS.md`. The Arena design document is a menu of ideas; nothing from it goes in unless the owner picks it.
2. **Concept art before visuals.** The Arena art agent (Agent mode) paints the target; I review every image myself; the owner approves; then the build aims at it. No hand-drawn concept art from me.
3. **Arena Battle writes the bulk code.** I write self-contained briefs (contract, tests, a preview page so voting unlocks), paste them into arena.ai in the browser pane, collect both answers, run the tests, vote, record the models, and integrate. My own usage goes on planning, briefs, review and integration.
4. **Every owner note is logged first**, and a note that moves the direction stops the work and changes this plan before anything else happens.
5. **Standing rules:** 60 fps on Low on the laptop (GTX 950M), a loading bar until a screen runs smooth, believable machines (grounded, cabled, a job for every part), the frontend-design skill for any design work.

## 2. What the owner has decided (their words)

| Area | Decided | Source |
|---|---|---|
| The game | SetMix's game mode is the Resolution Crafter: terraforming raises the planet's fidelity. Machines spew pixels into the air instead of oxygen. | 07:30, 14:05 |
| Lab and planet | A white PBR lab with all the machines for making and applying presets; a sci-fi gate to a desolate low-poly moon; walking through makes you low poly. Presets are inventory items you slot into machines on the planet; a lab machine combines presets. | 07:30 |
| Studio and Play | Studio is a menu button: the fully upgraded lab, for making presets for any game. Play starts in a sparse lab with progression; you gather something logical on the planet that drives research and machines. | 07:30 |
| Later | A ship built with engineering to reach the goblin planet; players open up the galaxy; Goblin Racing standalone with its own start. | 14:05 |
| Shared planet | One planet that grows as players join; everyone gets starting real estate; you can explore neighbours' plots instead of building; games orbit the planet, then solar systems, then galaxies. | 17:00 |
| Menu | Menu items on the left over a PBR lab; the gate on the right shows the planet in all its glory, as it looks after terraforming. | 18:40 |
| The look | No low-poly plants or animals in a PBR scene. A desolate planet, not a spotlit crater. Smooth models. "make it look fkking good". The lab feels like Portal 2. The plot starts in the 90s, but you see far enough to spot other players' plots with trees and PBR. | 19:12, 19:20, 19:24 |
| Stages | Models climb with the stages as well as textures: low poly at stage 1, high poly over time; the last stage is all high-fidelity PBR (textures, models, lighting). | 20:30 |
| Coverage | Textures show the flora growing: a coverage layer of moss, vines, leaves, dust and grass that spreads like vines, drawn with normal maps, not geometry. The last stage is a lush PBR forest. | 20:30 |
| The gate | A sci-fi door frame standing upright in the room, not joined to any wall, as tall as two goblins stacked. Wires to control boxes and power relays; machines in the room; a window shows a different place from the doorway. | 20:30 |
| Editions | Goblin Racing appears only in the Goblin Racing version, top of the list; choosing it makes the gate show the goblin planet. In the SetMix version the gate shows a fully realised plot. | 20:30 |
| First Play | The first time you click Play and enter the lab, the gate is off; you turn it on and things happen. From then on it shows your plot. | 20:30 |
| Machines | Believable, "not floating butplugs". They spew colourful pixels while they run; it all feels logical and connected. | 20:30, evening |
| Not wanted | No chimney. One flat texture and some low-poly trees is not good enough. | evening |

## 3. Questions for the owner (now)

1. **The centre of a new player's plot, now the chimney is gone.**
   - a. The planet end of the gate: where you step out, with your machines built round it by you. *(My suggestion: it follows from your 07:30 premise, walking through the gate onto the moon.)*
   - b. A starter set of machines, already standing and wired.
   - c. Bare ground: you place everything.
2. **The last stage: 6 or 8?** The ladder, its tests and the wave are built for 6; your 20:30 note said "stage 8". 8 is a small change if you want more steps. *Default: 6, reading "stage 8" as "the last stage".*
3. **The SetMix menu.** From your 07:30 note: **Play** (the campaign: sparse lab, gate off the first time) and **Studio** (the full lab) replace the "Resolution Crafter" entry. *Default: Play, Studio, then the rest (My planet, Avatars, Community, Settings); Goblin Racing only in its own version.*
4. **What the menu's gate shows once you have turned yours on in Play.** *Default: always the finished plot "in all its glory" (18:40); your own plot shows in the gate inside Play.*

The machines themselves are not a question yet: the art agent draws candidates on design sheets, each with its job, its power and its pixels, and you pick from the sheets.

**Later, before the shared planet is wired (Phase 5); defaults unless you say otherwise** (`SETMIX_WORLD.md` section "Decisions"):
- plot size: 56 m radius, as built;
- abandoned plots: kept for ever (nothing ever moves);
- names: shown when you visit or point at a plot, not from afar;
- a new player: the next slot out; "next to a friend" once friends exist.

## 4. The phases

Each phase ends at an owner checkpoint (**G**). Nothing moves to the next phase without it.

### Phase 0: agree this plan (now) → G0
The owner's yes, and answers to section 3.

### Phase 1: remove what the owner rejected (me, small, alongside Phase 2)
- Take the chimney out of the crafter and the lab's vista; the plot centre stays empty until the art for it is approved. The crafter's "Run the chimney" control becomes a plain stage control (a test tool, not a feature).
- An edition flag (`setmix` or `goblin-racing`, set at build time): the SetMix menu has no Goblin Racing; the Goblin Racing menu lists it first.
- The menu as answered in question 3.
- Gate: `npm run verify`, e2e, 60 fps on Low.

### Phase 2: concept art (Arena Agent mode) → G1
- I rewrite `docs/prompts/arena-setmix-concept-art.md` from section 2 and the answers: no chimney; machines that spew colourful pixels while they run, each with a feed (what goes in), a job, a pixel exhaust (what comes out, in its metric's colour), a power line from a relay, and feet on the ground.
- I paste it into arena.ai (Agent mode, repo `Piskriek/HeavyMetal2`) myself. The agent pushes to its own branch and touches only `docs/concept/setmix/`.
- The set:
  1. the lab at first Play: emergency light, the gate off;
  2. the gate powering on (relays closing in a row, pulses along the cables, coils lighting bottom to top, the lab dimming);
  3. the gate on, showing your plot at stage 1, beside the window showing the real outside;
  4. the SetMix menu backdrop: the gate shows a fully realised plot; the left third kept calm for the menu;
  5. the Goblin Racing menu backdrop: the gate shows the goblin planet;
  6. a design sheet of the gate (front, side, back; plinth, cable junction, service hatches; a goblin for scale);
  7. a design sheet of the lab's power and machines: relays, control boxes, the console and lever, cable trays, candidate lab machines;
  8. the stage ladder: one camera on your plot at every stage, models and textures both climbing;
  9. the coverage layer on one patch of ground, step by step, with the last step split into albedo, normal and roughness;
  10. the target: your plot at the last stage, a lush PBR forest;
  11. the desolate horizon from a new plot, other players' plots green in the distance;
  12. a design sheet of candidate planet machines, stage 1 against the last stage, each spewing its pixels and wired to its power.
- **The two Arena chats started today from the old chimney brief** are off-brief. Nothing from them has reached GitHub (checked: no new `arena/` branch since 2026-10-02). If they push, I review them like anything else and keep only what has no chimney and matches section 2.
- I review every image myself (I can see images) on a contact sheet, against section 2: floating parts, unconnected machines, the chimney, wrong gate. One redo round is budgeted.
- **G1:** the owner approves the art and picks the machines from sheets 7 and 12. Then section 2 grows with those picks.

### Phase 3: the code, by Arena Battle (briefs written from the approved art)
Each brief is self-contained: the contract, tests, and a preview page. I run both answers' tests, check strict typecheck, vote and record the models in `arena-gathered/README.md`. The likely battles:

| Battle | What it writes | Its tests hold it to |
|---|---|---|
| `@hm/treegen` | Real trees: a branching skeleton (space colonisation), bark tubes with UVs, leaf clusters as alpha cards, a detail ladder from low poly (stage 1, flat shaded) to high poly, and impostor data for distance. Replaces the blob trees. | determinism; triangles per level; every branch joined to its parent; the trunk on the ground |
| `@hm/coverage` | The coverage layer: moss, vines, grass, leaves and dust spreading over a grid like vines, from seeds (water edges, machines, trees), driven by stage and time; one weight map per layer. | determinism; spread stays connected; budgets per tier |
| Ground shader | The layered ground: the cartridge base plus the coverage layers (albedo, normal, roughness), height-blended, triplanar on slopes, one shader with uniforms so a stage change never recompiles. Replaces the one flat texture. | uniform packing; a preview page per stage |
| `@hm/rigkit` | Believable machines: cable runs that sag between supports and follow floor covers and trays; relay cabinets, control boxes and consoles; a checker that every prop stands on the floor or a mount and every powered thing has a cable path to a source. | the checker itself: nothing floats, nothing unpowered |
| Pixel exhaust | Machines spewing coloured pixel motes from their vents while they run (instanced, cheap on Low), and pulses along their cables. Builds on `@hm/particles` if it fits. | rate follows the machine's state; the cost cap on Low |

Small pieces I write myself: picking the model level per stage (SM14; the smooth models already have three levels), and the gate's power-on sequence (SM18; the "gate on" flag saved in player storage).

### Phase 4: build to the art (me) → G2 (the lab), G3 (the plot)
- **The lab** (SM16, SM17, SM18): the free-standing gate, the window, relays, control boxes, cables and the picked machines; the gate shows the finished plot on the menu, your plot in Play, the goblin planet in the Goblin Racing version; first Play starts with the gate off.
- **The plot** (SM14, SM15): the plot centre as answered; the layered ground and coverage; real trees; models and textures climbing every stage to the lush PBR forest.
- Every step is judged against the concept art by screenshot, measured on the laptop on Low, and loads behind a bar. The owner sees the lab (G2), then the plot through the stages (G3).

### Phase 5: the game loop, and the shared planet
After the look lands: what you mine, which machines you build, research in the lab, cartridges slotted on the planet, Studio against Play. I bring a short proposal drawn from the picked machines and the design document; the owner decides; Arena writes the systems. Then the shared planet (SM8 to SM10) with the defaults in section 3; going live needs the RUN deploy, which needs the owner's login.

## 5. What stays from what is built

Kept as they are: `@hm/fidelity`, `@hm/vault`, `@hm/texgraph`, `@hm/flora`, `@hm/fauna`, `@hm/smoothvox`; the planet layout and its far horizon (`crafter/planet.ts`); the shared planet's rules (`crafter/shared-planet.ts`); the loading and performance set-up. Replaced after the art: the ground (one cartridge texture per stage), the blob trees, the lab's arch in the wall. Removed now: the chimney.
