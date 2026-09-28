# How a race works (as of the "next wave" tickets, 2026-09-25)

This is the race from the grid to the results, as the code runs it now. Each section names the
module that owns it; the deeper design notes live in the linked docs.

## 1. The grid and the push start

- **One start: the goblin push.** The slingshot is gone (M5). Space or Enter (or GO on a touch
  screen) calls `engine.start()`: the starter goblin shoves the whole field off the pad over
  `PUSH_TICKS` = 48 ticks (0.4 s), then the downhill does the rest (`sim/start-push.ts`). A brass
  horn plays (P9).
- Everyone begins resting on the pad (`grounded`). Height is always measured from the course under
  the ball (`track-space.ts`), never from the old flat slingshot ground (M5).
- Player input reaches the engine only through `engine.dispatch(command)`, which validates it
  against the T01 command gate first (M9, `contracts/commands.ts`). Keyboard, touch (H5) and
  gamepad (H10) all send the same commands.

## 2. The solo first split

- The player runs the first split **alone**. Rivals are not drawn (`hidden`) and take no part until
  the player reaches the split. Their own first-split times are simulated headlessly at reset
  (`sim/split-times.ts`, `simulateSplitTicks`), with `SPLIT_TIMEOUT_S` = 90 as the fallback.
- The gap chip and strip map (H9) stay off during the solo split.

## 3. The pool (the first-loop merge)

- At the merge gate the player enters the pool (`merge/pool.ts`), and every rival joins **ranked by
  its simulated split time**, so the queue and the release order are the field sorted by split.
  That rank is recorded as each rider's split place (P11).
- Held riders are frozen at the gate plane and glide sideways into their slot; the next
  `MERGE_LINEUP` = 4 line up in the loop's own lane. They are **drawn** queued up the hill, one row
  per ball per lane, two ball-widths apart (P7); the physics still holds them on the gate plane.
- The player readies up (Space / Enter / A on a pad / the overlay button). Riders are released in
  order at `MERGE_RELEASE_VX` = 700, intangible ("ghost") through the loop until
  `PASSAGE_GHOST_TAIL_S` = 0.75 s past its exit. The player is racing from their own release, and the
  horn sounds again (P9).
- Details: `docs/MERGE.md`, `docs/RELEASE.md`, `docs/STAGING.md`.

## 4. Racing: lanes, the rope, and contact

- **Lanes.** A ball follows its lane: an authored path in the lane network when there is one
  (`lane-network.ts`, `docs/LANE_NETWORK.md`), otherwise the legacy four lanes. Lane samples come
  from baked 50-unit lookup tables (H2b). An accepted lane change clunks (P9).
- **The rope.** Every ball is tied to its lane by a retractable rope (`sim/rope.ts`). A hit shoots the
  rope out: it pays out slack for `payoutS` = 0.6 s (the ball keeps its sideways speed and may reach
  the road edge), then reels the ball back by `reelS` = 1.7 s. A hit never changes which lane a
  ball belongs to. Steering yourself takes up the slack early; the reel still plays, with a ratchet
  (P9). Knocked into the tree line at the edge at `edgeSmashVz` = 220 or more is a smash: sparks, an
  impact and a splintering crack (P9). A ball grinding along the edge wall throws sparks (P6).
  In a dev build the three rope numbers can be tuned live from the test-drive bar (H7b).
- **Contact.** Balls touch at the drawn size (`BALL_DRAW_RADIUS * 2 + 4`): the balls are drawn at
  twice the physics radius (`BALL_DRAW_RADIUS = RADIUS * 2`), and contacts, pickup reach and hits
  use the drawn size (`docs/COLLISION.md`).
- **Hit feedback (H8).** A hit on the player's ball (a rival, scaled by closing speed and side; an
  obstacle, straight on) kicks the camera away from the hit, jolts the cockpit yoke, flinches the
  goblin's arms (P3), rumbles a gamepad (H10) and thuds. A big hit cracks the cockpit glass for a
  couple of seconds (P2). Reduced motion keeps a tenth of the kick and swaps the shudder for a flash.
- **CPU riders (H11)** use the same physics, chase boost pads and dodge gaps. They pick their shoves:
  a mass edge (rookies want 1.25×), never into a shield or a rider still immune, and veterans favour a
  rival with a gap just ahead. A shove into a rival's lane is telegraphed: the bot wobbles for 0.3 s
  (0.5 s for rookies) before it slams across, if the rival is still there.

## 5. The course

- **Loops are scenery.** The course's loops (`loop`, `lava_loop`) are drawn but removed from the
  physics layout (`sim/decor-loops.ts`): the ball rolls past them. No points for riding them.
- **Obstacles are drawn where the physics has them** (`obstacle-view.ts`): gaps, boost pads and
  ramps as road marks; sheep, TNT and springs as billboards; spinners, rock gates, water rocks,
  cauldrons and roller rails as tinted blocks. A TNT or sheep a ball has hit disappears.
- **Pickups** (fuel, shield, bounce) breathe, glint, and have a ring on the road and a shaft of
  light above them so they read from the cockpit (P10). Collection rules: `docs/WORLD_AND_POWERUPS.md`.
- **The pinball spinner** kicks left or right from a hash of (seed, tick, racer id) (M9), so the
  same seed and inputs replay the same race.
- **Out of bounds (H6).** Crossing an authored OOB node on a lane path hands the ball to the rope
  goblins: it is put back on its lane on that tick, held for 1 s while the rope-heave trio hauls it in
  (drawn easing back from where it went out), then released rolling at 180 or more.
- **Falls** off the course (gaps, lava, off the world) are recovered by the pit crew
  (`recoverRacer`), with a short immunity.

## 6. The HUD and the cameras

- Cameras: cockpit (default) or chase, switched with V; `[` and `]` step slow motion, and every
  sound follows the time scale (P9). The test-drive bar holds these buttons (P8).
- The cockpit shows position, the gap to the rider directly ahead (`+0.8 s to P36`, green when
  closing; H9), race time, shield, boosts and bounces, and speed. Fields over four also get a strip
  map along the top edge: a dot per racer, the player's ringed (H9).

## 7. The finish and the results

- A ball finishes when it passes `FINISH`; its finish time is interpolated inside the tick.
- The results table shows each rider's place, their **split place** with places gained or lost
  (`P14 ▲11`) and the **biggest climber** after the split (P11). Points and cup standings are
  unchanged by the split column. The results survive a reload (`save.ts`, `docs/PERSISTENCE.md`).

## Where to look

| Area | Module |
|---|---|
| Frame loop, input, bumps, pool orchestration | `src/game/engine.ts` |
| Per-racer physics step | `src/game/sim/racer-physics.ts` |
| CPU driver | `src/game/sim/cpu-driver.ts` |
| Rope | `src/game/sim/rope.ts` |
| Pool | `src/game/merge/pool.ts` |
| Placement (engine → world) | `src/game/track-space.ts` |
| 3D drawing | `src/game/renderer-3d.ts`, `obstacle-view.ts`, `pickup-view.ts`, `rope-reel-view.ts`, `effects/` |
| Cockpit | `src/game/cockpit.ts`, `src/components/CockpitHud.tsx` |
| Commands | `src/game/contracts/commands.ts` |
