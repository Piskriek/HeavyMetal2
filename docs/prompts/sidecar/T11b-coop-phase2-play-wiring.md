# T11b: co-op Phase 2, the play-scene window and the Grid's roster controls (TICKET-11, part B)

**Spec:** `docs/argo/notes/ARGO_NOTE_11_ticket11_coop_phase2.md` §3 (the play-scene spec). **Source:** `arena-gathered/argo-ticket11/`. **Start only after T11a, F-09 and Flash's F-15 have all landed.**

This replaces Flash's held F-14: mark F-14 in `docs/sidecar/FLASH_INBOX.md` as "moved to Haiku T11b".

## Do
1. **`play-scene.ts` Window B** (one small, labelled section):
   - **Remote avatars:** `createRemotePeersController(scene)` on setup; in the frame loop, `setRemotePeers(session ? session.client.samplePeers() : [])`; dispose with the scene. Keep it inside the Low budget.
   - **`importBeamField(sculpt)`** on the terrain brush: decode and rebuild the displaced terrain (POL-113). Subscribe through `session.client.onTerrain`. When the Lead Architect finishes a sculpt stroke, send `setTerrain({ seed, sculpt: exportBeamField() })`.
   - **The gate pad:** pass the Moon Twin Gate's pose into `plotHeightAt` (POL-112), so the room and the scene agree on the pad. Add the 50-point check: `plotHeightAt` equals `scene.heightAt` in the browser, pad points included.
   - **No local ticks in a session** (POL-114): while `currentOutpostSession()` is active, the frame loop doesn't apply `{ t: 'tick' }` locally. It sends `sendBeamIntent({ at, beam, power, latched })` when the beam target or the power shares change. Solo play is unchanged.
2. **`play.tsx`:** whatever the session needs for the above (the beam intent, the terrain events). Nothing else.
3. **`planetary-grid.tsx`:** merge Argo's roster logic onto F-15's version: Lead Architect promote and demote, per-author undo, kick, the default guest role, roster names (POL-117), and the slot and sync persistence (POL-84 and POL-85). Use F-15's style source.
   - Before any UI change, load the frontend-design skill (`frontend-design:frontend-design`). Keep the Grid's look.
4. **POL-111:** `plot-ground.ts` imports its terrain constants from `plot-height.ts`.

## Verify
- **Extend `scripts/test-coop-outpost.mjs`** so that:
  - a guest sees the host's sculpt and the host's avatar;
  - promote, demote, kick and undo work from the Grid;
  - the 50-point height check passes;
  - in a session, the world advances by the room's 1 Hz tick only (no double ticking).
- Shots: both pages with avatars visible, and the roster controls. Look at every one.
- Solo `test-campaign` stays 45 of 45. Stage 6 on Low stays at or above F-09's fps.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, `test-coop-outpost`, `test-grid-menus` and `test-campaign`.

## Stay inside
`play-scene.ts` (Window B only), `play.tsx` (the session wiring only), `planetary-grid.tsx`, `plot-ground.ts` (the import only), and the co-op test. Never register, deploy or publish anything on RUN. Use POL-171 to POL-180 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
