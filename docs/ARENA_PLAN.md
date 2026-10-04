# The hotbar V3, built by the Arena AIs

The owner's hotbar spec V3 (2026-10-04, planned with a flash model; kept verbatim in `docs/OWNER_ASKS.md`) is the target. This file reconciles it with what is built, lists what is missing, and splits the missing work into small, pure modules for the Arena battle AIs (they do the hard work), with my glue after each. The order of work at the bottom is the plan from here on; `MASTER_PLAN.md` 6.3 and 6.4 point here.

## 1. The V3 spec, read against SetMix

**Three modes = our three levels.** V3's Game Mode, Simplified Mode and Advanced Mode are our Easy, Pro and Studio (the switch on the hotbar). Kept as they are, with their V3 meanings:

| V3 mode | Ours | What it feels like |
|---|---|---|
| Game Mode | Easy | Diegetic: your goblin holds the tool (a magnet, a spray can, a rolling pin), plays an animation, the target reacts (wobble, squash, pop), every use has a sprite, a sound and a shake. Presets only, no numbers. |
| Simplified Mode | Pro | The transform gizmo on every selection, plain sliders with real units, a few presets per sub-tool. |
| Advanced Mode | Studio | Everything: filters, modifiers, graphs, the script behind each thing. |

**Twelve tabs (F1 to F12), in V3's order.** Our tabs move to it. Browsers keep F11 (full screen) and F12 (developer tools) on most machines, so tabs 11 and 12 also open with **Shift+F1 and Shift+F2** and from the tab strip; inside RUN's frame F11 and F12 may reach us and work as well.

| Key | V3 tab (Game / Simplified / Advanced) | Ours today | Change |
|---|---|---|---|
| F1 | Grab / Select / Selection | Select (pick, move, turn, size, copy, delete, focus, hide others) | + the gizmo, box and lasso select, groups and locks, filters; Game: grab, vacuum, freeze, toss, clone-pop, trash-zap |
| F2 | Colour spray / Paint / Brushes | Paint (ways on the ground; surfaces in the palette; look editor; texture mode) | + paint on things (colour, material, decals), the eraser to default; Game: spray, glitter, glow, stickers, sponge |
| F3 | Blocks and clay / Shapes and sculpt / Geometry | Sculpt (ground ways) | Sculpt splits: **F3 works on things** (building blocks, clay on a thing, booleans), **F10 on the ground** |
| F4 | Puppet show / Animate / Animation | Animate (moves for your avatar) | + pose a thing or character, walk paths, play speed; Advanced: keys, dope sheet |
| F5 | Boombox / Audio / Sound | Sound (play a preset) | + place a sound, ambience zones; Advanced: falloff, reverb, occlusion |
| F6 | Lantern / Lights / Lights | Lights (look, sun, day/night, haze, clouds) | + place a light (bulb, spot, flashlight orb, campfire) |
| F7 | Magic cord / Rules / Logic | Logic (backtick: rules on things) | moves to F7; + trigger zones, action links (open door, light on, teleport), wires between switches and things |
| F8 | Photo cam / Camera / Camera | Camera (ways to see) | + place cameras, fly-through tracks, photo mode (polaroid, selfie, drone, slow motion) |
| F9 | Toy box / Characters / Avatars | Avatar (F8) and Things (F9) | Characters: spawn a character (your avatar's mode stays P), simple AI (stand, patrol, chase, flee, follow, walk to me); Game: pet, bobo doll, go-kart, target, respawn flag |
| F10 | Dirt and trees / Terrain / Terrain | (Sculpt and Things today) | the ground's sculpt ways and the plant scatter move here; Game: mound, pit, lawn roller, plant a tree, flower sprinkler |
| F11 | Physics play / Physics / Physics | none (things have no bodies) | things get physical materials (bouncy, ice, anvil, balloon), solid or ghost; Game: push hammer |
| F12 | Magic wand / Effects / Materials and VFX | Lights' picture effects only | particles (campfire, snow, rain, sparks, fireworks, bubbles, dust), screen mood filters |

Activities leave the hotbar (they are on the galaxy, My planet and the Esc menu). Things become F3's building blocks and F9's toy box.

**The global gizmo** (Simplified and Advanced): bound to every selection; move arrows plus plane quads, rotate rings plus a view ring, scale boxes plus a uniform handle; `+` / `-` grow or shrink it 15% a press; Shift snaps moves to the grid (0.1, 0.5, 1 m), Ctrl snaps turns (5, 15, 45, 90 degrees), Alt-drag duplicates.

**Everything stays a preset** (owner's rule): every V3 preset above is a preset of its tool (the tool presets row), every tool a preset of the hotbar, the hotbar a preset (Settings, Hotbar). Game Mode's animations, sprites and sounds are plugs on the tool presets (`@hm/plugs`, the "When you use it" list).

## 2. What is missing, and who builds it

Hard, self-contained logic goes to the Arena (pure TypeScript packages with acceptance tests, no DOM unless the prompt says so); I write the glue (schemas, wiring into the island and renderer, UI windows, e2e). Per tab:

| Tab | Built | Missing: Arena module (wave) | Missing: my glue |
|---|---|---|---|
| F1 | pick a thing, move/turn/size by clicks, Layers | `gizmo` (A1): handles, hit tests, drag maths, snapping, sizes; `selectset` (A2): box and lasso in screen space, filters, groups, locks | the gizmo drawn in the renderer and driven by the mouse; marquee overlay; Game grab feel |
| F2 | ground paint, looks, texture mode | `decals` (B1): decal placement and projection data, presets | paint on things (voxel colours), decal rendering |
| F3 | ground sculpt; `voxelsculpt`, `smoothvox` exist | `primitives` (A3): parametric blocks as voxel models; `voxelcsg` (B2): union, cut, cut in half on voxel models | F3 tab, blocks in the world, clay on a thing via voxelsculpt |
| F4 | avatar moves | `walkpath` (B3): paths with stops and loop modes, an agent walking them | pose and path tools, puppet strings look |
| F5 | sound presets | `soundscape` (A4): emitters and ambience zones, falloff, mixing to listener gains, 8 ambience presets | emitters in the world, zones drawn, audio wiring |
| F6 | look, sun, haze, clouds; lamps on props | `lightplace` (B4): free light presets (bulb, spot, flashlight orb, campfire, strobe) as data, flicker and strobe curves | lights placed where you click, the renderer's extra lights |
| F7 | rules on things (touch, every, night, day, start) | `triggers` (A5): zones (enter, leave, press E), action links with delay and repeat, wires with AND / OR / NOT / delay / gate; evaluates frame by frame | zones and wires drawn, doors and teleports, F7 move |
| F8 | ways to see | `camtrack` (B5): camera keys along a spline, timing and easing, orbit shot, slow motion clock | camera placer, playback, photo capture |
| F9 | avatars, things | `npcbrain` (A6): stand, wander, patrol, chase, flee, follow, walk to me as pure steering with sight and reaction delay | characters spawned, avatars as NPCs, toy box |
| F10 | sculpt ways, scatter (`@hm/scatter`) | `erosion` (C1): hydraulic and thermal erosion on a heightfield; `splineroad` (C2): road and river carving along a spline | move ground tools to F10, the lawn roller and sprinkler |
| F11 | `@hm/physics` (spheres, heightfield, boxes) | `physmat` (A7): physical material presets and the body spec for a thing (ghost, solid, ladder; bounce, mass, friction), toy effects (balloon lift, anvil, push hammer impulse) | bodies for things in the sim, play to test |
| F12 | post presets in lighting | `particles` (A8): deterministic particle emitters and 12 presets (campfire, smoke, snow, rain, sparks, fireworks, bubbles, dust, glitter, embers, splash, confetti) | particle renderer (instanced), the effects tab |
| all | juice presets, plugs | `tooljuice` (B6, data only): Game Mode's animation, sprite, sound and shake for each V3 preset; `toolanims` (B7, data only): the goblin's tool-holding moves as animation presets | wire them as plugs on every tool |
| Advanced | | `keyframes` (C3): tracks, keys, tangents, dope sheet maths; `wiregraph` (C4): node graph model and layout for Logic's wires; `remesh` (C5, later) | the dope sheet and graph windows |

## 3. Rules for every Arena module (put in every prompt)

- One package, pure TypeScript, strict (`noUncheckedIndexedAccess`), no `any`, no DOM, no `Date`, no `Math.random` (seeded random given), no imports outside the package unless the prompt gives the types to copy.
- Exact exported interfaces and function names given in the prompt; the acceptance tests (node:test + assert) given in full; the module must pass them unchanged ("fix only an obvious typo in a test and tell me").
- Delivery by the REPLY route: exactly two fenced code blocks, `src/index.ts` and `tests/<name>.test.ts`, no project, no build, then STOP (long explorations die).
- Prompts stay under about 5,000 characters; a failed battle is resent once, then split smaller, then written by me.

## 4. Order of work

Two battles at a time (captcha limit). While they run I write glue for the previous ones, never the battle's own module.

1. **Wave A, foundations (8 battles, prompts ready in `docs/handoff/prompts/battle/`):** A1 `gizmo`, A2 `selectset`, A3 `primitives`, A4 `soundscape`, A5 `triggers`, A6 `npcbrain`, A7 `physmat`, A8 `particles`. Glue after each: the F-key move to V3 order (one change, with old hotbars migrated), the gizmo in the renderer, blocks on F3, sounds and zones, Logic on F7, characters on F9, bodies for things, the particle renderer and F12.
2. **Wave B, more tools and the Game Mode feel:** B1 `decals`, B2 `voxelcsg`, B3 `walkpath`, B4 `lightplace`, B5 `camtrack`, B6 `tooljuice` and B7 `toolanims` (data: the reply route with our validators). Glue: each tab's Game presets with their animation, sprite, sound and shake.
3. **Wave C, Advanced:** C1 `erosion`, C2 `splineroad`, C3 `keyframes`, C4 `wiregraph`, C5 `remesh`. Glue: dope sheet, wire graph window, road and river tools.
4. After every merge: `npm run verify`, `npm run e2e` (a check per new tool), the screen map, a sceptic's pass, push to main.

## 5. Arena on this PC (C:\MarbleGp)

- No `E:` drive here. Arena downloads land in `C:\Users\Pierro\Downloads`; the reply-route receiver is `scripts/arena-recv.mjs` (127.0.0.1:8791): navigating the Arena tab to `http://127.0.0.1:8791/put?name=<pkg>&d=<base64url JSON {files}>` writes the files to `arena-out/<pkg>/` (git-ignored), after which the chat URL is reopened.
- Use the built-in browser (Claude_Browser tools). Never sign in to Arena (the Download button asks for Google when logged out: use the reply route instead). No secrets in prompts.
- Battle procedure, waits and merge recipe: `docs/handoff/CATCHUP.md` sections 3, 11 and 12d (prompt size and two-at-a-time rules are the newest).
