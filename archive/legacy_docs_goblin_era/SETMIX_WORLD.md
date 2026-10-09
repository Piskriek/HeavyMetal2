# The shared SetMix planet

The owner's ask (2026-10-06 17:00, STATUS SM8 to SM10):
- one planet that grows as players join;
- everyone spawns on it, with some starting real estate;
- anyone who doesn't want to build can explore other players' projects nearby;
- games like Goblin Racing orbit the planet;
- as more games join, the universe grows into solar systems, then galaxies.

The rules live in `apps/web/src/crafter/shared-planet.ts` (pure, tested in `shared-planet.test.ts`). The look of a neighbour's plot from your own is already in the crafter (`crafter/planet.ts`, eleven sample neighbours until this is wired).

## What RUN gives us

There is no server of ours. The platform port (`@hm/contracts`, `Platform`) offers:
- each player's own storage;
- UGC: published JSON items of up to 100 KB, with tags, listable by tag;
- leaderboards;
- rooms.

Nothing is shared and writable by everyone, so the shared planet is built from what every player publishes. Every game reads the same items and works out the same planet.

## Plots

- **Your plot is one UGC item**, tagged `setmix-plot` and `setmix-slot-<n>`. It holds what anyone needs to draw it from afar or visit it:
  - the cartridge and stage;
  - later, what you built (under 100 KB).

  Publishing it is how you take your real estate.
- **Where plots go:** a sunflower spiral (`slotPosition`). Slot `n` sits at 105 m times the square root of n + 0.5 from the first plot, turned by the golden angle each time.
  - Slots fill outward evenly.
  - A new slot never moves an old one.
  - No two plots are ever closer than 162 m: two 56 m plots and a 50 m gap.
- **Who gets which slot** (`resolveSlots`):
  - When you claim, your plot asks for the next slot out: the number of plots you can see.
  - Everyone sorts the plots oldest first (ties by id). Each plot gets the slot it asked for if that is still free, or else the next free one.
  - Two players claiming at the same moment both end up with a slot, and everyone agrees which.
  - A removed plot frees its slot and moves no one.
- **The planet grows** (`planetRadiusFor`). The plot map is laid on a sphere round the first plot, and every plot must sit within 85% of the way to the far side.
  - The radius is 12 km until about 10,000 players, then grows with the square root of the count.
  - Plots keep their place on the map; only the curve of the horizon changes.

## Exploring (SM9)

- **Neighbours:** the slots within a few hundred metres of yours (`neighbourSlots`, nearest first). Their items are fetched by slot tag, so nobody lists the whole planet.
- **From your plot:** you see them on the horizon as you do now: their look, their air, their trees.
- **Visiting:** walk or fly over to a neighbour's plot. Visits are read-only.

## Games in orbit (SM10)

- Each game is a planet of its own, orbiting the SetMix planet. Goblin Racing is game 0: the goblin planet in the sky is its world.
- Games take orbits in the order they join (`gameOrbit`), eight to a star system. The ninth game opens the next system out, and so on to galaxies.
- Nothing already placed ever moves.
- From the planet you see the games in your own system as planets in the sky.

## The owner's decisions (2026-10-06 evening; `docs/SETMIX_PLAN.md` section 3)

These replace the spiral of 112 m plots above; `shared-planet.ts` is redone for them in the plan's Phase 5.

1. **Plots are about 1 km across.** The gate's planet end stands at the centre of each.
2. **A new player starts in their own lab.** Their plot goes next to a friend's; with no friend to join, a random free place on the planet.
3. **The gate dials a friend's gate**, opening onto their plot.
4. **Friends can move their plots next to each other** if they want.
5. **Abandoned plots stay for ever**, as they were left (the owner: "logical choices that make the game more comprehensive and fun to play").
6. **Names:** friends' plots show their names and a beacon from afar; anyone else's name shows when you point at their plot or visit.
7. **Deploying.** All of this needs the RUN build live. The deploy needs the owner's login; I don't do that.
