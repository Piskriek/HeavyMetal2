# Sidecar task 06: visit a plot by its code (visits before the shared planet goes live)

Do this after task 04 (it reads the lab's cartridges). Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Log rough spots in `docs/DEFERRED_POLISH.md`; do not tune frame rates.

## Why
The owner's rules for the shared planet (`docs/SETMIX_PLAN.md` section 3): "the gate dials a friend's gate", and "visits are read-only". Until the RUN deploy publishes plots, a plot travels as a code: a player copies their plot's code, a friend pastes it into their gate's dial, and walks through onto that plot. Later the same code is what the shared planet publishes, so nothing here is thrown away.

## The pieces
- **The codec:** `@hm/plotcodec` (`packages/plotcodec`, landed and tested). Read its API first. `encode(snapshot)` makes the code. `decode(text)` returns a valid snapshot or null, and never throws, because codes come from other people. Add it to the `tsconfig.json` paths and the `apps/web/vite.config.ts` aliases, the way `@hm/plotsim` is.
- **The plot:** `PlayState.plot` (`@hm/plotsim`). Machine x and z are planet coordinates, and the plot's centre is the gate (`scene.debug.gatePlanet()`). A snapshot's machine positions are relative to that centre and stay within 500 m. Normalise yaw to [-PI, PI].
- **The cartridges:** cartridges slotted in machines come from the lab (`PlayState.lab`, `@hm/cartlab`, task 04). In the snapshot, each slotted cartridge becomes `{ name, affinity }`, and the machine points at it by index.
- **The owner's name:** the avatar's name (task 01).
- **The terrain** is the same for every plot until the shared planet gives each plot its own place (`seed: 7` in `play-scene.ts`), so a code carries no terrain.

## Build
1. **The mapping.** In `apps/web/src/play/plot-code.ts`, write a pure `snapshotOf(state, gate)` that turns a `PlayState` into a `Snapshot`.
   - Test it in `plot-code.test.ts`: your plot through `encode`/`decode` keeps its machines (within the codec's precision), its stage, its points and its cartridges' names.
   - A machine too far out to encode leaves the code with a plain refusal, not a crash.
2. **The dial (E at the console when the gate is on), in the planet machine panel's style:**
   - "Your plot's code": a read-only box with the code and a Copy button.
   - "Dial a plot": a paste box and a Dial button. A refused code says so plainly, for example "That is not a plot code." or "That code is damaged."
3. **Visiting.** A good code makes the gate open onto that plot instead of yours:
   - Rebuild the planet's machines from the snapshot. Machines that are on animate and pour their pixels.
   - Show the snapshot's stage at once, with no wave.
   - The HUD shows "Visiting {owner}'s plot" and its four levels.
   - The visit is read-only: no build menu (B says you are visiting), and machine panels show status only.
   - Your own plot keeps running in the background as it does now.
   - Walking back through the gate returns you to the lab; the gate then shows your own plot again.
   - Sync works as on your own plot, with the visited plot's running machines holding it.
4. **e2e** (Play section). Add `hmPlay.plotCode()` and `hmPlay.dial(code)` hooks, plus `hmPlay.visiting()`, which returns the owner's name or null. Then check:
   - your code dials your own plot back: the same number of machines, and visiting says your name;
   - B is refused while visiting;
   - walking back ends the visit;
   - a damaged code is refused.

## Report back
What changed, verify and e2e results, and a screenshot of the dial panel and of a visited plot.
