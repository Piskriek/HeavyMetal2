# The harness in one page

**Idea.** A kernel in which everything is a *preset* (a game, a track, a ball, a tool, a mechanic, a material, a UI skin) and every parameter is a *variable* with a path, a range, a unit and a one-sentence explanation. The same project opens at three depths: **play** (a 6-year-old picks cards and paints), **build** (sliders, snapping, tools), **pro** (every variable, the preset graph and the source code of any preset). Games are *content* built inside it; the first is a goblin ball-racing game on a volcanic island.

**Where things live**
| Path | What |
|---|---|
| `packages/contracts` | types only: the one source of truth (read `src/core.ts`, `preset.ts`, `schema.ts`, then the file for your task) |
| `packages/kernel` | T1: schema registry, preset graph, variables + bindings + expressions, commands/undo, events, migrations |
| `packages/script` | T2: TypeScript-in-the-browser compiler and the script sandbox |
| `packages/sim` | T3: deterministic world, fixed 120 Hz step, seeded RNG, replays |
| `packages/platform` | T9: RUN adapters (storage, UGC, leaderboards, rooms, profile) + a local stub |
| `apps/web` | the deployable shell: builds to ONE static html file |
| `docs/run-sdk` | RUN SDK docs (only in the platform task) |

**Principles** (they decide every design question)
1. One node type: Preset. Immutable revisions, copy-on-write forks, content hashes.
2. Every parameter is a Variable declared in a schema; UIs are *generated* from schemas.
3. Source is a tier, not a different tool: a preset may carry a TypeScript script run in a deterministic sandbox.
4. All edits are Commands (undo/redo, replay, later multiplayer editing).
5. Deterministic by construction: 120 Hz fixed step, injected time and randomness. A session is (preset bundle, seed, input stream).
6. Packages talk only through contracts.
7. Static and RUN-native: no server of our own.

**Run it**: `npm install`, then `node scripts/verify.mjs <package>`; `npm run dev` for the shell.
