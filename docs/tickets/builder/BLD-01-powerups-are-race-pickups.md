# BLD-01: The Powerups tab places the race's real pickups

- **Priority**: High · **Conflicts with**: BLD-03a (both change how the engine builds `this.pickups`)
- **Needs art**: No (the race's pickup art already exists)

## Goal
The builder's Powerups tab offers exactly the pickups the race has (Rocket Fuel, Skyward Shield, Air
Spring), shown with their own icons; a placed pickup appears and works in the next race; and the
race's existing pickups can be selected in build mode.

## Evidence
- `src/game/builder/prop-catalog.ts:412-416`: the tab's five items are invented types with borrowed
  art: Speed Boost and Missile Crate use `prop-03-tnt-powder-kegs.png`, Shield Generator
  `prop-04-smelting-crucible.png`, Repair Kit a cauldron, Jump Pad a springboard. The race has no
  missile or repair kit.
- `src/game/gameplay-props.ts:234` `compileGameplayProps` compiles `isPowerup` props into pickups, but
  nothing calls it (`grep compileGameplayProps src/game/engine.ts src/game/sim` is empty): placed
  powerups do nothing in a race.
- The race's pickups come from `createAirPickups` (`src/game/engine.ts:974`) and are drawn by
  `PickupView`, which is not a builder prop, so `raycastProp` (`src/game/track-builder-3d.ts:1090`,
  which only tests `propObjects`) can never select them.
- The owner's track holds one each of `powerup_shield`, `powerup_missile`, `powerup_speed_boost`.

## Solution
1. Replace the five catalog entries with `pickup_fuel`, `pickup_shield`, `pickup_bounce`, using
   `/art/fuel-supply.png`, `/art/shield-supply.png`, `/art/bounce-supply.png`, placed as billboards at
   the pickup height.
2. **Migration** (in `track-storage-migrate.ts`): `powerup_speed_boost` → `pickup_fuel`,
   `powerup_shield` → `pickup_shield`, `powerup_jump_pad` → `pickup_bounce`; `powerup_missile` and
   `powerup_repair_kit` → `pickup_fuel` with a `migratedFrom` note (they have no race meaning). Same
   ids, same transforms, nothing dropped. Keep the old types decodable.
3. The engine adds the builder's placed pickups to `this.pickups` (via the network layout, like the
   generated ones), so they are collected by the existing arbiter.
4. The race's generated pickups show in build mode as ghost markers you can select; editing them is
   BLD-03b (until then, selecting one shows "generated pickup: place your own from the Powerups tab").

## Files allowed to change
`src/game/builder/prop-catalog.ts`, `src/game/track-storage-migrate.ts`, `src/game/engine.ts`
(pickup list only), `src/game/track-builder-3d.ts` (selection of generated markers),
`src/components/TrackBuilderUI.tsx` (the tab), tests: `track-storage`, `pickup-view`, new `builder-pickups.test.ts`.

## Must NOT change
Pickup collection rules and radii (`powerups.ts`), the owner's props (migrate, never delete).

## Acceptance
- [ ] The Powerups tab lists Rocket Fuel, Skyward Shield and Air Spring with their supply icons.
- [ ] A placed pickup is collected in a test drive and gives its effect (headless test through the arbiter).
- [ ] Migrating the owner's 522-prop file keeps 522 props, maps the three powerups, and changes nothing else (test on a copy).
- [ ] Clicking a generated race pickup in build mode selects its marker.

## Tests to run
`node --import tsx --test tests/track-storage.test.ts tests/pickup-view.test.ts tests/builder-pickups.test.ts`, then `node scripts/check.mjs`.
