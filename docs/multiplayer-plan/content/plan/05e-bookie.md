# 5E · `BookieParlorModal.tsx` — The Goblin Bookie

Modal (1200 × 820) over the Hub; also reachable from any ranked Lobby Room drawer and as a spectator from the main menu ticker. Theme: smoky back-room, chalkboard odds, brass cash register.

## 5E.1 Layout

```
┌─ THE GOBLIN BOOKIE · Ranked 20:30 · Lava Loop · 100 racers ──── 🔒 locks in 03:41 ──────── [✕]┐
│ HeatPicker: [20:30 R ●] [21:00 R] [21:30 R]         Pool: 14,220 g · takeout 10 % · seed 9f3a… │
├── MarketTabs: [Outright] [Podium] [Head-to-Head] [Casualties O/U] [First Blood] ───────────────┤
│ ODDS BOARD (flex)                                              │ BET SLIP (340)                 │
│ search racer… │ sort: [Odds ▾] [Elo] [Form]  │ ☐ hide my racers│ ┌────────────────────────────┐ │
│ ┌────┬──────────────┬──────┬────────┬────────┬──────┬────────┐ │ │ Outright · GRUB-9          │ │
│ │ #  │ Racer         │ Elo  │ Form   │ Pool g │ Odds │        │ │ │ odds now 6.4 (pari-mutuel,  │ │
│ ├────┼──────────────┼──────┼────────┼────────┼──────┼────────┤ │ │  final odds set at lock)   │ │
│ │ 1  │ [◉] GRUB-9    │ 1742 │ ▲▲▼▲▲ │ 2,010  │ 6.4  │ [+Slip]│ │ │ Stake [ 150 ] g  (+10 +50  │ │
│ │ 2  │ [◉] NIX-2     │ 1720 │ ▲▼▲▲▼ │ 1,540  │ 8.3  │ [+Slip]│ │ │        +100 MAX)           │ │
│ │ 3  │ [◉] RIVET-7 ★ │ 1612 │ ▲▲▲▼▲ │   820  │ 15.6 │ [SELF] │ │ │ Est. return 960 g          │ │
│ │ …  │ virtualized 100 rows · sticky header                  │ │ │ ⚠ Your stake is 11 % of    │ │
│ └────┴──────────────┴──────┴────────┴────────┴──────┴────────┘ │ │   this selection's pool —  │ │
│  pool-share bar per row (how much gold backs each racer)        │ │   odds will shorten        │ │
│  Elo-implied % shown on hover vs. market-implied %              │ │ [ PLACE BET ]              │ │
│                                                                 │ ├────────────────────────────┤ │
│                                                                 │ │ ACTIVE SLIPS (3)           │ │
│                                                                 │ │ 20:30 H2H Nix>Grub 100g ●  │ │
│                                                                 │ │ 20:00 Outright … WON 640g ⏳│ │
│                                                                 │ │   ⏳ held in escrow 00:42:10│ │
│                                                                 │ │   (routine integrity check)│ │
│                                                                 │ └────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┴────────────────────────────────┤
│ INTEGRITY STRIP: "Bets lock 5 min before flag drop · racers may never bet against themselves"     │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5E.2 Market-specific board layouts

| Market | Board | Slip inputs | Pricing |
|---|---|---|---|
| Outright | 100-row table (above) | racer, stake | pari-mutuel, takeout 10 % |
| Podium | same table, "Top-3 odds" column | racer, stake | pari-mutuel (3 winners share), 8 % |
| Head-to-Head | pair builder: two racer pickers + "featured rivalries" (Elo within 50, frequent co-heat) | A, B, stake | fixed odds from `headToHead(eloA, eloB)` with 5 % margin, liability cap 5,000 g/pair |
| Casualties O/U | single card: line (e.g. 6.5) derived from course death history; big OVER / UNDER buttons | side, stake | pari-mutuel, 5 % |
| First Blood | table with "hazard exposure" column (course × racer death rate) | racer, stake | pari-mutuel, 12 % |

## 5E.3 Self-bet UX (mirrors `validateBet`)

- Rows for the user's own racers show a ★ and a **[SELF]** button that only permits *Outright/Podium on self*, stake-capped at 10 % SNW (the cap is pre-filled as MAX).
- First Blood on own racer, Casualties **Over**, and H2H with own racer as the opponent are **not rendered as options at all** (not disabled — absent), with a one-line explainer in the market header.
- Rejections from the server map 1:1 to inline slip errors: `window-closed`, `self-stake-cap`, `pool-share-cap`, `insufficient-funds`, `bookie-cooldown` (with countdown).

## 5E.4 Lock & settlement timeline

```
T-25:00 betting opens · seed commit published ──► T-5:00 HARD LOCK (server clock) · final odds frozen
──► T0 race · live "pool standings" ticker (read-only) ──► finish ──► replay re-sim + integrity scan (≤ 90 s)
──► settle: S < 65 → paid instantly · 65 ≤ S < 85 → escrow 1 h · S ≥ 85 → escrow + 24 h Bookie cooldown
```

- The countdown badge turns amber at T-7:00 and red at T-5:30; at lock the whole board greys out with a chalk "BETS CLOSED" stamp.
- **Suspicion warnings to the user are neutral**: "Payout held for a routine integrity check (≤ 1 h)". No score is displayed to the bettor (avoids teaching thresholds); the audit id is shown for support tickets.
- Void heat (server crash, < 50 % finishers, seed mismatch) → all stakes refunded including takeout.

## 5E.5 Component tree

```
<BookieParlorModal heatId>
  <HeatPicker />  <LockCountdown serverOffset />  <PoolSummary />
  <MarketTabs />
  <OddsBoard market rows virtualized onAdd />       rows update via WS 'odds' diff every 2 s (throttled)
  <HeadToHeadBuilder /> | <OverUnderCard /> 
  <BetSlip selection stake validation estReturn />
  <ActiveSlips bets escrowCountdowns />
  <IntegrityStrip />
</BookieParlorModal>
```
