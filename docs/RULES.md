# Rules for every task (read first)

You are building ONE package of a larger system (the "harness": a game-engine kernel in which everything is a preset and every variable is addressable).
Other people build the other packages at the same time; a human integrator merges everything. That only works if you obey these rules.

## The contract
- `packages/contracts` is the single source of truth. **Do not edit it.** If something in it is wrong or missing, say so under *CONTRACT CHANGE REQUESTS* in `REPORT.md` and implement the closest thing that satisfies the existing text.
- Your package must export exactly the factories named in `packages/contracts/src/packages.ts` (acceptance tests import them by name). Extra exports are fine.
- Import other harness packages only through `@hm/contracts` types. If you need another package at runtime (for example the kernel), the task says so; otherwise use small local fakes in your tests.
- Only edit files inside your own package and its `tests/`. The one exception: the task may allow a small wiring change in `apps/web/src/main.ts`. Never touch another package's `src` or tests.

## Acceptance tests
- `packages/<yours>/tests/acceptance.test.ts` is the executable form of the contract. Make it pass. **Do not weaken or delete tests.**
- If a test contradicts the contract text or is plainly buggy, follow the contract text, fix the test minimally, and list every such change under *TEST CHANGES* in `REPORT.md` with the reason.
- Add your own tests (new files, `*.test.ts`) for everything you build that the acceptance tests do not cover. Aim for at least as many again.
- The gate: `node scripts/verify.mjs <your-package>` must exit 0 (typecheck, your tests, production build to ONE html file). Run it before you deliver. A zip that fails the gate is rejected unread.

## Code quality bar (the code will be read by non-experts and edited by AI agents)
- TypeScript strict, ESM, no `any` outside tests, no `// @ts-ignore`. Small files (under ~400 lines), small functions, pure where possible, data in plain JSON-serialisable objects.
- No globals, no singletons that cannot be reset. Time and randomness are INJECTED (`now`, `newId`, `Rng`): never call `Date.now()` or `Math.random()` in logic.
- Comments explain WHY, briefly. Every exported function and type has a one-line doc comment. Names are plain words, not abbreviations.
- Errors are thrown with messages that say what was wrong and what to do. Never swallow an error silently.
- No network calls, no telemetry, no `eval`/`new Function` except where the task explicitly requires (the script sandbox).

## Dependencies
- Prefer none. A runtime dependency needs a real reason, a permissive licence (MIT, BSD, Apache-2.0, ISC), small size, and a line in `REPORT.md` (name, version, licence, size, why). Add it to YOUR package's `package.json` only.
- Everything must work offline after `npm install`.

## Deliverable
A zip of the **whole repo** (all packages, apps, scripts, docs), **without** `node_modules` and `dist`, no bigger than 763 KB excluding `docs/run-sdk` (that is the size of the plan zip this process copies: if you are over, you are building too much).
Put `REPORT.md` in the zip root with: what you built (one paragraph); **TEST CHANGES**; **CONTRACT CHANGE REQUESTS**; **KNOWN GAPS**; bundle size your package adds to `apps/web/dist/index.html`; dependencies added; and the exact output tail of `node scripts/verify.mjs <your-package>`.
