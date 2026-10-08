# Sidecar task 09: profiles (create one, test a fresh start, delete it)

The owner (2026-10-08): "add profiles so i can create a new profile, test a fresh start and then delete the profile after im done". **Do this right after TASK-07, before TASK-08.** Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check.

## The design (keep it exactly)
- **A profile is a storage namespace.** The registry lives in one global localStorage key, `hm.profiles`: `{ v: 1, active, list: [{ id, name, createdAt, lastUsed }] }`.
- **"Main" is the default profile, id `main`.** It keeps today's keys exactly as they are (`hm.profile.v2`, `hm.setmix.play`, `hm.settings`, `hm.islands.v1`, ...) and today's IndexedDB database `hm-store`. So the owner's current progress is Main and nothing is migrated.
- **Any other profile** keeps every game key under the prefix `hm.p.<id>.` (so `hm.setmix.play` becomes `hm.p.<id>.hm.setmix.play`) and its own IndexedDB database `hm-store.<id>`.
- **One module does all of it:** `apps/web/src/storage/profile-storage.ts`.
  - `kv.get/set/remove(key)` apply the active profile's namespace.
  - `bigStoreName()` names the profile's IndexedDB database.
  - Registry functions:
    - `listProfiles()`, `activeProfile()`;
    - `createProfile(name)`;
    - `renameProfile(id, name)`;
    - `switchProfile(id)`: sets active, then reloads the page;
    - `deleteProfile(id)`: removes every localStorage key with its prefix and deletes its IndexedDB database. Main cannot be deleted. Deleting the active profile switches to Main first.
- **Replace every direct `localStorage` call** for game data with `kv`. Today they are in:
  - `app.tsx`, `build/player.ts`, `maker/evolution-panel.tsx`, `maker/help.tsx`;
  - `play/play.tsx`, `share/shares.ts`;
  - `shell/new-thing.tsx`, `shell/play-settings.ts`, `shell/profile.ts`;
  - `tutorial/tour.ts`.
  - `storage/big-store.ts` opens `bigStoreName()` instead of the fixed `hm-store`.
  - Add a unit test that scans `apps/web/src` and fails if any file other than `profile-storage.ts` touches `localStorage` directly, so nothing slips back.
- **A new profile starts fresh** except for device settings: it copies the current profile's quality, fps target, graphics tuning and GPU choice, and its controls settings. That way a test profile does not need the graphics set again.

## The UI
- **The SetMix home:** a profile chip at the top right, beside the credits, showing the active profile's name with a menu:
  - the profiles, to switch;
  - "New profile..." (name it; it switches to it);
  - "Manage profiles".
- **Manage profiles** (also in Settings): rename, and delete.
  - Delete asks first, plainly: "Delete profile 'Test'? Its Play save, islands, avatars and settings are removed. This cannot be undone."
  - Main shows no delete.
- Switching shows the loading bar while the page reloads.

## Tests
- **Unit (`profile-storage.test.ts`):**
  - Main maps to the legacy keys; other profiles to their prefix.
  - Create, rename and delete rules (Main undeletable; deleting the active profile switches to Main).
  - Delete removes only its own keys.
- **e2e:**
  1. Create a profile "E2E fresh" and switch to it: Play starts at the scientist creator (a fresh start).
  2. Make an avatar, then switch back to Main: Main's Play save is exactly as before.
  3. Delete "E2E fresh": no `hm.p.<id>.` key is left, and its database is gone.

## Report back
What changed, verify and e2e results, and a screenshot of the profile menu and of the delete confirmation.
