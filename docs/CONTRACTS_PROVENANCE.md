# Vendored Contract Provenance (T04)

Ticket [#37 (T04)](https://github.com/Piskriek/HeavyMetal2/issues/37) declares dependencies on
T02 and T03, and it is written against the interfaces T01 froze in
[#34](https://github.com/Piskriek/HeavyMetal2/issues/34). None of that work is merged into
`main` yet:

| Ticket | PR | State relative to `main` (`f9ca189`) |
| :--- | :--- | :--- |
| T00 + T01 | [#46](https://github.com/Piskriek/HeavyMetal2/pull/46) | open, **unrelated history** (cannot be merged into current `main`) |
| T02 | [#47](https://github.com/Piskriek/HeavyMetal2/pull/47) / [#48](https://github.com/Piskriek/HeavyMetal2/pull/48) | open, unrelated history |
| T03 | [#49](https://github.com/Piskriek/HeavyMetal2/pull/49) | open, based on current `main` |

So that T04 implements the **frozen** contracts instead of inventing parallel ones, this branch
carries byte-identical copies of the files T04 compiles against:

- `src/game/contracts/**` — all 15 files, copied verbatim from
  [`4636c49`](https://github.com/Piskriek/HeavyMetal2/commit/4636c494efc70e15f1a4357e2976cc6b619cd430)
  (PR #46, "T01: freeze shared contracts, config defaults and the headless stepping seam"), with one
  exception: `commands.ts` is taken from **PR #48**, which corrects the inverted `steer` gate in
  #46's copy (the condition allowed only `"ready"` while its own message promised "the grid or while
  racing"). Steering is the base verb of a qualifying attempt, so T04 needs the corrected version;
  whoever merges #46 and #48 finds this branch already holding their resolution.
- `src/game/rng.ts` — copied verbatim from PR #48 (T02's separated gameplay/cosmetic RNG
  streams), because per-attempt determinism needs exactly that module.

Nothing in those files was edited. Because the copies are byte-identical, a later merge of #46
or #48 resolves them as identical additions rather than conflicts; whichever PR lands first owns
the canonical copy and this branch's duplicates disappear from the diff.

T04-specific work lives only in `src/game/sim/**`, `src/game/qualifying/**`, `tests/**`,
`scripts/qualifying-harness.ts` and `docs/QUALIFYING.md`.
