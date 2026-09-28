# 8 · Red Team: Critique of This Plan & the Questions We Weren't Asking

A plan that only answers the brief's questions inherits the brief's blind spots. This section attacks sections 0–7, lists the questions nobody asked, and resolves each one with a decision, a mechanism, and a ticket.

## 8.1 Where the plan is weak (self-critique)

| # | Weakness | Evidence | Severity |
|---|---|---|---|
| C1 | **The netcode model is never stated.** "100-racer heats with collisions" implies real-time multiplayer, but ADR-07 treats ranked as *client-simulated then re-simulated*. Those are different games. | §0.3 ADR-07, §4.2 collision mode | 🔴 blocker |
| C2 | **Cross-engine determinism is assumed.** `Math.sin/cos/exp/pow` are *implementation-defined* in ECMAScript; V8 (Node server), JavaScriptCore (Safari) and SpiderMonkey can differ in the last ulp. A 120 Hz sim with chaotic collisions amplifies 1 ulp into a different finishing order within seconds. | ADR-07, T12 "bit-exact" acceptance | 🔴 blocker |
| C3 | **No auth / identity / ops ticket.** T07 "Meta server" at 6 days hides accounts, sessions, hosting, backups, observability and incident response. | §7 | 🔴 |
| C4 | **Ranked is poorer than grinding.** My own simulator shows unranked grinders ending the season *richer* (≈ 2.3 k) than ranked regulars (≈ 1.9 k). The high-stakes mode pays worse than the safe mode, which inverts the incentive. | §4 sim panel, `byArchetype` | 🟠 |
| C5 | **Bake budget contradicts measurement.** §2.5 said 100 remote bakes "fit comfortably" in the grid countdown, but a cold bake measured ≈ 400 ms, so 100 bakes ≈ 40 s on desktop and more on mobile. | §2.5 vs measured | 🟠 |
| C6 | **Elo in 100-player free-for-alls is undefined.** Classic Elo is pairwise. There's no K-factor story for N = 100, and no statement on whether AI fill-ins are rated. | §3.2, §4.2 | 🟠 |
| C7 | **Economy sim agents are non-strategic.** Single seed, no churn, no new-player inflow, no adversarial agents (the whales it claims to stop never actually try laundering in the sim). | `economy-sim.ts` | 🟡 |
| C8 | **Mixed art styles.** The studio now shows vector SVG items beside painted PNG parts, and they visibly clash. The plan never picked a final style. | `/creator` | 🟡 |
| C9 | **Soul Sickness is per racer.** A 5-slot player swaps racers and keeps queuing ranked, so the lockout only bites people who own one slot. | §4.7 | 🟡 |

## 8.2 The questions we weren't asking — and their answers

### Q1 · Are ranked races live, or asynchronous? *(C1)*
**Decision: server-authoritative real-time for ranked, ghost-async for unranked.**
- Ranked: the server runs the 120 Hz sim for all 100 balls. 100 spheres should be cheap server-side (estimate, **not yet measured** — T13 opens with a 1-day spike that benchmarks the existing sim at N = 100 on the target instance and gates the design on ≤ 2 ms/tick). Clients send inputs at 60 Hz, predict their own ball, and interpolate others from 20 Hz snapshots, with 100 ms interpolation delay. Deaths, collisions and the finishing order are decided by the server, so the "re-sim for integrity" *is* the live sim, and tripwires run inline.
- Unranked / custom-ghost: clients simulate locally against recorded ghost streams, which lowers server cost for the 10-minute heats.
- Plan change: ADR-07 rewritten. **T13 · Authoritative race server & client prediction (8 d).**

### Q2 · Can we actually re-simulate the same race on two JS engines? *(C2)*
**Decision: make the sim transcendental-free and prove it across engines in CI.**
- Audit the sim for `Math.sin|cos|tan|atan2|exp|log|pow|hypot|cbrt`. Replace them with deterministic implementations (fdlibm-style polynomials using only `+ − × ÷ sqrt`, which IEEE-754 guarantees to be correctly rounded) and precomputed lookup tables for track geometry.
- Lint rule `no-restricted-properties` on `Math.*` transcendentals inside `src/game/sim/**`.
- CI: run 100 recorded heats in Node, Chromium, Firefox and WebKit (Playwright) and compare a state hash every 120 ticks. Any divergence fails the build.
- Plan change: **T14 · Deterministic math layer + cross-engine replay CI (4 d)**, placed *before* T12.

### Q3 · What happens when someone disconnects above a lava lake?
**Decision: the racer never gets a free pass, and the player is never punished for our outage.**
- Client disconnect → the ball continues under the standard AI pilot on the racing line. Death is still possible, so pulling the plug is never an escape.
- Server-side incident (tick overrun > 250 ms, node crash, mass disconnect > 20 % of the lobby) → heat voided, entries and bets refunded, **no deaths recorded**.
- "Physics anomaly insurance": a death with an impossible preceding state (NaN, tunnelling through collision) is auto-refunded and flagged to engineering.

### Q4 · Should the dangerous mode pay better than the safe one? *(C4)*
**Decision: yes. Recycle part of the death sink into ranked purses: the "Blood Money" pool.**
- 40 % of every resurrection fee flows into next day's ranked purses in the same Elo bracket; the other 60 % is still burned. The net sink is still positive, but gold moves from unlucky or reckless players to skilled survivors.
- Also: sheep payout ceiling 100 → 90 and a guaranteed 1.5× Elo-tier purse multiplier for top-3 finishes.
- Acceptance added to T10: in the sim, the ranked-regular median wallet must be ≥ 1.25× the unranked-grinder median by day 30.

### Q5 · How do 100 remote balls get textures in time? *(C5)*
**Decision: bake once globally, not once per client.**
- The server bakes each unique `bakeKey` on save (same `sphere-baker.ts`, running in Node) and publishes 256×128 WebP (~12–18 KB) to the CDN at `/balls/{bakeKey}.webp`, immutable and cached forever.
- A 100-racer lobby downloads about 1.5 MB during the countdown, with zero client CPU. Local re-baking happens only in the Garage preview.
- Plan change: T02/T03 get a "CDN bake" acceptance criterion. The client worker keeps a fallback path for offline/custom lobbies.

### Q6 · How is skill rated in a 100-player free-for-all? *(C6)*
**Decision: OpenSkill (Plackett–Luce), displayed as a conservative rating.**
- Each racer has (μ, σ). The displayed "Elo" is 1000 + 40·(μ − 3σ), on a scale mapped to the tier thresholds.
- AI fill-ins have *fixed* ratings per difficulty. They count as opponents but are never updated.
- Deaths rank as DNF, ordered by time of death, so dying late beats dying early.
- **The Shaman uses season-peak rating**, not current rating. Tanking your rating to cheapen resurrections doesn't work.

### Q7 · Is the Bookie legal, and what rating does the game get?
**Decision: design the currency so the betting is unambiguously "simulated gambling", and budget for the rating.**
- Gold can **never** be bought for real money, cashed out, or transferred between accounts (§4.2 already bans direct trading). There's no premium currency that converts to gold.
- Rating boards increasingly rate simulated gambling strictly (PEGI and others have tightened criteria; **verify the current rules per territory during the legal gate**). Ship a **regional Bookie toggle** plus an age gate, and keep the Bookie out of the core loop so it can be disabled per territory without breaking the economy (it's a sink, not a faucet).
- Legal review becomes a milestone gate before T11 ships.

### Q8 · Can players get around Soul Sickness by swapping racers? *(C9)*
**Decision: keep it per racer (slots are a paid feature), add a 20-minute account-level cooldown after any ranked death.** This stops tilt-queuing without making extra slots worthless.

### Q9 · Does gold persist across seasons?
The plan never said, and the whole wealth-tax design depends on it.
**Decision: gold, cosmetics and badges persist; `grossSeasonalInflow` and season deaths reset.** Consequence: veterans carry large balances, so the wealth tax dominates for them. That's intended: veterans pay proportionally, and new players are protected by the Elo floor.

### Q10 · What does an older client do with a newer goblin DNA?
**Decision: versioned codecs plus hot-loadable catalogs** (implemented in this revision):
- DNA v1 radix frozen, v2 extended (painted parts appended), and the encoder emits the shortest form.
- An unknown version or item → render `generateRandomGoblin(checksum(dna), 1)` with a small "update to see this goblin" badge. Never crash, never show a blank.
- **Generator versioning:** lobbies store the `generator` version, so AI faces don't change mid-season when the catalog grows.

### Q11 · What if players make offensive symbols?
Free decal placement lets players arrange stripes and plates into hate symbols. Names and DNA combinations can be offensive too.
**Decision:** a report button on every portrait and ball, and server-side rendering (the same pure bakers) for moderator review queues. Names go through a profanity filter plus a reserved list, with repeat offenders' cosmetics reset to default.

### Q12 · Are we allowed to collect this data?
Device and IP fingerprints for account linkage (§6.3) are personal data under GDPR/ePrivacy.
**Decision:** consent at signup for integrity processing (legitimate interest documented), fingerprint hashes salted per season, raw input streams kept 30 days (90 when an audit is open), and a data-export/delete endpoint.

### Q13 · Is the economy robust, or just tuned to one seed? *(C7)*
**Decision:** run the simulator as a **Monte Carlo sweep**: 50 seeds × parameter grid (sheep payout, resurrection recycle %, rake), plus:
- new-player inflow (+2 %/day);
- churn (players below 100 g for 3 days leave with p = 0.2);
- an **adversarial whale agent** that parks 90 % of its wealth in a mule before risky heats.

The acceptance band must hold at the P10/P90 seeds, not just the mean.

### Q14 · One art style or two? *(C8)*
**Decision: painted PNG is the ship style for every item.** SVG stays as (a) programmer art for prototyping new slots, (b) the registration rig and its guides, and (c) the automated alignment test harness. This drives the asset pipeline in §9.

## 8.3 Plan deltas (new and changed tickets)

| Ticket | Title | Est. | Depends on |
|---|---|---|---|
| **T13** | Authoritative race server, client prediction and snapshot interpolation | 8 d | T07, T14 |
| **T14** | Deterministic math layer + cross-engine replay CI | 4 d | T01 |
| **T15** | Auth, sessions, ops (backups, metrics, alerting, incident playbook) | 5 d | — |
| **T16** | OpenSkill rating service + season-peak Shaman input | 2 d | T07 |
| **T17** | Painted avatar pipeline: generation, keying, registration, tint masks (§9) | 6 d | T05 |
| **T18** | Moderation, reporting and data-protection endpoints | 3 d | T07 |
| T02/T03 | + CDN bake by `bakeKey` | +1 d | — |
| T10 | + Blood Money recycle, Monte Carlo sweep, adversarial agent | +2 d | — |
| T11 | + legal gate, regional toggle | +0.5 d | — |

**Revised total ≈ 85 engineer-days.** The first estimate (53 d) left out the netcode and ops problems entirely. The critical path is now T15 → T07 → T14 → T13 → T08 → T11 → T12.
