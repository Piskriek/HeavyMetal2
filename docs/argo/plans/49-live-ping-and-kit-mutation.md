# Plan 49: Live Ping Targeting & In-Game Kit Mutation (Wave 1)
> **Author**: Claude Opus (engineering), on Piskriek's live co-building directive of 27 Oct
> **Status**: WAVE 1 IN IMPLEMENTATION
> **Branch**: `feat/studio-polish-claude-cloud`
> **Parents**: [Plan 48 Companion & Neural Bridge](48-in-game-ai-companion-bridge.md), [Plan 38 Kits](38-parts-modules-presets.md), [Plan 41 Layered Materials](41-layered-materials.md), [Plan 40 BYOA](40-bring-your-own-agent.md)

---

## 0. The owner's ask

Piskriek wants to walk the game live, point at problems and have them fixed while he watches. The blocker: the AI on the
bridge cannot see what he points at. Wave 1 gives the AI eyes (a ping) and hands (a kit mutation on the pinged part), and
a way to keep the result ("save as default").

## 1. Research (SOP: before designing)

| Reference | What it does | What players say | What we take |
| --- | --- | --- | --- |
| **Apex Legends "Smart Ping"** (Respawn, 2019) | One button marks what the crosshair is on; the system names it (location, item, enemy) and the character voices it. Double-tap marks danger. | Widely held up as the genre's standard: non-verbal, context-aware, works without a mic. EA put the ping patents in its royalty-free accessibility patent pledge (2021) so other games could use the idea. | One button, context from the hit itself, the callout is *spoken by a character*, not just drawn. |
| **Fortnite ping** (Epic, 2019, after Apex) | Marks a location or an item for the squad. | Valued, but complaints about ping spam and markers that cover the view. | One live ping per player, short life, small marker. |
| **Deep Rock Galactic laser pointer** (Ghost Ship Games) | Point at terrain, a mineral or a creature: the HUD names it and a marker shows the team. | Praised because it *identifies* what you point at ("that's Nitra"), which is exactly our need. | The ping carries a name (kit, part, material), so "what is this?" has an answer. |
| **"Put-That-There"** (Bolt, MIT, SIGGRAPH 1980) | Voice plus pointing: "put *that* *there*". | The classic result: deictic words ("that", "this", "here") resolve against the pointer, not the sentence. | The ping is the referent for the next spoken order: "remove the chevrons" means *on what I pinged*. |
| **AI co-players** (NVIDIA ACE co-playable characters such as PUBG Ally, announced CES 2025; Ubisoft NEO NPC demo, GDC 2024) | Companions that take voice orders and act on the world. | Demos impress; the gap players notice is that the companion does not know what *you* are looking at. | Ping events stream to the bridge so any outside AI shares the player's referent. |

Player complaints to design against: ping spam, markers that last too long or block the view, labels drawn into the world,
and pings that do not say what was hit. Hence: one live ping (a new ping replaces the old), 3.0 s life, a small square
reticle, the name in the HUD and the companion's voice (never lettering in the world, per the owner's rule), and the hit
classified and named.

## 2. Mission 1: the ping

- **Input**: middle mouse anywhere in play; `Q` when `Q` has no other job (the beam is not held and the held build item
  has one kind). Debounced at 0.25 s.
- **Ray**: from the camera along the crosshair (screen centre), 60 m reach, nearest hit across:
  kit parts (lab kits, plot machines, the Stargate, vehicles, Spore creations, through the AABB targeter), base pieces,
  the lab shell (floor, walls, ceiling) and the planet heightfield.
- **Classification** (`entityType`): `machine` | `rover` | `structure` | `prop` | `creation` | `wall` | `terrain`.
  The first four the owner named are a subset; the extra three keep a base piece or a Spore model from being called a wall.
- **Marker**: Ray-7 violet (`#b84dff`) square reticle on the hit surface, oriented to the normal: corner brackets that drop
  in, breathe at 2 Hz, a square ripple every 0.75 s, a short square-section stalk along the normal and a core diamond that
  shows through occluders. Fades over the last 0.5 s of its 3.0 s life; sized by distance so it reads at 40 m.
  No lettering in the world.
- **Wire**: `POST /event` on the bridge:
  ```json
  { "type": "ping", "where": "lab", "label": "Quantum archway gate · rim front",
    "target": { "x": 0, "y": 0.1, "z": -6.4, "normal": { "x": 0, "y": 0, "z": 1 },
                "entityType": "machine", "entityId": "gate", "kitId": "gate", "partId": "rim-front",
                "part": "hazard-rim", "material": "hazard", "distance": 6.3 } }
  ```
- **Acknowledgement**: the companion says it on the radio: *"Target locked: Quantum archway gate, rim front, at
  (0.0, -6.4), 6.3 m."*; the last ping is remembered as the referent for the next order.

## 3. Mission 2: kit mutation on the pinged part

- **Modular first**: the lab gate's two-step dais (the black-and-yellow bands around the gate's foot) was shell geometry, so
  nothing could change it. It becomes a kit, `gate-dais` (`kit-gate-dais.ts`): two paint steps and eight hazard bands.
  Physics are unchanged (the walkable height stays analytic); the cost is two draw calls.
- **Pure resolver** (`kit-mutation.ts`, unit-tested):
  - a part is *hazard trim* when its current material is a hazard or chevron material, or its part id names hazard
    trim and it still wears its kit default;
  - `strip-hazard` re-dresses hazard trim in the material of the part it sits on (largest contact), so the stripes go and
    the surface reads as one piece. Scope: the pinged part's own kind when it is hazard trim, else the hazard trim
    touching the pinged part, else every hazard part of the kit;
  - `set-material` puts a material on named paths; `reset` takes the overrides off.
- **Bridge commands** (any AI, `POST /command`):
  - `{ "action": "override-kit-part", "kitId", "partId" | "paths", "material" }`
  - `{ "action": "mutate-kit-preset", "kitId"?, "partId"?, "mutation": "strip-hazard" | "reset" }` (defaults to the last ping)
  - `{ "action": "save-kit-default", "kitId"? }`
- **Voice** (local, no AI needed): "remove the black and yellow chevrons on the base piece", "put the stripes back",
  "save as default", "what is this?".
- **Live**: every mutation goes through `setKitOverrides()` on the live scene (instant rebuild) and into the player's
  props save, the same path the Beam Rifle's Apply uses.
- **Save as default**: the game posts the kit's overrides to `POST /kit-defaults`; the bridge validates the shape and
  writes `apps/web/src/play/kit-defaults.json`, the shipped default overrides every kit build starts from (the player's own
  overrides sit on top). The AI engineer commits that file; the next build ships it to everyone.
- **Bridge hardening** (it now writes a file): listens on `127.0.0.1` only, answers CORS for localhost origins only, and
  accepts only kit ids, paths and material names of a fixed character set.

## 4. Tests

- `ping.test.ts`: classification, pulse envelope (drop-in, breathing, fade, death at 3.0 s), distance sizing, wire rounding,
  the spoken label.
- `kit-mutation.test.ts`: hazard detection, strip scope (part kind, touching, whole kit), replacement material from contact,
  real `GATE_KIT` and `GATE_DAIS_KIT` flattening.
- `companion-intent.test.ts`: the owner's phrases for the kit intents.
- `scripts/test-ping-kit-e2e.mjs`: a real browser and a private bridge on a test port: ping the gate's dais, the marker
  lives and dies, the `ping` event reaches the bridge with the right kit and part, the companion acknowledges, the voice
  order strips the bands (materials change in `kitPlaced`), a bridge `override-kit-part` lands, `save-kit-default` writes
  the defaults file (a temp file in the test).

## 5. Wave 2 (not in this wave)

- "Open this in the Studio": load the pinged kit's document in the Studio with the part selected.
- Wall carving: "put a door here and a corridor on the other side" needs runtime lattice carving in `@hm/structure`.
- Ping wheel (danger, go here, build here) and double-tap danger pings.
