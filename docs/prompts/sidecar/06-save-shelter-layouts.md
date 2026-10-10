# Sidecar TASK-06: the base persists, new players get the shelter, layouts in the Drafting Table (Gemini Flash)

> From Claude Opus, 2026-10-10. Start this after TASK-05 is accepted. Everything here is glue to pure code that has landed and been tested:
> - `apps/web/src/base/save.ts`: `saveWorld`, `loadWorld`, `BASE_SAVE_KEY`.
> - `world.ts`: the `shelter`, `saveLayout`, `importLayout`, `plan`, `fill` and `dropPlan` commands, plus `planGhosts()`, `layoutPieces()` and `SHELTER`.
> - `@hm/structure` round 4b: roof kinds, `roofOf()` and `roofSidesOf()`.

## A. The base persists

Today `play.tsx` builds a fresh base on every load, so everything a player builds is lost on reload.
1. On mount, read the base with `loadWorld(kv.get(BASE_SAVE_KEY), seed)` instead of `createWorld()`.
2. Save with `kv.set(BASE_SAVE_KEY, saveWorld(world))`:
   - at most once every 2 s while the world changes (compare `world.tick`);
   - immediately on `pagehide`/`visibilitychange` to hidden.
   - Wrap every storage call in try/catch; storage can be missing.
3. The dev seed (`SEED_STOCK` and `withBridgeStore`) runs only when there is no save, and only behind a dev flag (`import.meta.env.DEV` or `?kit=1`). A real new game gets the bridge store empty: `withBridgeStore(world, env)`.

## B. New players get the starter shelter

On a new game's first arrival on the planet, with no save and `world.shelter === false`:
- dispatch `{ t: 'shelter', cx, cz, yaw }` on flat ground 12 m in front of the gate, facing it (its airlock at +z faces the gate);
- if it is refused (`steep` or `overlap`), try a ring of 8 spots at 12, 18 and 24 m;
- the narrator line: "I've dropped you a shelter. It's sealed: the door's an airlock. The Drafting Table inside is where every blueprint starts."
The shelter has a `lowRoof`, so this needs C first.

## C. Render the new kinds

`kit-pieces.ts` today maps them to stand-ins. Map them properly:
- Roofs, using the basekit builders with the cell pivot (-2, 0, -2) and rotation -r·90°, as ramps:
  - `roof` → `pitchedRoof`, `lowRoof` → `lowRoof`, `roofOuter` → `roofOuterCorner`, `roofInner` → `roofInnerCorner`.
- `gable` (kit plane z = 0, rising toward +x): turn it so it rises toward its roof's high side, from `S.roofSidesOf(roof.kind, roof.r).high` with `roof = S.roofOf(base, gable)`.
- `ridgeCap`: the edge pivot.
- The 4a kinds (half wall, window wall, doorframe, door, railing, ladder, stairs, life support) keep their stand-ins until `@hm/basekit2` lands (its battle is running).

## D. Layouts in the Drafting Table window

Add a **Layouts** tab beside Blueprints in `drafting-window.tsx`. Keep the established window styling.
- **Save this structure.** A name field (1..32 characters) dispatches `saveLayout` for the structure the player stands in or aims at. Show the refusal reason in words.
- **List.** One card per layout, showing its name, piece count (`layoutPieces(code).length`) and a mini top-down footprint drawn from its cells. Each card has two buttons:
  - **Place**: enters a placement mode where a ghost of the whole layout follows the aim. R turns it 90°. Click dispatches `plan` with the first foundation's cell centre and yaw.
  - **Share**: copies `code` to the clipboard, with a "copied" toast.
- **Import.** Paste a code plus a name, then dispatch `importLayout`.

## E. Plans in the world

- Draw every plan's `planGhosts(world, env, id)` as translucent cyan pieces, with the kit meshes and a ghost material, cached.
- Standing within 8 m of a plan shows a prompt: "F: build next (n left)". F dispatches `fill`.
  - Show `filled` as a small counter toast ("+6 pieces").
  - When short, show the missing items, as the build readout does.
- A small plan list in the HUD has a drop button that dispatches `dropPlan`.

## G. Pressure (D14)

- About 4 times a second while on the planet, call `roomAt(world, env, { x, y: feetY, z })` and pass `sheltered: pressurized` to `stepSync` in `play-scene.ts`.
  - A pressurised room refills sync at `SHELTER_REFILL` (0.25/s).
  - Sealed means every door and airlock is shut, and powered means a relay reaches the life-support unit.
- HUD: a small "PRESSURISED" chip beside the sync meter while it holds. When a room is sealed but has no powered unit, a dim "SEALED · NO LIFE SUPPORT" chip instead.
- Life support can't be built yet: it is in no blueprint family, and the shelter's single fixture slot holds the Drafting Table. Test it with a debug hook that places one.

## F. Done means

- Typecheck shows 0 errors, `npm test` is green, and `npm run build` succeeds.
- An e2e (`scripts/test-base-building.mjs`, extended) checks four things:
  - a reload keeps a placed wall;
  - a fresh profile gets the shelter;
  - save layout, place it, fill it, and the copy stands;
  - share and import round trip.
- Shots in `docs/shots/base/`: `shelter-s1.png`, `layouts-tab.png`, `plan-ghost.png`.
- Post [DONE] with the commit.
