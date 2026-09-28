# MP-T14: Deterministic Math Layer & Cross-Engine Replay CI

- **ID**: `MP-T14`
- **Priority**: Critical (Phase A / Sim Integrity)
- **Track**: Deterministic Simulation & CI
- **Estimate**: 4 days
- **Dependencies**: `MP-T01`
- **Target Files**: `src/game/sim/deterministic-math.ts`, `tests/cross-engine-determinism.test.ts`, `scripts/check-transcendentals.mjs`

---

## Goal
Eliminate cross-engine floating-point divergence by replacing implementation-defined JavaScript transcendental functions (`Math.sin`, `Math.cos`, `Math.pow`) with deterministic, IEEE-754 correctly-rounded polynomial approximations. Establish CI verification across V8, SpiderMonkey, and JavaScriptCore.

---

## Technical Specification

### 1. Transcendental-Free Math Library
- Replace `Math.sin` and `Math.cos` with Chebyshev 7th-degree polynomial approximations using only `+`, `-`, `*`, `/`, and `sqrt` (which IEEE-754 guarantees to be correctly rounded).
- Use precomputed high-resolution lookup tables for track spline curvature and lane positions.

### 2. AST Linter Rule
- Add custom linter script (`scripts/check-transcendentals.mjs`) that forbids direct calls to native `Math.sin/cos/tan/pow/exp` inside `src/game/sim/**`.

### 3. Cross-Engine Playwright CI Test
- Run 100 recorded race input streams in Node (V8), Chromium (V8), Firefox (SpiderMonkey), and WebKit (JavaScriptCore) using Playwright.
- Hash racer state vectors every 120 ticks; assert 100% bit-exact hash equivalence across all engines.

---

## Acceptance Criteria
- [ ] `scripts/check-transcendentals.mjs` reports 0 disallowed `Math` calls in the physics sim.
- [ ] Polynomial approximations evaluate within `1e-7` of reference doubles.
- [ ] 100 recorded race replays achieve bit-exact state hash matches across V8, SpiderMonkey, and JavaScriptCore.

---

## Tests to Run
`node scripts/check-transcendentals.mjs`
`node --import tsx --test tests/cross-engine-determinism.test.ts`
