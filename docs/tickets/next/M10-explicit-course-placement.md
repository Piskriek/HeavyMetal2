# M10: Eliminate Module-Global Course State in Track-Space Placement

- **ID**: `M10`
- **Priority**: Medium
- **Component**: Track-Space Architecture / Functional Purity
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
In `src/game/track-space.ts`, the course identifier defaults to a mutable module-global variable `let engineCourse: CourseId = 'ridge'` via `setEngineCourse()`, creating implicit cross-module coupling and risks of desynchronization when multiple courses or preview renders are evaluated concurrently. Remove `setEngineCourse()` and require `course: CourseId` to be passed explicitly into all `placementFromEngine` and canonical transformation calls across `renderer-3d.ts`, `pickup-view.ts`, and `effects/renderer-fx.ts`.

---

## Evidence
- `src/game/track-space.ts:941-956`:
  ```typescript
  let engineCourse: CourseId = 'ridge';
  export function setEngineCourse(course: CourseId): void { engineCourse = course; }
  ```
  Global module-level mutable state that can be overwritten by any caller, creating race conditions and impure side-effects.
- `src/game/renderer-3d.ts:1997-2001`: Calls `placementFromEngine(this.space, { ... }, rampSurfaces)` without passing `course` explicitly, relying implicitly on whatever course was previously set via global mutation.

---

## Solution
1. **Refactor `placementFromEngine` Signature**:
   - In `src/game/track-space.ts`:
     - Update signature to require `course: CourseId`:
       ```typescript
       export function placementFromEngine(
         map: TrackSpaceMap,
         state: EngineRacerState,
         ramps: readonly PhysicalRampSurface[] = [],
         course: CourseId,
       ): WorldPlacement
       ```
     - Remove `let engineCourse` and `export function setEngineCourse()`.
2. **Update All Call Sites**:
   - In `src/game/renderer-3d.ts`: Pass `frame.options.course` (or `this.courseId`) to `placementFromEngine`.
   - In `src/game/pickup-view.ts`: Pass `course` explicitly to placement helpers.
   - In `src/game/effects/renderer-fx.ts`: Pass `course` explicitly.
3. **Update Test Harnesses**:
   - Update `tests/track-space.test.ts` and `tests/placement-course.test.ts` to pass `course` directly into placement fixtures.

### Files Allowed to Change
- `src/game/track-space.ts`
- `src/game/renderer-3d.ts`
- `src/game/pickup-view.ts`
- `src/game/effects/renderer-fx.ts`
- `tests/track-space.test.ts`
- `tests/placement-course.test.ts`

### Must NOT Change
- Physical mathematical formulas in `worldFromCanonical`

---

## Acceptance Criteria
- [ ] `track-space.ts` contains no module-global `engineCourse` variable or `setEngineCourse` function.
- [ ] Every call to `placementFromEngine` passes the active `course: CourseId` explicitly.
- [ ] `tests/track-space.test.ts` and `tests/placement-course.test.ts` pass cleanly.
- [ ] 3D rendering across all three biomes (`ridge`, `boomtown`, `sheep`) renders elevation and surface alignment correctly.

---

## Tests to Run
- `node --import tsx --test tests/track-space.test.ts`
- `node --import tsx --test tests/placement-course.test.ts`
- `node scripts/check.mjs`
