# H12: Include Passing Test Suites in Check Script and Add Check:Slow

- **ID**: `H12`
- **Priority**: High
- **Component**: CI / Test Automation / Quality Assurance
- **Conflicts with**: `C2` (both touch `scripts/check.mjs`)
- **Needs art**: No

---

## Goal
Several critical test suites—`tests/accessibility.test.ts`, `tests/racer-pool.test.ts`, `tests/roster-scale.test.ts`, and `tests/integration-benchmarks.test.ts`—currently pass cleanly when invoked directly, but are omitted from `scripts/check.mjs`. Add these suites to the standard `scripts/check.mjs` verification pass, and introduce a dedicated npm script `npm run check:slow` in `package.json` to execute long-running endurance tests (`tests/soak.test.ts`) without burdening the regular development feedback loop.

---

## Evidence
- `scripts/check.mjs:20-63`: Contains a list of 52 test files, but explicitly omits:
  - `tests/accessibility.test.ts` (7,087 bytes, asserts ARIA labels, contrast, focus states)
  - `tests/racer-pool.test.ts` (4,591 bytes, tests pool admission and release ordering)
  - `tests/roster-scale.test.ts` (22,469 bytes, validates large field scalability 20/50/100)
  - `tests/integration-benchmarks.test.ts` (22,140 bytes, performance benchmarks)
- `package.json:6-26`: Has scripts for `check`, `check:edges`, `check:art`, etc., but lacks a `check:slow` script for `tests/soak.test.ts` (which tests 100+ consecutive laps for memory leaks).

---

## Solution
1. **Update `scripts/check.mjs`**:
   - Append to the test arguments array in `commands`:
     - `'tests/accessibility.test.ts'`
     - `'tests/racer-pool.test.ts'`
     - `'tests/roster-scale.test.ts'`
     - `'tests/integration-benchmarks.test.ts'`
   - Verify that all four suites execute and exit code 0.
2. **Add `check:slow` in `package.json`**:
   - Add script entry:
     ```json
     "check:slow": "node --import tsx --test tests/soak.test.ts"
     ```
   - Document usage in `README.md`.

### Files Allowed to Change
- `scripts/check.mjs`
- `package.json`
- `README.md`

### Must NOT Change
- Test logic inside `tests/accessibility.test.ts`, `tests/racer-pool.test.ts`, `tests/roster-scale.test.ts`, or `tests/soak.test.ts`

---

## Acceptance Criteria
- [ ] Running `node scripts/check.mjs` runs `accessibility`, `racer-pool`, `roster-scale`, and `integration-benchmarks` suites and passes cleanly.
- [ ] Running `npm run check:slow` executes `tests/soak.test.ts` without errors.
- [ ] Total passing tests reported by `npm run check` increases from 740 to over 850.

---

## Tests to Run
- `node --import tsx --test tests/accessibility.test.ts`
- `node --import tsx --test tests/racer-pool.test.ts`
- `node --import tsx --test tests/roster-scale.test.ts`
- `node --import tsx --test tests/integration-benchmarks.test.ts`
- `node scripts/check.mjs`
- `npm run check:slow`
