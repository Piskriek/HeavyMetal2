# M14: Comprehensive Game Architecture Guide (docs/RACE.md)

- **ID**: `M14`
- **Priority**: Medium
- **Component**: Developer Documentation / Technical Specifications
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The mechanics, simulation pipeline, and architectural contracts of Heavy Metal GP 2 have evolved substantially through recent epics (solo first split, pool merge gates, lane rope elasticity, timber loops as 3D scenery, 2.5x ball scaling, obstacle markers, and cockpit viewports), but no single canonical technical document exists explaining the full end-to-end race lifecycle. Author `docs/RACE.md` as the definitive technical reference explaining how races operate from staging to finish.

---

## Evidence
- `docs/RACE.md`: Currently does not exist.
- New coding agents must piece together race rules from disparate files (`engine.ts`, `racer-physics.ts`, `lane-network.ts`, `pool.ts`, `track-space.ts`, `renderer-3d.ts`).
- Complex systems (e.g. why the player runs the first split alone and why loops are visual scenery rather than physics circles) lack centralized architectural documentation.

---

## Solution
Create `docs/RACE.md` covering the following sections:
1. **The Race Lifecycle**:
   - Staging countdown $\rightarrow$ Starter Goblin Push $\rightarrow$ Solo First Split $\rightarrow$ Loop Merge Gate Pool $\rightarrow$ Pack Release $\rightarrow$ Multi-Rider Race $\rightarrow$ Breakthrough $\rightarrow$ Stadium Finish.
2. **Lane Networks and Path Topologies**:
   - Authored spline paths, half-widths, dynamic corridor calculation, and topological node kinds (`normal`, `merge`, `split`, `oob`).
3. **The Lane Rope Collision Model**:
   - How marbles stay anchored to their authored paths via retractable elastic ropes.
   - Payout slack duration (`ROPE_PAYOUT_S`), smoothstep reel-in (`ROPE_REEL_S`), and tree-line bounce (`EDGE_SMASH_VZ`).
4. **Visual Scenery vs Collision Entities**:
   - Roller coaster loops as towering 3D spectator scenery.
   - 2.5x marble scale versus goblin driver proportions.
   - Billboards, obstacles, and powerup markers.
5. **Camera and Cockpit Systems**:
   - Dual-camera rig: First-person eye-level cockpit viewport with animated goblin arms and working dials vs chase camera.

### Files Allowed to Change
- `docs/RACE.md` (new file)
- `README.md` (link to new doc)

### Must NOT Change
- Any runtime source code or game logic

---

## Acceptance Criteria
- [ ] `docs/RACE.md` is authored with clear explanations, architectural diagrams (ASCII or Mermaid), and code file references.
- [ ] Explains solo first split, merge pool logic, lane rope physics, 2.5x ball scaling, and dual camera modes accurately.
- [ ] Referenced by root `README.md`.

---

## Tests to Run
- Manual review of markdown formatting
