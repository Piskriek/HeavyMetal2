# M13: Repository Cleanup — Remove Root Artifacts and Update .gitignore

- **ID**: `M13`
- **Priority**: Medium
- **Component**: Repository Hygiene / Version Control
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The repository root currently contains clutter and temporary development artifacts: 283 tracked files inside `tmp-art/`, large legacy planning ZIP archives (`hm2.zip` at 27 MB, `goblin-racer-planning-request *.zip`), unorganized root screenshots (`p00.png` through `p12.png`), and a stale `handoff.md`. Clean up the repository root by removing obsolete archives and temporary test files, relocating useful historical notes to `docs/archive/`, and updating `.gitignore` to prevent future temporary artifacts from being committed.

---

## Evidence
- Repository root currently contains:
  - `tmp-art/` (directory containing hundreds of unkeyed image scraps and temporary experiments)
  - `hm2.zip` (26.98 MB binary zip)
  - `goblin-racer-planning-request Olow.zip` (646 KB)
  - `goblin-racer-planning-request opsu5.zip` (354 KB)
  - `p00.png`, `p01.png`, `p02.png`, `p10.png`, `p11.png`, `p12.png` (root-level scratch screenshots)
  - `handoff.md` (60.6 KB stale root handoff document)
- `.gitignore`: Does not currently ignore `*.zip`, `tmp-art/`, or scratch `p*.png` image files.

---

## Solution
1. **Remove Transient and Large Binary Files**:
   - Remove `hm2.zip`, `goblin-racer-planning-request Olow.zip`, and `goblin-racer-planning-request opsu5.zip` from git tracking.
   - Remove `p00.png`, `p01.png`, `p02.png`, `p10.png`, `p11.png`, `p12.png` from root.
   - Delete `tmp-art/` directory and untrack all files within it.
2. **Relocate Documentation**:
   - Move or archive `handoff.md` to `docs/archive/handoff-legacy.md` if any historical reference is required, or clean it up.
3. **Update `.gitignore`**:
   - Add rules to `.gitignore`:
     ```gitignore
     *.zip
     tmp-art/
     p[0-9][0-9].png
     scratch/
     ```

### Files Allowed to Change
- `.gitignore`
- Deletion of root binary/image files: `hm2.zip`, `*.zip`, `p*.png`, `tmp-art/**`

### Must NOT Change
- Production assets under `public/art/` or `art-src/`
- Track configurations and code in `src/`

---

## Acceptance Criteria
- [ ] Root directory is clean of loose `.zip` archives, `p*.png` images, and `tmp-art/`.
- [ ] Repository size is reduced by over 28 MB.
- [ ] `.gitignore` prevents re-committing `.zip` files and scratch screenshots.
- [ ] `npm run check` continues to pass with zero issues.

---

## Tests to Run
- `git status`
- `node scripts/check.mjs`
