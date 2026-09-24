# M01 · T6 — The Lane Network

> Interfaces `IF-LANES` / `IF-LANESTORE` · Modules `src/game/lane-network.ts`, `src/game/lane-storage.ts` · Doc page for T6

## Overview

The game has always steered in `z` towards **one of four fixed lane centres**, clamped to a fixed
corridor. T6 generalises that to a **network of authored paths**: nodes placed in engine space
(`x`, lateral `z`), paths that are ordered runs of nodes with strictly increasing `x`, and three node
kinds that say what happens where paths meet — `merge`, `split` and `oob` (out of bounds).

Everything the runtime needs is decided by one law, and it is the reason this ticket is safe to land
before the builder exists:

> **A null network is exactly the old game.** `resolveLaneTarget` is the single integration point
> (decision **D12**). With `null` it returns `laneZ(targetLane)` and the legacy corridor, character
> for character, so every tuned handling value and every parity fingerprint is untouched.

`tests/lane-parity.test.ts` holds that law to account: **50 seeded full races**, each one driven twice,
once with `laneNetwork` absent and once with it `null`, comparing a digest of every racer's position,
lane and speed at the end of every second *plus the finish tick of each ball*. All 50 pairs are
identical, and the two controls keep the claim honest — 50 different seeds all fingerprint
differently, and a deliberately narrow authored network visibly changes the race.

Two supporting laws keep the module cheap to reason about:

1. **Engine space, not world space.** Physics steers in `z`, and engine space is what
   `placementFromEngine` consumes, so authoring here means an edit cannot desync physics from paint.
   Altitude is always taken from the surface.
2. **Pure TypeScript.** No DOM, no canvas, no three.js, no React — in `lane-network.ts`, in
   `lane-storage.ts` (which only ever touches the `Storage` it is handed), and therefore in the tests.

## Files

| Piece | Responsibility |
| --- | --- |
| `src/game/lane-network.ts` | The model: schema, `validateLaneNetwork`, `inferKind`, `sampleLane`, `corridorAt`, `adjacentPath`, `successorPath`, `nearestPath`, `oobCrossed`, `resolveLaneTarget`, and the sample ridge network. |
| `src/game/lane-storage.ts` | `hm2-lane-paths-v1`: read, validate, back up, write, restore, export, import. |
| `src/game/sim/context.ts` | `RacerStepContext.laneNetwork?: LaneNetwork \| null` (absent ≡ `null`) and the `'oob'` recovery reason. |
| `src/game/sim/racer-physics.ts` | Steering target and clamp from `resolveLaneTarget`; the swept OOB test; a path-aware `recoverRacer`. |
| `src/game/sim/cpu-driver.ts` | `laneCandidates()` / `setCandidate()`: the bot aims at path centres, not lane numbers. |
| `src/game/engine.ts` | Per-course load, live context, path-aware `changeLane` and `shove`, adoption, the builder's API. |
| `src/game/racers.ts`, `src/game/qualifying/field.ts` | `Racer.pathId: string \| null`. |
| `vite.config.ts` | `POST /api/backup-lane-paths` — the dev mirror, in its own directory. |

## The document

```jsonc
{
  "version": 1,
  "course": "ridge",
  "nodes": [
    { "id": "start", "x": 190,  "z": 360, "kind": "normal" },  // engine x, lateral z
    { "id": "grid",  "x": 6000, "z": 360, "kind": "split"  },  // one line becomes four
    { "id": "loop",  "x": 38000,"z": 360, "kind": "merge"  },  // four become one
    { "id": "spur",  "x": 68000,"z": 0,   "kind": "oob"    }   // touching this is out of bounds
  ],
  "paths": [
    { "id": "spine", "name": "Ridge spine", "nodeIds": ["start", "grid"], "halfWidth": 120 }
  ]
}
```

* `version` and `course` are both checked: a network belongs to a course, and `sampleLaneNetwork()`
  builds the sample for the one the builder was opened on.
* Nodes are addressed by `id`. Two nodes may not share one, and a path may not reference one that
  does not exist.
* `x` must be inside `START_X .. FINISH`; `z` inside `±LANE_Z_LIMIT` (443 = the `LANE` corridor less
  one ball of clearance). Altitude is never authored — it comes from the surface.
* Node order inside a path is the driving order and must be **strictly increasing in x**. That is the
  `non_monotone` refusal: without it, sampling has no single answer.
* `halfWidth` is 40..240, defaulting to `DEFAULT_HALF_WIDTH` (120 — one lane, decision **D11**).
* Unknown fields on the document, on a node and on a path are preserved verbatim through validation,
  storage and export. The builder can keep its own notes there.

## Refusals

`validateLaneNetwork` never throws, and the builder shows exactly these codes:

| Code | What was wrong | Carries |
| --- | --- | --- |
| `duplicate_id` | Two nodes, or two paths, with the same id (or none at all). | `id` |
| `unknown_node` | A path references a node that is not in the document. | `pathId`, `nodeId` |
| `too_few_nodes` | A path with fewer than two nodes. | `pathId` |
| `non_monotone` | A path listing nodes in an order that does not increase in x. | `pathId`, `nodeId` |
| `out_of_corridor` | A node outside `START_X..FINISH`, `±LANE_Z_LIMIT`, or with a non-finite x/z. | `nodeId` |
| `kind_mismatch` | The authored kind disagrees with the topology (or the entry is not a node/path at all). | `nodeId`, `expected` |
| `bad_half_width` | `halfWidth` outside 40..240, or not a number. | `pathId` |

A document that is not a network at all — `null`, a number, a string, an object without `nodes`/
`paths`, the wrong `version`, an unknown `course` — is `kind_mismatch` with `nodeId: ''`.

## Topology

A node's kind is not merely declared, it is **inferred from the graph** and the two must agree:

| Inferred | Rule |
| --- | --- |
| `merge` | Ends ≥ 2 paths and starts 1. |
| `split` | Ends 1 path and starts ≥ 2. |
| `oob` | Starts no path, ends one, and that path ends before the finish line. |
| `normal` | Anything else, including the flag itself. |
| `orphan` | No path references the node at all: an authored spare, not an error. |

That is `inferKind`. A node that disagrees is refused with the kind it should have been, which is the
whole reason the builder can offer a "fix kinds" button.

## Sampling and the corridor

`sampleLane(network, pathId, x)` interpolates **linearly in x** between the two nodes that bracket it
and returns `null` outside the path. `corridorAt(network, x)` unions every active path's
`[z − halfWidth, z + halfWidth]`, clipped to `±LANE_Z_LIMIT`; `null` where no path is active.

`resolveLaneTarget(racer, network)` is the one call the physics makes:

* `network` null → `laneZ(targetLane)` and the legacy corridor (`LANE.near + RADIUS + 6` ..
  `LANE.far − RADIUS − 6`), byte-for-byte what the game did before T6;
* racer with `pathId === null` → the same, so a racer still on the grid or put back by the crew is
  never worse off than before;
* racer on a path that is not active at this `x` → the same fallback, one tick long;
* otherwise → the path's own centre at `x`, clamped into the corridor union.

The **PD spring and the steer-lock cut are untouched**: only `targetZ`, `zMin` and `zMax` change.
Physics stays fixed-step at 120 Hz.

## Movement

`adjacentPath(network, pathId, x, dir)` is the lane-change primitive, and it keeps the game's lane
convention: **`dir = +1` is toward smaller `z`** (the direction `targetLane + 1` has always moved in).
It returns the nearest path centre on that side **that exists at this `x`**, so a merge naturally
closes the option of moving anywhere.

`successorPath(network, pathId, z, bias)` answers what happens at the end of a path:

* a `merge` node → the single outgoing path, whichever path you arrived on;
* a `split` node → one of the branches. `bias = +1` picks the smaller-z branch, `bias = −1` the
  larger-z one, and `bias = 0` (no input that tick) picks the branch whose centre is nearest at that
  moment;
* an `oob` node → `null`: the path simply stops, and the crew is the next thing you meet;
* the flag → `null`, a normal end.

The split case is why `successorPath` **samples each branch ~400 px past the junction** rather than
at the node itself: at the junction every branch shares the same point, so a score taken there cannot
tell them apart. Probed downstream, the two biases pick the two branches reliably — this was a real
bug the probe caught, not a hypothetical one.

## Out of bounds

An `oob` node is a node the author says a ball should never reach. The physics tests the swept step —
`oobCrossed(network, pathId, prevX, x)` fires when `prevX < node.x ≤ x` — **before** the finish block,
and calls `recoverRacer(racer, ctx, 'oob', trace)` with the node id in `trace.oobNode`. A racer is
recovered exactly on the crossing tick, once: the field is `prevX`-gated so no tick can fire it twice.

`recoverRacer` is path-aware as well: it looks for the nearest gap-free **path centre** instead of the
nearest lane centre, checking at `x` and `x + 110` exactly as the legacy version did, and falls back
to the legacy four-lane walk when there is no network or no path is near.

## The CPU, the shove, and the engine API

* `laneCandidates(racer, network)` returns the racer's own path plus the paths either side at the
  current x, each with its centre `z` — the same list the legacy code built from `lane ± 1`, sorted
  the same way (descending `z`). `setCandidate()` commits path and lane together and stamps
  `lastLaneChange`.
* `engine.changeLane(direction)` steps `−sign(direction)` in lane-number space as before, then asks
  `adjacentPath` whether that neighbour exists at this x. `shove` does the same, in the shove
  direction, and stays put if there is nothing to be shoved onto.
* `engine.adoptPaths()` runs once per tick, before anything is driven: a racer with
  `pathId === null` is put on the nearest path at its current position. The grid sits at
  `x = START_X` and the sample network starts there too, so a field is on its paths from the lights;
  but a network authored to begin further down the hill leaves the start line alone rather than
  snapping anyone across the track. `assignNearestPaths` is the blunt version, used when a network is
  loaded or replaced.
* The builder's entry points are `get lanePaths()`, `setLaneNetwork(network | null)` (a "test drive"
  reads it live through `simCtx`), `laneDocument()` and `laneDocumentValid()`.

## Storage

`src/game/lane-storage.ts` keeps one document per browser under `hm2-lane-paths-v1`, with a
`hm2-lane-paths-v1-backup` sibling. The rules are `track-storage.ts`'s rules, restated for networks
because the two documents must never share a key or a shape:

* **validated before write** — every course in the document goes through `validateLaneNetwork`;
* **backup first** — the current document is copied to the backup key before the new one lands, so a
  bad save is recoverable with `restoreLaneBackup()`;
* **unknown fields survive** — document, network, node and path all carry what they did not
  understand;
* **quota is reported, not thrown** — `{ ok: false, reason: 'quotaExceeded' }`, and a refused write
  leaves the previous document readable;
* **per-course independence** — a course whose entry does not validate is dropped while its
  neighbours are kept, and `loadLaneNetwork(course)` simply returns `null` (the legacy lanes) for it;
* **import is validated** — `importLaneNetworks(json)` refuses anything the runtime would refuse,
  including a JSON syntax error (reported as `kind_mismatch`).

The dev mirror is `POST /api/backup-lane-paths` in `vite.config.ts`: it writes
`backups/lane-paths/lane-paths-latest.json` plus a history entry, and **refuses to overwrite a
document with less than 75 % of the nodes the stored one has**. It never touches `backups/props/`,
which stays protected.

## Builder checklist (T7)

What the tool has to provide, in the words of the ticket — `lane-network.ts` is the model for it:

* drag node handles on the track surface (engine `x`, lateral `z`), snapping to lane centres ±30 and a
  50-unit x grid, refusing any move that breaks monotone x;
* insert a node on the hovered segment, delete a node, and cycle a node's kind;
* split from a selected node, merge a path end into the next clicked node, and mark a path's end
  `oob`;
* a validation list driven by `validateLaneNetwork`, with Save disabled while it is non-empty and
  clicking an error focusing the offending node;
* one undo stack covering props and lanes, Save/Export/Import through `lane-storage.ts`, and a
  "test drive" that restarts the race with the edited network.

## Verification

```sh
npm run check                                        # everything, including the three suites below
node --import tsx --test tests/lane-network.test.ts tests/lane-storage.test.ts tests/lane-parity.test.ts
```

* `tests/lane-network.test.ts` — refusal codes (seven crafted documents plus six that are not
  networks at all), kind inference over the sample, sampling continuity in 25-unit steps with the
  node values landing exactly, the corridor union and its clip, adjacency and successors including
  both split biases, `resolveLaneTarget` null-parity, and the OOB crossing driven through the **real
  physics step** — the node id, the crossing tick and `recoveryReason === 'oob'` all come out of
  `stepRacer`.
* `tests/lane-storage.test.ts` — round trip with unknown fields at every level, backup-then-write and
  restore, an invalid save leaving the previous document untouched, quota reported rather than
  thrown (including a storage that throws on every call), one bad course not taking the others down,
  import/export validation, and a structural check on the dev mirror.
* `tests/lane-parity.test.ts` — the 50-seed full-race parity described at the top, with its two
  controls.

`scratch/lane-probe*.ts` are the throwaway probes that found the split bug; they are not part of the
build and `scratch/` is ignored.

## Not in this ticket

* **The builder tool itself** — T7.
* **Re-dressing `environment.ts` to follow authored lanes.** The world still paints the legacy
  corridor; a network is physics and logic until the dressing ticket catches up.
* **Curved (spline) segments.** Paths interpolate linearly in x; a spline would change the sampling
  contract and the monotone-x refusal.
* **Right-of-way at merges.** Ordering is the merge pool's job (T2) and the shove's; a merge node
  closes lane options and nothing else.
