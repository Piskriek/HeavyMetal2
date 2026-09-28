# C2: Back Up Track — Dynamic Safety Copies and Protect-Baseline Verification

- **ID**: `C2`
- **Priority**: Critical
- **Component**: Track Persistence / Safety Safeguards
- **Conflicts with**: `M12` (both touch `track-builder-3d.ts` backup logic)
- **Needs art**: No

---

## Goal
The live track currently contains 523 props (`backups/props/track-props-latest.json`), but safety backups in `backups/props/user_safety_backup/` stop at 237 props (`track-props-237-props-safeguard.json`), and `scripts/protect-baseline.mjs` reports "BLOCKER: no authorised snapshot of these bytes has been captured yet." Update the track builder's auto-backup (`track-builder-3d.ts:backupToFile`) to automatically create an incremental user safety copy whenever the placed prop count grows past the previous safety watermark, run `npm run protect:baseline` to authorize the current 523-prop track state, and add `tests/protect-baseline.test.ts` to `scripts/check.mjs` with cross-platform Windows path compatibility.

---

## Evidence
- `backups/props/user_safety_backup/`: Highest safety backup is `track-props-237-props-safeguard.json` (94,867 bytes, 237 props), despite live track having 523 props in `backups/props/track-props-latest.json` (296,759 bytes).
- `src/game/track-builder-3d.ts:3628-3660`: `backupToFile` posts only to `/api/backup-props` which overwrites `track-props-latest.json` and writes rolling history, but does not check or trigger milestone safety copies in `user_safety_backup/` when prop counts increase.
- `scripts/check.mjs:20-63`: Does not invoke `tests/protect-baseline.test.ts`.
- `tests/protect-baseline.test.ts:184`: Hardcoded UNIX forward-slash assertion `manifest.json` fails on Windows path separators, and symlink tests require elevated permissions on Windows without graceful skip.

---

## Solution
1. **Authorize Baseline Snapshot**:
   - Execute `npm run protect:baseline` to create an authorized manifest snapshot matching the live 523-prop `track-props-latest.json`.
2. **Auto-Backup Safety Milestones**:
   - In `src/game/track-builder-3d.ts` (or the server endpoint in `vite.config.ts`), when saving props, inspect current prop count against highest safety backup count.
   - When prop count grows beyond the highest safety backup (or in increments of 10+ props), write a timestamped safety copy to `backups/props/user_safety_backup/track-props-<COUNT>-props-safeguard.json`.
3. **Cross-Platform Test & Check Script**:
   - In `tests/protect-baseline.test.ts`, normalize path separators with `path.normalize()` or replace backslashes so Windows paths match assertion expectations. Wrap symlink test cases in a capability check or skip when `EPERM` occurs on unprivileged Windows shells.
   - Add `tests/protect-baseline.test.ts` to the test list in `scripts/check.mjs`.

### Files Allowed to Change
- `src/game/track-builder-3d.ts`
- `vite.config.ts`
- `scripts/check.mjs`
- `tests/protect-baseline.test.ts`
- `baseline/snapshots/**`
- `backups/props/user_safety_backup/**`

### Must NOT Change
- `backups/props/track-props-default.json`
- `public/presets/track-props-default.json`
- The core validation rules in `scripts/protect-baseline.mjs`.

---

## Acceptance Criteria
- [ ] `npm run inventory:baseline` reports an authorized snapshot for `backups/props/track-props-latest.json` (523 props) without blocker errors.
- [ ] Saving track props in the builder when prop count increases automatically generates a corresponding `track-props-<COUNT>-props-safeguard.json` in `backups/props/user_safety_backup/`.
- [ ] `node --import tsx --test tests/protect-baseline.test.ts` passes cleanly on Windows and POSIX environments.
- [ ] `node scripts/check.mjs` runs `tests/protect-baseline.test.ts` as part of the standard test suite.

---

## Tests to Run
- `node --import tsx --test tests/protect-baseline.test.ts`
- `node scripts/check.mjs`
- `npm run inventory:baseline`
