# FIDELITY // Base-Building Architecture & Work Split
> **Owner of this file**: Claude Opus (architecture). Flash and Arena build against it; changes go through the board (`docs/SIDECAR_COMMS.md`).
> **Feature source**: the verbatim pinned milestone in [`OWNER_ASKS.md`](OWNER_ASKS.md) (2026-10-09). Design text: [`BASE_BUILDING_AND_SUBSTRATE_SPEC.md`](BASE_BUILDING_AND_SUBSTRATE_SPEC.md).
> **Started**: 2026-10-10. Baseline: `npm run typecheck` clean on `feat/monster-mash-exploration` @ `b1854ca5`.

---

## 0. Decisions I took (owner may overrule; nothing below blocks on them)

| # | Decision | Why |
|---|---|---|
| D1 | **Lattice building, Dune: Awakening style.** Every structure is its own lattice (4 m cells, 3 m levels) placed freely (any spot, any yaw); pieces snap to the lattice of the structure they touch. | Exact integer slots make snapping, integrity, sealed rooms, overlap and network sync exact and deterministic. Free placement of whole structures keeps the freedom. Floats-only freeform (Space Engineers) cannot be merged by majority vote. |
| D2 | **Valheim integrity.** Grounded foundations carry 1.0; support decays per step by the piece's material (vertical keep, horizontal keep); under 0.2 it cannot be built and it falls when its support goes. | The owner named Valheim. Materials come from Drafting Table blueprints, so better maps and primitives build further: harvesting matters to building. |
| D3 | **Heavy terraformers need a hardpoint**: a socket piece on a 2 x 2 pad of grounded foundations. One machine per hardpoint, costs a bill of refined parts, about 20x the output of today's field machine. | "Heavier, more expensive, far more efficient" in game terms: the base is the price of a machine, so spam is impossible by construction. |
| D4 | **Ore stays** as the bulk resource (regolith: foundations, walls, the drill loop). Raw Pxd / Vtx are the precious substrate, harvested from anomalies and refined into maps and primitives. | Keeps the onboarding arc the owner wrote (mine dirt, build the dirt-to-ore machine) and the brother-tested ore loop. |
| D5 | **Play hotbar 1–9 = row 0 of the 9 x 4 inventory** (Valheim). It is not the Studio/build-mode V3 hotbar (F1–F12), which stays exactly as spec V3. | Two different bars for two different modes; V3 is never mixed (memory rule). |
| D6 | **The base is command-sourced.** Every change is a `BaseCommand`; state = fold of commands over a seed. | Synced mode's majority merge and Desynced rollback become replaying command logs; saves, undo and replays come for free. |
| D8 | **Inventory opens on Tab (and I), not E.** E stays interact (lever, dial, machine panels, place while building, hold to gather). Keys 1–9 select the hotbar. | The design spec's "Grid Inventory (E key)" collides with every E action in `play.tsx`; Valheim itself uses Tab for inventory and E for interact. |
| D7 | **Six stages** (owner, 2026-10-06: "it was a miss type, its 6"). `CARDINAL_CONSTITUTION_AND_STAGES.md` still says five (0–4) and needs fixing. | Owner's word wins over a doc. |

---

## 1. Layers

```
 ┌──────────────── PRESENTATION (three.js + React) ────────────────┐
 │ basekit meshes by stage · build ghost + snap marks · integrity   │
 │ overlay · inventory (E) · hotbar 1–9 · Drafting Table · Lattice  │
 │ window · harvest beam FX · pixel plumes · sounds                 │
 └───────────────▲ reads BaseView ─────────── sends BaseAction ▼───┘
 ┌──────────────── GLUE: apps/web/src/base/ (Opus) ─────────────────┐
 │ world.ts   BaseWorld = { plot, base, boxes, relays, player,      │
 │            field, jobs, tick } ; apply(cmd) ; step(dt) ; hash    │
 │ view.ts    the read model the HUD draws (contract for Flash)     │
 │ save.ts    v2 save + migration from today's PlotState            │
 └──────▲────────────▲─────────────▲────────────▲──────────────────┘
 ┌──────┴─────┐ ┌────┴─────┐ ┌─────┴──────┐ ┌───┴──────┐   pure, deterministic,
 │@hm/structure│ │@hm/lattice│ │@hm/substrate│ │@hm/plotsim│   no DOM/Date/random
 │ slots, snap │ │ boxes,    │ │ anomalies,  │ │ economy,  │   (Arena battles +
 │ integrity,  │ │ relays,   │ │ harvest,    │ │ v2: heavy │    my landing tests)
 │ rooms, codec│ │ pull/store│ │ recipes,    │ │ machines  │
 │             │ │ inventory │ │ drafting    │ │ on sockets│
 └─────────────┘ └───────────┘ └─────────────┘ └───────────┘
```

Rules: packages never import each other (glue joins them by id); glue holds no maths a package should own; presentation never mutates state, it sends `BaseAction`s.

---

## 2. `@hm/structure` (Arena: `docs/prompts/battle/structure.txt`)

- **Round 1 (sent)**: lattice pose, slots (cell, edge, corner, fixture; hardpoint spans 2 x 2), terrain skirts (`SKIRT` 3 m, "ground in the way"), first-foundation placement with 2D overlap between structures, Valheim support (max-product over supporters, V and H keeps per material), `check` for the ghost colour, `place`, `remove` with cascading collapse.
- **Round 2 (follow-up, same chat)**: `snap(base, env, kind, aim{x,y,z,yaw}, mat)` best slot within 3 m (else a new structure for a foundation, yaw free); **sealed rooms** (flood fill over cells with floor + ceiling, walls / closed airlocks on every boundary edge; ramps open a cell); `setOpen(airlock)`; `encode/decode` (hostile-safe, like `@hm/plotcodec`).
- Landing: hidden suite `docs/prompts/battle/tests/structure.accept.test.ts` plus round 2's.

## 3. `@hm/lattice` (Arena: `docs/prompts/battle/lattice.txt`)

- **Round 1 (sent)**: boxes (slots, stacks, weight), `deposit`/`withdraw`, relay networks (union of fields; the lab's quantum bridge is a relay with a huge range at the gate), atomic nearest-first `pull` for benches, `store` (prefer boxes that hold the item), `totals`.
- **Round 2**: the player: 9 x 4 inventory with row 0 as the hotbar, equipment slots (`visor`, `shield`, `rebreather`, `beam`, `sidearm`, each takes one tagged item), `move(slot→slot)` with merge / swap / split, quick-stack to the network in range, sort, `encode/decode`.

## 4. `@hm/substrate` (Arena, after a battle slot frees)

- **Anomaly field**: deterministic per plot seed (hash noise, no random): chromatic anomalies and dither scars (Pxd), topological folds and crystal spires (Vtx). Each node: reserve, regrowth, yield by beam power and plot stage; the terraformed stage changes what spawns (richer substrate at higher fidelity).
- **Harvest**: `harvest(field, nodeId, beamPower, dt) → {field, items}` (raw Pxd / raw Vtx in typed grades).
- **Refining**: Texture Mill (raw Pxd + cartridge → texture map: Regolith Basalt, Polished Obsidian, Reflective Quartz, Luminescent Moss), Shape Press (raw Vtx → primitives: structural cube, cylinder column, chamfered beam, chassis frame). Jobs with duration and power draw, queued per machine.
- **Drafting Table**: primitive + map → blueprint for a piece kind with derived stats (vKeep, hKeep, kg, look id). Material table feeds `@hm/structure`'s `Env.materials`; blueprint costs feed `pull`.

## 5. `@hm/plotsim` v2 (me, small)

`Machine.socket` (hardpoint id) required for mill, press, projector, water; costs become a bill of items (`pull` from the network) instead of ore; rates about 20x; draw about 4x. Drill and pylon stay field machines. Save migration: existing machines keep running as legacy until taken down (no player loses a plot).

## 6. `BaseWorld` and commands (me: `apps/web/src/base/world.ts`)

```ts
type BaseCommand =
  | { t: 'found'; cx: number; cz: number; yaw: number; blueprint: string }
  | { t: 'place'; piece: PieceSpec; blueprint: string } | { t: 'remove'; id: number } | { t: 'door'; id: number; open: boolean }
  | { t: 'harvest'; node: number; dt: number } | { t: 'craft'; bench: number; recipe: string } | { t: 'draft'; primitive: string; map: string }
  | { t: 'move'; from: SlotRef; to: SlotRef; n: number } | { t: 'install'; hardpoint: number; kind: HeavyKind };
apply(world, env, cmd) → { world, events }   step(world, env, dt) → { world, events }   hash(world) → string (@hm/kernel hash)
```

- Every command validates through the packages; a refused command changes nothing and returns `why` (the HUD shows it).
- **Desynced**: the local log after the fork tick. **Synced**: the weekly consensus applies the majority log; re-sync = replay majority, then rebase local commands that still validate (the "rollback reconciliation" Flash's scaffold stubbed).
- Save v2 = seed + compacted snapshot + command tail.

## 7. Presentation (Flash scaffolds, Opus AAA pass)

- **Contract**: `apps/web/src/base/view.ts` (`BaseView` read model, `BaseAction` intents). Flash builds against a mock provider; I wire the real one.
- **Ghost**: hologram of the piece, snapped by `@hm/structure.snap`, tinted by `check` (blue grounded → green → yellow → red unsupported), socket marks on open slots nearby, `why` under the reticle.
- **Integrity overlay** (build mode only): per-piece support colour, Valheim style.
- **Windows**: inventory (E), hotbar 1–9, Drafting Table, Lattice storage (network totals, which boxes are linked), fabricator queue. Glass panels per `UI_DESIGN_SYSTEM_AND_TOKENS.md`; frontend-design skill on every window; sounds on open, place, refuse, collapse.
- **Meshes**: `@hm/basekit` (Arena mesh battle, like labkit / fieldkit) **after the concept art is approved**: stage-aware triangle budgets (stage 1 chunky, stage 6 detailed), merged geometry per piece, no transmission glass, colliders that leave doorways clear. Until then, plain stand-in boxes, labelled as such.

## 8. Work split and order

| Who | Now | Next |
|---|---|---|
| **Arena battles** (2 at a time) | `structure` r1, `lattice` r1 | r2 follow-ups in the same chats; then `substrate`; then `basekit` meshes |
| **Arena agent (art)** | `docs/prompts/art/base-construction.md`: sheet 13 (the construction kit, S1 vs S6), scene 14 (outpost at stage 3) | review by me, owner approval, then the basekit brief |
| **Flash** | `docs/prompts/sidecar/01-base-hud-scaffold.md`: watcher, inventory/hotbar/drafting/lattice windows on the mock `BaseView`, ghost API in the play scene, e2e | wire real meshes after basekit lands |
| **Opus** | this plan, contracts, briefs, landing suites | land battles, `world.ts`, plotsim v2, save v2, integration, AAA pass on Flash's windows |

## 9. AAA list for the existing Flash scaffolds (after this milestone's core lands)

1. **Studio consensus patch**: the `sha256:` signature and the `SMX-PLN-XXXX` code are `Math.random()` (`studio-screen.tsx` ~329, ~337). Replace with a canonical-JSON content hash (`@hm/kernel` hash) and a code derived from it, so the same patch always has the same id and peers can verify it.
2. **Monster Mash determinism**: pellet damage, spread and spawn points use `Math.random()` inside gameplay (`monster-mash-combat.ts` ~429–889). Move mob and combat rules into a pure seeded package (`@hm/mobsim`); keep random only for cosmetic particles. Synced play needs every client to agree on who died.
3. **Studio state**: 29 `useState`s in one screen; move the editable document into `@hm/scenedoc` so undo, autosave and the consensus diff all read one source.
4. **Synced/Desynced**: the toggle is a label today; it becomes the command-log fork of section 6.

## 10. Done means

`npm run typecheck` clean · every package's tests plus my hidden suites pass · `node scripts/test-base-building.mjs` (Flash) green · placing, collapsing and harvesting checked in the browser at stage 1 and stage 6 · Low preset holds 50+ fps on the GTX 950M laptop with a 200-piece base · loading bar covers any new asset.
