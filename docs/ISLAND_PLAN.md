# Basalt Isle: the island course, with forks and a new layout every race

**One run from the sky to the sea.** Every course in this game is a long descent ("Glory at the bottom"), so
the island is built top-down: the race starts on floating rocks above the volcano, drops onto the caldera,
spirals down through the mountain and out behind a waterfall, runs the cliffs and the sea caves under them,
and finishes on a lagoon arena at sea level. Twelve sections, eleven forks, 2–3 branches per fork, and a
different open-route and lane layout every race.

Reference: the owner's volcanic-island render (broad beaches, turquoise lagoons, basalt cliffs, timber and
iron) and the modular kit sheet. Clean low-poly shapes; the owner has since asked for palm trees and rocks.

## 1. The route: twelve sections

| # | Section | Where | Branches (fork) | Kit and landmarks |
|---|---|---|---|---|
| 1 | Sky Harbor | Start on floating basalt rocks, far above the island | **A** chain bridges hopping rock to rock · **B** a drop chute through the middle rock | floating isles ×3, chain bridge, sky gate |
| 2 | Cloudfall | Off the rocks, down to the caldera | **A** a long spiral round a hanging rock · **B** a jump across open air onto the rim | anchor pylons, jump ramp |
| 3 | Caldera Rim | The crater's edge | **A** the outer rim road · **B** an inner ledge above the lava lake (boost pads, lava hazard) | basalt columns, lava pool |
| 4 | Obsidian Spiral | Down the volcano's flank | **A** hairpin switchbacks · **B** a straight basalt slide (faster, fewer rails) | hairpin, cliff block, stone wall |
| 5 | The Lava Tube | Inside the mountain | **A** the main tube · **B** a side vent over a lava river · **C** a crumbling ledge (rare) | lava tube, lava bridge |
| 6 | Waterfall Breakthrough | Out behind the big waterfall (all branches merge) | — | waterfall cave |
| 7 | Cliff Road | Along the cliff tops | **A** timber trestles on the cliff edge · **B** a ledge cut into the cliff face | cliff trestle, railing wall |
| 8 | Undercliff Caves | Sea level, **under the Cliff Road** | **A** through the sea caves · **B** round the outside of a sea arch | basalt cave, sea arch |
| 9 | Beach Run | The broad south beach | **A** the beach jump ramp · **B** the sandbar shallows | jump ramp, beach shelf |
| 10 | Lagoon Crossing | Across the big lagoon | **A** the boardwalk · **B** arch bridges island to island · **C** a shipwreck ramp | boardwalk, arch bridge, shipwreck |
| 11 | Sea Stack Slalom | Weaving among the sea stacks | lane-network weave (stacks move per race) | sea stacks ×2 |
| 12 | Lagoon Arena | Finish on a platform in the lagoon | — | lagoon platform, arena gate |

The route passes over itself twice (the Cloudfall spiral over the Rim; the Cliff Road over the caves), so
every section below is seen from above earlier: the island reads as one place, not a corridor.

## 1b. Secret spots

Small scenes a player glimpses from one branch and talks about afterwards. Each sits on a branch that is not
always open, so finding them takes several races:

| Spot | Where | What |
|---|---|---|
| Found Me | Undercliff Caves, branch A, behind a rock | a goblin skeleton slumped on an open treasure chest, holding a sign that reads **FOUND ME** (the game paints the words) |
| The Marble Idol | Lava Tube, branch B | a basalt shrine to a stone marble, braziers glowing |
| The Last Balloonist | Sky Harbor, branch B, under the middle rock | a crashed goblin balloon on a ledge |
| Old Ram | Obsidian Spiral, branch B | a giant stone statue of the armored sheep |
| Something in the Lagoon | Lagoon Crossing, branch C | kraken tentacles arching over the shipwreck ramp |
| The Crooked Light | Sea Stack Slalom | a goblin lighthouse on the tallest stack |

## 2. Forks without breaking the race engine

The engine measures progress as one number, engine `x`, and everything (physics, standings, the strip map,
determinism) hangs off it. Forks keep that:

- A course becomes a **route graph**: a chain of sections; each section has one or more **branches**; every
  branch of a section spans the **same engine-x range** (split → merge), with its own 3D waypoint spline,
  track space, obstacles, pickups, lane network and collision patches.
- A racer carries a `branchId` per section. Placement, surface and collision look up that branch; progress,
  speed and standings are unchanged. Branches differ by what is on them (jumps, hazards, boosts, width), not by
  engine length, so no branch is secretly shorter.
- **Choosing a branch reuses the lane network's `split` node**: where the road divides, the side you steer to
  is the branch you take. The CPU picks by personality (the Daredevil likes the lava ledge).
- **Parity law, as for lanes:** a route graph with one branch per section is exactly today's game. A parity
  test over seeded races holds that, like `tests/lane-parity.test.ts`.

## 3. A new layout every race

The world is fixed (models placed once); the **race seed** picks a `RouteLayout`, deterministically:

- which branches are open at each fork (2 of 3, sometimes all, sometimes a forced single branch);
- which lane-network variant each branch uses (3 authored variants per branch: narrow, wide, weave);
- which obstacle and pickup set each branch carries, and where the sea stacks stand in section 11.

Closed branches are visibly shut (a gate down, a rockfall), so players learn to read the island. The layout is
stored with the race (session save, replays, multiplayer later), so a race can always be replayed exactly.

## 4. The island itself

- **Terrain**: a procedural heightfield for the island's body (volcano cone, cliff shelves, broad beaches,
  lagoon basins, sandbars) with four painted material zones (pale sand, wet sand, basalt, ochre rock), a water
  plane with a shoreline foam band, and distance fog. Code, not Meshy: a single Meshy mesh cannot carry a
  ten-times-scale world, and code terrain stays editable and light.
- **Landmarks from Meshy**, placed at large scale: the volcano massif, two sea stacks, the sea arch, three
  floating isles. They give the silhouette from the reference.
- **Kit from Meshy** (done: 13 pieces), dressing each branch: bridges under the road, ramps, cave mouths.
  The racing surface is always the course's own ribbon; kit pieces a ball can hit use their **collision tier**
  rasterized into the existing deterministic terrain patches (`src/game/collision/terrain-patch.ts`).

## 5. Meshy: what is made, what it costs

Every model comes in three tiers: **full** (~8k triangles, 1024 texture, ~0.65 MB), **low** (~1.5k, 512
texture, ~0.25 MB, used by the low graphics setting and at distance) and **collision** (~300, no texture).
One model with all three tiers costs **40 credits** (30 + 5 + 5).

| Batch | Models | Credits | State |
|---|---|---|---|
| Kit | beach shelf, cliff block, hairpin, straight road, arch bridge, boardwalk, jump ramp, basalt cave, waterfall cave, lagoon platform, stone wall, railing wall, iron crate | 520 | **done** |
| Landmarks | sea stack tall, sea stack wide, sea arch (references cut from the island render) | 120 | next |
| Island set | floating isle ×3, chain bridge, sky gate, anchor pylon, lava tube, lava bridge, basalt columns, lava pool, cliff trestle, shipwreck, arena gate, volcano (clean) | 560 | needs ISLAND-ART |
| Dressing and secrets | palms ×3, rocks ×4 (meshy-6-lite: 25 each), skeleton treasure, lighthouse, crashed balloon, goblin shrine, kraken, sheep statue | 460 | needs ISLAND-ART-B |
| Ball armour | Rustbucket bands, Springsteel fins, Siegebreaker spikes (drawn around the real ball, which stays a sphere for physics, dents and garage decals) | 120 | needs ISLAND-ART-B |

Total for everything: **~1,780 credits** (520 spent). The account holds 2,021, so it fits, but **the 1,000
ceiling must rise to ~1,800**. Until then: kit (done), landmarks and the island set run first, within 1,000.

The island-set references are painted first by a Codex art batch, in the kit sheet's exact style (one object,
grey background), then turned into models here. The wave-2 lessons apply (review every image by eye, no
reference-subject leaks, contrasting background in review).

## 6. Who builds what

| Work | Owner | Depends on |
|---|---|---|
| ROUTE-1: route graph in the engine (branches, split choice, parity test) | this session (determinism-critical) | — |
| ROUTE-2: `RouteLayout` from the race seed, closed-branch gates, saved with the race | this session | ROUTE-1 |
| ISLAND-ART: 13 island-set reference images | Codex art agent | — |
| ISLAND-TERRAIN: island heightfield, beaches, lagoons, water, materials | Codex agent | — |
| KIT-WIRE: kit and landmarks as builder props; low tier on the low setting and at distance; collision tier into terrain patches | Codex agent | — |
| Meshy runs: landmarks now, island set after ISLAND-ART | this session | ISLAND-ART |
| ISLAND-ROUTE: author the twelve sections and eleven forks, three lane variants per branch | this session + builder | ROUTE-1, terrain, kit |
| CPU branch choice by personality; strip map shows forks | Codex agent | ROUTE-1 |

## 7. Open questions for the owner

- Raise the Meshy ceiling to 1,300 for the full island set?
- Is Basalt Isle a fourth course alongside Copperwood, the Brass Quarries and the sheep course, or the
  new home of all of them (each race a different route across the one island)?
- Should closed branches ever open mid-race (a gate lifting on lap events), or stay fixed per race?
