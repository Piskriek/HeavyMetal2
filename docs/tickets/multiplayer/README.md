# Heavy Metal GP 2: Multiplayer, Customization & Permadeath Epic Backlog

## 1. Executive Summary & Architecture Decisions
This epic covers the **Season Zero** meta-game evolution for *Heavy Metal GP 2*, establishing 3D ball customization, modular goblin avatars, online multiplayer hubs, high-stakes seasonal permadeath, the Shaman's Resurrection Altar, a balanced gold economy, and the Goblin Bookie betting parlor.

### Architecture Decision Records (ADRs):
- **ADR-01 (Axle-Aligned Equirect)**: Rotate `SphereGeometry` by `-π/2` so the equirect poles lie directly under the brass bearing caps on `±X`. The rolling circumference aligns with the equator, ensuring uniform texel density and zero pole distortion.
- **ADR-02 (Bake Once, Never In-Race)**: Composite base metals, decals, and accent pin-lines once in a Web Worker at customization time. In-race rendering retains 100% zero-composite performance.
- **ADR-03 (Gnomonic Decal Projection)**: Tangent-plane projection provides mathematically exact, seam-safe, and pole-safe decal stamps.
- **ADR-04 (Goblin DNA Codec)**: 48-bit (12 hex digit) seed representation allows lightweight networking (18 bytes) and deterministic client-side SVG composition.
- **ADR-05 (Hybrid High-Water Mark with Gross Inflow Guard)**: Resurrection fee is `max(EloFloor, WealthTax)` using `SNW = max(holdings, 0.6 * grossSeasonalInflow)`, eliminating offshore alt laundering and pauper god-racer exploits.
- **ADR-06 (Pari-Mutuel Default)**: Bookie operates on a pooled pari-mutuel model with house takeout (5–12%), eliminating house bankruptcy risk.
- **ADR-07 (Authoritative Real-Time Ranked & Ghost Unranked)**: Ranked runs 120 Hz server-authoritative simulation with client prediction; unranked uses ghost stream sync.
- **ADR-08 (Integer Ledger & Idempotency)**: Double-entry ledger with unique idempotency keys prevents double-spending and race conditions.

---

## 2. Dependency Graph & Phase Matrix

```
Phase A — Foundations & Core Math
  MP-T01 (Meta Contracts & Pure Math) ──┬──► MP-T02 (Axle-Aligned Sphere Baker) ──► MP-T03 (Array-Texture Pool)
                                        ├──► MP-T05 (Goblin DNA & Compositor)   ──► MP-T06 (Character Creator)
                                        └──► MP-T14 (Deterministic Math Layer)  ──► MP-T13 (Authoritative Race Server)

Phase B — Identity & Garage (Visual Track)
  MP-T02 & MP-T03 ──► MP-T04 (Ball Customizer Studio Modal)
  MP-T05          ──► MP-T15 (Painted Parts Magenta Pipeline)

Phase C — Server, Stakes & Economy
  MP-T01 ──► MP-T07 (Meta Server: Ledger & Seasons) ──► MP-T08 (Hub Scheduler & Matchmaking)
                                                     ├──► MP-T09 (Permadeath & Shaman Altar)
                                                     └──► MP-T10 (Sheep Hire & AI Pilot Safety Net)

Phase D — Social, Betting & Integrity
  MP-T08 & MP-T09 ──► MP-T11 (Goblin Bookie & Betting Parlor)
  MP-T11 & MP-T14 ──► MP-T12 (Integrity Engine & Telemetry Tripwires)
```

---

## 3. Master Ticket Index

| Ticket ID | Title | Estimate | Track | Dependencies |
| :--- | :--- | :---: | :--- | :--- |
| [`MP-T01`](MP-T01-meta-contracts-math-core.md) | Meta Contracts, Branded Types & Pure Math Core | 3 days | Core / Math | None |
| [`MP-T02`](MP-T02-axle-aligned-sphere-baker.md) | Axle-Aligned Sphere Geometry & Equirectangular Decal Baker | 4 days | 3D Graphics | `MP-T01` |
| [`MP-T03`](MP-T03-array-texture-racer-pool.md) | Array-Texture Racer Pool & 1-Draw-Call Cores | 3 days | WebGL / Perf | `MP-T02` |
| [`MP-T04`](MP-T04-ball-customizer-decal-catalog.md) | Ball Customizer Studio Modal & Decal Catalog | 5 days | UI / Garage | `MP-T02`, `MP-T03` |
| [`MP-T05`](MP-T05-goblin-dna-compositor.md) | Goblin DNA Codec, Occlusion Rules & SVG Compositor | 3 days | Avatar Engine | `MP-T01` |
| [`MP-T06`](MP-T06-character-creator-modal.md) | Modular Character Creator Studio & Legend Migration | 4 days | UI / Identity | `MP-T05` |
| [`MP-T07`](MP-T07-meta-server-ledger-profiles.md) | Meta Server Architecture: Idempotent Ledger & Seasons | 6 days | Server / DB | `MP-T01` |
| [`MP-T08`](MP-T08-hub-scheduler-multiplayer-screen.md) | Hub Scheduler, Matchmaking & Multiplayer Hub Screen | 6 days | Server / UI | `MP-T07` |
| [`MP-T09`](MP-T09-permadeath-shaman-profile-altar.md) | High-Stakes Permadeath, Shaman Altar & Profile Screen | 5 days | Gameplay / UI | `MP-T07`, `MP-T08`, `MP-T05` |
| [`MP-T10`](MP-T10-economy-sheep-hire-ai-pilot.md) | Economy Faucets: Sheep Hire & AI Pilot Safety Net | 3 days | Economy / Sim | `MP-T08`, `MP-T09` |
| [`MP-T11`](MP-T11-goblin-bookie-betting-parlor.md) | The Goblin Bookie Parlor & 100-Racer Wagering Engine | 6 days | Wagering / UI | `MP-T08` |
| [`MP-T12`](MP-T12-integrity-tripwires-suspicion.md) | Integrity Engine: Server Re-Sim & Suspicion Audits | 5 days | Anti-Cheat | `MP-T11`, `MP-T09` |
| [`MP-T13`](MP-T13-authoritative-race-server-prediction.md) | Authoritative Race Server & Client Prediction | 8 days | Netcode | `MP-T07`, `MP-T08` |
| [`MP-T14`](MP-T14-deterministic-math-cross-engine-ci.md) | Deterministic Math Layer & Cross-Engine Replay CI | 4 days | Sim / CI | `MP-T01` |
| [`MP-T15`](MP-T15-painted-parts-magenta-pipeline.md) | Painted Avatar Parts Chroma-Key Pipeline & Rig Anchors | 3 days | Asset Pipeline | `MP-T05` |

**Total Estimated Effort**: ~68 Engineer-Days (Client/Visual Track: 19 days, Server/Stakes Track: 49 days).
