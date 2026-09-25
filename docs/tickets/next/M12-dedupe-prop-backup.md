# M12: Deduplicate Auto-Backup Writes Based on Content Hash

- **ID**: `M12`
- **Priority**: Medium
- **Component**: Track Persistence / Disk I/O / Auto-Backup
- **Conflicts with**: `C2`, `M8` (both touch `track-builder-3d.ts` backup logic)
- **Needs art**: No

---

## Goal
The track builder's auto-backup service in `src/game/track-builder-3d.ts:3628-3660` currently fires every 15–30 seconds unconditionally whenever the editor is open, rewriting `backups/props/track-props-latest.json` and generating redundant history snapshot files even when no props have been added, moved, rotated, scaled, or deleted. Implement content-based hash caching so that automatic background backups execute only when the track's props document has actually changed.

---

## Evidence
- `src/game/track-builder-3d.ts:3628-3645`:
  ```typescript
  async backupToFile(force = false): Promise<{ success: boolean; count: number; timestamp: number } | null> {
    if (typeof fetch === 'undefined') return null;
    const now = Date.now();
    if (!force && this.lastBackupTimestamp && now - this.lastBackupTimestamp < 15000) return null;
  ```
  The only check is `now - this.lastBackupTimestamp < 15000`. If an author is simply viewing the course or flying around in camera mode, a POST request is sent every 30 seconds regardless, flooding `backups/props/history/` with duplicate files and causing continuous disk I/O.
- Over 37 duplicate history files currently exist in `backups/props/history/` for identical track layouts.

---

## Solution
1. **Content Fingerprint Caching**:
   - In `TrackBuilder3D`, maintain `private lastSavedPropsHash: string = ''`.
   - Before executing `backupToFile(force)`:
     - Compute a fast content fingerprint of `this.placedProps` (e.g. SHA-256 or fast 32-bit FNV-1a hash over sorted prop IDs and coordinates).
     - If `!force && hash === this.lastSavedPropsHash`, skip the write entirely and return `{ success: true, count: this.placedProps.length, timestamp: this.lastBackupTimestamp, unchanged: true }`.
2. **Update on Mutation**:
   - When props are added, deleted, or committed via gizmo transform, clear `lastSavedPropsHash` or mark a dirty flag.
   - When backup succeeds, store `this.lastSavedPropsHash = currentHash`.
3. **Explicit Force Save**:
   - When the user explicitly clicks "Save" or exports, `force = true` overrides the hash check.

### Files Allowed to Change
- `src/game/track-builder-3d.ts`
- `tests/track-props-backup.test.ts`

### Must NOT Change
- Schema of payload sent to `/api/backup-props`

---

## Acceptance Criteria
- [ ] Leaving the track builder open and idle for several minutes generates zero network POST requests or disk history writes.
- [ ] Moving, adding, or deleting a prop marks the document dirty and triggers an auto-backup within the 30-second interval.
- [ ] Explicit user save actions (`force = true`) always write immediately.
- [ ] `tests/track-props-backup.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/track-props-backup.test.ts`
- `node scripts/check.mjs`
