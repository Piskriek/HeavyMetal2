# 5B · `GoblinProfileScreen.tsx` & the Shaman's Resurrection Altar

## 5B.1 Layout — living racer (1440 × 900)

```
┌── TopBar ─────────────────────────────────────────────────────────────── ⛁ 2,340 g ─┐
├── ProfileTabs: [ Dossier ] [ Career ] [ Badges ] [ Racer Slots ] [ Altar ☠ (hidden) ]┤
├───────────────────────────┬─────────────────────────────────────────────────────────┤
│ DOSSIER CARD (400 px)     │  CAREER METRICS — 4-up stat tiles                        │
│ ┌───────────────────────┐ │ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐         │
│ │                       │ │ │ RACES    ││ WINS     ││ PODIUM % ││ DEATHS   │         │
│ │  goblin portrait 256² │ │ │ 214      ││ 19       ││ 31.2 %   ││ 3 (1 ssn)│         │
│ │  (framed by tier      │ │ └──────────┘└──────────┘└──────────┘└──────────┘         │
│ │   frame: gearhead)    │ │  ELO PANEL                                                │
│ └───────────────────────┘ │  1,612  ▲ +18 today   Season peak 1,690   Lifetime 1,744  │
│  RIVET-7                  │  ┌── sparkline: Elo over season (30 pts) ─────────────┐   │
│  "The Unkillable"         │  └────────────────────────────────────────────────────┘   │
│  [GEARHEAD] tier badge    │  Tier ladder: Rookie ─ Grease Monkey ─ ●Gearhead ─ Pit…   │
│  Archetype: The Bruiser   │              progress to Pit Boss: 1612 / 1800 ▓▓▓▓▓░░    │
│  DNA GOB-1A2B-3C4D-5E6F ⧉ │                                                          │
│  [Edit Goblin] [Garage]   │  FINANCIAL LEDGER                                         │
│ ┌───────────────────────┐ │  Liquid gold      2,340 g                                 │
│ │ 3D ball orbit viewer  │ │  Liquid assets      860 g  (inventory resale 40 %)        │
│ │ drag to spin, 220 px  │ │  Bet escrow         200 g                                 │
│ └───────────────────────┘ │  ── Seasonal Net Worth  3,400 g   (λ-guard: 0.6 × 4,900)  │
│                           │  Next resurrection quote: 1,137 g · elo-floor dominant    │
│                           │  [ View transactions ▸ ]                                  │
├───────────────────────────┴─────────────────────────────────────────────────────────┤
│ RECENT BADGES (horizontal strip, 72 px medallions)  · FIRST BLOOD SURVIVOR · CENTURION │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **SNW line** shows *which* term produced SNW (`holdings` vs `λ × gross inflow`), so the λ-guard is never a hidden surprise.
- "Next resurrection quote" makes stakes visible *before* death — players choose risk knowingly.
- Tabs: **Career** = per-course table (best finish, fastest lap, deaths per course), filterable by season; **Badges** = grid of all `BadgeId`s with locked silhouettes and unlock criteria; **Racer Slots** = 5 slot cards (below).

## 5B.2 Racer Slots tab

```
┌ SLOT 1 ─────────┐┌ SLOT 2 ─────────┐┌ SLOT 3 ─────────┐┌ SLOT 4 🔒 ──────┐┌ SLOT 5 🔒 ──────┐
│ [portrait]      ││ [tombstone]     ││ [+ empty]       ││ 6,000 g         ││ 12,000 g        │
│ RIVET-7 ● ALIVE ││ GRUB-3 ☠ DEAD   ││ Create racer    ││ [Buy slot]      ││ [Buy slot]      │
│ 1,612 · active ✔││ fee 2,481 g     ││                 ││ (need 3,660 g   ││                 │
│ [Set active]    ││ [Altar ▸]       ││ [Create ▸]      ││  more)          ││                 │
└─────────────────┘└─────────────────┘└─────────────────┘└─────────────────┘└─────────────────┘
```

## 5B.3 Layout — DEAD racer: the Altar takes over

When `racer.status === 'dead'`, the Profile opens on the **Altar** tab; the Dossier card switches to tombstone mode.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ░░░ smoke particles · ember glow from below · drum loop (low) ░░░                    │
│                                                                                        │
│      ┌──────────── TOMBSTONE ────────────┐          ┌────── THE SHAMAN ──────┐         │
│      │   R.I.P.  RIVET-7                 │          │  [animated shaman       │         │
│      │   "The Unkillable" (ironic)       │          │   sprite, idle chant]   │         │
│      │   ☠ Molten Lava Lake              │          └─────────────────────────┘         │
│      │   Lava Loop · lap 2 · 14:32:07    │    "Your goblin's soul lingers, shiny one.   │
│      │   Season death #2                 │     The spirits want… compensation."        │
│      │   [▶ Watch final moments]         │                                              │
│      └───────────────────────────────────┘                                              │
│                                                                                        │
│  ┌──────────────────────── RESURRECTION FEE BREAKDOWN ──────────────────────────────┐  │
│  │  ELO FLOOR              B(1612) = 250·(1.612)² = 650    × 1.75^(2−1) = 1,137 g    │  │
│  │  WEALTH TAX             P(2) = 25 %  ×  SNW 3,400 g               =   850 g       │  │
│  │  ─────────────────────────────────────────────────────────────────────────────── │  │
│  │  FEE = max(1,137, 850)  →  1,137 g      ● Elo floor dominant                      │  │
│  │  bar: [■■■■■■■■■■■■ floor ][■■■■■■■■ tax ]  (the larger bar is lit)             │  │
│  │  SOUL SICKNESS  2 h ranked lockout after resurrection                              │  │
│  │  NEXT DEATH (n=3) would cost ≥ 1,990 g and 6 h lockout                              │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│   ┌───────────────────────────────┐        ┌─────────────────────────────────────────┐ │
│   │ 🔥 PAY SHAMAN 1,137 g          │        │ 🏛 RETIRE TO HALL OF FAME               │ │
│   │    & RESURRECT                 │        │    & create a new racer in this slot   │ │
│   │ wallet after: 1,203 g          │        │ keeps badges · career frozen · free    │ │
│   └───────────────────────────────┘        └─────────────────────────────────────────┘ │
│    (hold-to-confirm 1.2 s)                   Recommended ✦ when n ≥ 4                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Altar behaviour spec

| Condition (`ResurrectionCalculation`) | UI response |
|---|---|
| `recommendation = 'resurrect'` | Pay button primary (ember), Retire secondary |
| `recommendation = 'consider-retiring'` | Both equal weight; Shaman line: *"Death is getting expensive, friend."* |
| `recommendation = 'retire'` (n ≥ 4) | Retire primary with ✦ badge; Pay secondary and requires typed confirm "BURN IT" |
| `affordable = false` | Pay disabled, shows `Short 1,302 g`, with three routes: **Queue Unranked + Sheep** · **AI Pilot Contract** (if eligible) · **Sell loot** |
| Season ends while dead | Banner: *"The season closes in 2d 4h — unpaid souls pass to the Hall of Fame."* |

- **Hold-to-confirm** (1.2 s radial fill) prevents accidental spends; request carries idempotency key `resurrection:{racerId}:{seasonDeathIndex}`.
- The quote is fetched from the server on open and re-fetched every 10 s + on ledger change; the client mirror computes it instantly for the breakdown animation, but the **server value is what is charged** (the UI shows "quote refreshed" if they differ).
- Success sequence (2.4 s): shaman chant → green soul-flame rises from tombstone → portrait fades back in with a new "Lazarus" scar decal (cosmetic) → Soul Sickness chip starts counting down.
- Retirement sequence: tombstone slides into a **Hall of Fame** frame; racer snapshot written to `hall_of_fame`; slot returns to "+ Create racer" and opens `CharacterCreatorModal` pre-seeded with a *descendant* goblin (same skin/ears — flavour: "Rivet-8, cousin of the late Rivet-7").

## 5B.4 Component tree

```
<GoblinProfileScreen racerId>
  <ProfileTabs />
  <DossierCard racer mode={alive|tombstone} />
    <GoblinPortrait dna size=256 frame={tier} />
    <BallOrbitViewer bakeKey />                 shared tiny Three scene, one per app (portal target)
  <CareerMetrics stats elo />  <EloSparkline />  <TierLadder />
  <FinancialLedger snw={SeasonalNetWorthBreakdown} quote />
  <BadgeStrip badges />
  <ShamanAltar racer quote wallet onPay onRetire />   only when dead
    <Tombstone death />  <FeeBreakdown calc />  <HoldToConfirmButton />  <ShortfallRoutes />
  <RacerSlotsGrid slots />
</GoblinProfileScreen>
```
