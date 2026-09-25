# H2b: Bake Lane Paths into O(1) Lookup Tables

- **ID**: `H2b`
- **Priority**: High
- **Component**: Lane Network / Simulation Performance
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
Currently, `sampleLane` performs an $O(\log N)$ binary search across path nodes on every query, and `corridorAt` loops over all network paths to call `sampleLane`, adding up to tens of thousands of searches per second with large fields (100 racers). Pre-bake each lane path into an $O(1)$ spatial lookup table sampled every 50 engine units along $X$, dramatically reducing per-tick simulation overhead during 100-racer heats while guaranteeing numerical parity within 1e-4 units.

---

## Evidence
- `src/game/lane-network.ts:285-308`: `sampleLane(network, pathId, x)` performs a binary search (`while (hi - lo > 1)`) over nodes on every single query.
- `src/game/lane-network.ts:318-328`: `corridorAt(network, x)` iterates through every path in `network.paths` and calls `sampleLane` for each one.
- `src/game/sim/racer-physics.ts:413-417`: In every physics tick (60–120 Hz), every active racer evaluates `resolveLaneTarget`, which calls `sampleLane` and `corridorAt`. With 100 racers, this produces ~10,000–20,000 binary searches every second.

---

## Solution
1. **Pre-compute Path Sample Tables**:
   - In `src/game/lane-network.ts`, define a lookup table cache structure on `LaneNetwork` (or associated cache map) containing pre-sampled arrays for each path:
     - Step size: 50 engine units.
     - Origin: $X = \text{START\_X}$ (or path start $X$).
     - Values stored per entry: `{ z: number, halfWidth: number }`.
2. **O(1) Sampling with Linear Interpolation**:
   - In `sampleLane`, calculate index $i = \lfloor(x - x_0) / 50\rfloor$. If within bounds, lerp between table entries $i$ and $i+1$ in $O(1)$ constant time.
   - Retain binary search fallback if lookup table has not been initialized or during network editing.
3. **Invalidation on Network Mutation**:
   - Ensure cache is populated in `validateLaneNetwork` / `setLaneNetwork` / `applyLaneEdit` and cleared when nodes/paths move or change dimensions.
4. **Benchmarking**:
   - Measure execution duration of 1,000 simulation steps with 100 racers before and after optimization to prove latency reduction.

### Files Allowed to Change
- `src/game/lane-network.ts`
- `tests/lane-network.test.ts`
- `tests/integration-benchmarks.test.ts`

### Must NOT Change
- Authoring schema in `src/game/lane-storage.ts`
- Topological contracts (`merge`, `split`, `oob`)

---

## Acceptance Criteria
- [ ] `sampleLane` retrieves interpolated $(z, \text{halfWidth})$ in $O(1)$ time via 50-unit sampled tables.
- [ ] Results from baked lookup tables match direct node interpolation within a tolerance of $\le 0.001$ units.
- [ ] `tests/integration-benchmarks.test.ts` passes and demonstrates measurable speedup under 100-racer simulation.
- [ ] All existing lane network tests (`tests/lane-network.test.ts`, `tests/lane-parity.test.ts`) pass without regression.

---

## Tests to Run
- `node --import tsx --test tests/lane-network.test.ts`
- `node --import tsx --test tests/lane-parity.test.ts`
- `node --import tsx --test tests/integration-benchmarks.test.ts`
