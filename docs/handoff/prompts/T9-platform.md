# TASK T9: platform adapters for RUN (`packages/platform`)

You are given a zip of a TypeScript monorepo (the "harness"). Read `docs/README.md`, then `docs/RULES.md` (binding), then `packages/contracts/src/platform.ts` and `packages.ts` (`PlatformExports`).
Your acceptance tests are `packages/platform/tests/acceptance.test.ts`. Read them fully first.
The RUN SDK docs are in `docs/run-sdk/` (STORAGE, UGC, LEADERBOARD, MULTIPLAYER, PROFILE). **Read them before writing the `run` adapter and follow them over your memory.** The SDK itself is `@series-inc/rundot-game-sdk` (you may `npm install` it as a dependency of this package to read its types; do NOT import it statically in code that runs in tests or in non-RUN builds, see 3).

## Why this exists
The game launches on run.studio: a static build inside an iframe, no server of ours, sign-in by the platform, saves in platform storage, sharing through UGC (JSON up to 100 KB), scores through leaderboards, multiplayer through GameRoom. The harness must never talk to RUN directly: it talks to `Platform`. A `stub` platform with the same limits lets everything be developed and tested offline, and a `run` platform wraps the real SDK.

## What to build (all inside `packages/platform/src`)
1. **Stub platform** (`createPlatform('stub', {user})`): in-memory, fully per-instance, behaves like RUN in every way the harness depends on: storage key/value with prefix listing; UGC with the 100 KB limit enforced (`UgcTooLargeError`), `mine`/`tag`/`limit` filters, ids, timestamps; leaderboards keeping the best score per player and ranking; rooms (`create/join/list`, `maxPlayers` enforced, messages reach everyone except the sender, member change events, `leave`); `profile()` with an anonymous guest when no user is given. Several stub platforms can SHARE one in-memory hub (an optional `hub` option, an extra you design) so a test can run two "players" against one room.
2. **Run platform** (`createPlatform('run', {sdk})`): maps each adapter onto the real SDK calls exactly as the docs describe (storage, UGC, leaderboards, rooms via the multiplayer client, profile). The `sdk` option injects the SDK object (`RundotGameAPI`) so the adapter is testable; when absent it must throw an error containing "sdk" in tests/non-RUN builds, and in a RUN build obtain the SDK lazily (dynamic `import()` of `@series-inc/rundot-game-sdk/api`). Map SDK errors (anonymous player refused, rate limits, size limits) to clear `Error` messages.
3. **`packages/platform/tests/fake-run-sdk.ts`** exporting `createFakeRunSdk()`: an in-memory fake with the same method names and shapes as the real SDK parts you use (derive them from the docs/types). Use it to test the `run` adapter thoroughly (at least one test per adapter method, plus error mapping).
4. **Build wiring** (you may edit `apps/web/vite.config.ts` for this): the single-file build must NOT carry the SDK unless it is a RUN build. Follow this pattern: in normal mode alias `@series-inc/rundot-game-sdk/api` to a tiny stub module in your package; with `vite build --mode run` use the real SDK. Add a root script `build:run` (`vite build --mode run` for `@hm/web`). Both builds must pass; report both sizes.
5. A small **`bootPlatform(): Promise<Platform>`** extra export: picks `run` when running inside RUN (check the SDK docs for how a game detects it) and `stub` otherwise.

## Also
- Add your own tests for: storage prefix edge cases, UGC over the limit by exactly one byte, leaderboard ties, room full/leave/rejoin, two stub players on one hub, every error mapping in the run adapter.
- Wire a status line into `apps/web/src/main.ts` (it probes `createPlatform('stub')`) and keep it working.
- The docs folder `docs/run-sdk` does not count toward the zip size limit; keep your own code small.

Deliver per `docs/RULES.md` (zip + `REPORT.md`). The gate is `node scripts/verify.mjs platform`.
