# Section 3: Tracks And Air Supplies

## World Design

The world pass keeps the readability principles from `GAME_DESIGN.md`: quiet road values, stronger silhouettes for hazards and supplies, recognizable course identities, and no decorative object that secretly collides with a racer.

| Course | Region | Racing Character | Finish |
| --- | --- | --- | --- |
| Rustbucket Ridge | Copperwood Valley | Flowing grades, pine shadows, occasional loops, and long setup space before gaps | The Scrapdome |
| Boomtown Run | The Brass Quarries | Copper-red mesas, steeper alternating drops, more TNT, and committed lane choices | The Blast Furnace |
| Woolly Wasteland | The Woolwind Downs | Open green pastures, pale dirt, shorter single-lane gaps, more sheep and spring routes | The Woolly Coliseum |

All courses remain 15 km and retain a four-lane start and stadium finish. Each now has its own monotone elevation profile, sector names, obstacle placement rhythm, and pickup route. The forest/canyon/meadow choice is not just a background tint.

`src/game/courses.ts` contains their palettes and profiles. `src/game/scene.ts` precomputes a small elevation lookup table for each course. Queries take an explicit course ID; the engine, renderer, ground contacts, ramps, loops, pickups, and camera all use the selected table. The default profile remains available to the static machinery atlas builder.

## Quiet Dirt Surface

The racing surface is now a cached packed-earth texture with broad value patches, faint paired wheel ruts, sparse stones, and dashed chalk lane boundaries. Horizontal edges wrap, so the tile repeats without a new pattern seam. The exposed sides of gaps use dark earth layers rather than timber siding. Ramps, loops, slingshots, and spectator structures retain their goblin-engineered timber/iron identity.

The road is 960 simulation units across: four 240-unit lanes. The camera uses a 0.86 zoom factor, with the inverse pointer transform updated to match. Existing machinery atlases store their reference scale to avoid accidentally applying the zoom twice. The rear-loading start grid, lane collisions, and near/far occlusion remain intact.

## Blimps And Landmarks

Blimps are original cached airship illustrations with separate envelope, fins, gondola, and propeller details. They drift slowly in a background depth layer; reduced motion stops their decorative bob/drift. They do not collide, drop damage, block lanes, or change AI behavior.

Pines, quarry formations/smokestacks, and windmills are cached per-course sprites, anchored to the world terrain. Sky paintings, dirt, gap banks, landmarks, and blimps are created once per course and reused. All three cached themes are a bounded set; nothing grows with race distance.

## Air Supplies

Pickups use a readable symbol plus color. The same icons appear in the race HUD and handbook.

| Supply | Color And Symbol | Effect | Limits |
| --- | --- | --- | --- |
| Rocket Fuel | Amber lightning bolt | Refills one boost charge and gives a small forward surge | Boost stock remains capped at two; surge still works when full |
| Skyward Shield | Blue shield/check | Automatically absorbs the next rival bump, including its speed impulse and lane shove | One hit or six seconds; another shield refreshes, never stacks; no gap protection |
| Air Spring | Mint upward arrow/wings | Refills one air-bounce charge, used with Space | Bounce stock remains capped at three; a full stock still receives pickup chaos points |

Every pickup adds 75 player chaos points. A shield absorbed from a rival is tracked separately from successful rival bumps. The shield is removed on recovery. Its remaining duration and one-hit nature are shown in the HUD, with a ring around the protected capsule and a short break effect on impact.

## Placement And Fairness

- Low supplies sit above rolling reach and can be collected with a bunny hop.
- Higher supplies sit beyond selected ramps/springs and reward an airborne line.
- The opening launch includes one supply in each lane so players can see the system early.
- Pickups are not spawned inside loop rides. Ordinary low supply placements avoid nearby ground hazards.
- Pickups are shared, one-use objects. The first racer to touch a pickup gets it. They reset with the race/round; they do not respawn during a run.
- All four racers use the same collection radius and effects. A swept segment/sphere test prevents fast capsules from tunneling through supplies. When two racers could collect within one physics step, the earliest intersection wins, with racer order only breaking an exact tie.
- CPU drivers inspect nearby pickups through the same spatial buckets used for track look-ahead, value missing resources, and time ground hops for low supplies. No hidden pickup grants are used.
- Collection uses the same small vertical bob as rendering; reduced motion makes both static.

## Performance Boundaries

- No image downloads or mesh rebuilding are introduced during a race.
- Three course art bundles are cached, and three pickup icons are rasterized once.
- Road strips use 256-unit segments rather than the previous 128-unit segments, cutting normal road texture-mapping calls roughly in half before gap subdivisions.
- Pickups are bucketed for collision and culled for rendering. The candidate set is reused each physics step.
- Existing visibility overscan remains at both lateral extremes, including the widened road and distant stadiums.
- The race still uses fixed 120 Hz simulation, interpolated display frames, dynamic resolution, and paused/off-screen suspension.

## Verification Boundary

Source review checks course-specific queries, collection caps, shield consumption/expiry, per-round reset, shared collision rules, and render/collection positions. Production compilation is verified with the provided build tool. No live browser, device-FPS benchmark, or empirical pickup-route/loadout balance test is available in this environment.

Section 4 should include actual racing samples for each loadout/course, full event persistence, richer results, and final accessibility/performance checks. Equal stat budgets do not establish equal performance across these new routes.