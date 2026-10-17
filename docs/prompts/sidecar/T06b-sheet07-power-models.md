# T06b: adopt the sheet 07 breaker panel and operator console (TICKET-06, models)

**Spec:** Argo's model brief, `docs/argo/notes/ARGO_NOTE_09_ticket06_models.md`. **Start only after T06 has landed** (it replaces `lab-room.ts`).

**The models are generated and reviewed** (Opus, 2026-10-18), but not packed. They're in `zips/runworld/assets/<id>/` (low, mid and high levels), with four-angle review sheets in `zips/runworld/assets/angles-lab07/`:

| Id | Size (m) | What it is |
|---|---|---|
| `breaker-panel` | 1.22 × 2.10 × 0.70 | Two-door cabinet on square legs: louvres, two square-bezel gauges, a hazard plate with an empty spindle boss (centre right), three empty small square sockets (middle left), roof glands. |
| `breaker-handle` | 0.24 × 0.15 × 0.10 | A red L-shaped square handle on a hazard-striped square hub plate. |
| `operator-console` | 1.18 × 1.32 × 0.79 | Pedestal console: a hazard-lip deck, three square buttons, a green status bar, a slotted lever guide box (deck, right), four tick-only gauges, a CRT, and an empty square pocket (hood, right). |
| `console-lever` | 0.22 × 0.34 × 0.18 | Twin square arms with a red T-grip on a square axle block. |

The old sheet 21 versions are kept in each asset's `old/sheet21-2026-10-17/` folder.

## Do
1. **Pack:** `node scripts/runworld-pack.mjs breaker-panel breaker-handle operator-console console-lever`. It writes `apps/web/src/assets/gen/<id>.glb`, `apps/web/public/hd/<id>/` (both Git LFS) and `registry.json`.
2. **The breaker panel in `lab-room.ts`.** The old cabinet carried six breaker handles. The new one carries:
   - **One isolator** (`breaker-handle`), on the hazard plate's spindle boss. It rotates from −90° (off) to 0° (on) about the boss's axis during the power-on, where the old handles flipped.
   - **Three sub-toggles,** built in code as small square bat toggles (about 0.04 × 0.09 × 0.06 m, gunmetal), seated in the three empty sockets. They flip one after another just before the isolator.
3. **The operator console in `lab-room.ts`.**
   - **The throw lever** (`console-lever`) sits in the slotted guide box on the right of the deck. Sink its axle block into the box so only the arms and grip show, and rotate it about the block's X axis wherever the old lever moved.
   - **The keypad,** built in code as a 4 × 4 grid of raised square keycaps (about 0.18 m square, no numbers), set into the hood's empty square pocket.
   - **The three push-buttons** on the deck are part of the model. Leave them as they are.
4. **Fit to the real meshes, not Argo's numbers.** His socket coordinates were written for his target sizes, and the generated cabinet is deeper (0.70 m, not 0.55). Find each socket on the model:
   - the front face from the bounding box;
   - x and y from a front render;
   - then tune until the isolator sits on the boss, the toggles sit in their sockets, the keypad sits in its pocket and the lever sits in its box, with nothing floating and nothing sunk through.
5. **Colliders:** keep labkit's colliders, resized to the new footprints if they changed.

## Verify
- **Shots of each machine,** front and three-quarter, powered off and on, plus the power-on sequence mid-way (the toggles, then the isolator, then the lever). Look at every one; nothing floats, and no old handle positions are left.
- Extend T06's `scripts/test-lab-overhaul.mjs`: the isolator's rotation changes between off and on, and the three toggles and the keypad exist.
- The lab's draw calls stay within T06's final number +5 (the code parts are merged per machine). The build stays under 16 MB; report the size.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, `test-lab-overhaul` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/play/lab-room.ts`, the four packed assets and `registry.json`, and `scripts/test-lab-overhaul.mjs`. Never touch `play-scene.ts`.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`. The GLB and HD files go through Git LFS.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
