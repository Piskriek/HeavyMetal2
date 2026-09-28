# 5A · Main Menu Overhaul & `MultiplayerHubScreen.tsx`

## 5A.1 Information architecture

```
MAIN MENU
├── PLAY / RACE ─────────── Quick Race · Tournament · Time Trial · Track Builder      (existing NewGameSetup)
├── MULTIPLAYER HUB ─────── Create Race · Join Unranked · Join Ranked · Bookie Parlor
├── GOBLIN PROFILE ──────── Dossier · Career · Badges · Racer Slots · Shaman Altar*
├── GARAGE ──────────────── Base Finishes · Decal Editor · Loadout Presets
└── (footer) Settings · Controls · Credits · Quit
                                             * Altar tab replaces Dossier as default when active racer is DEAD
```

Router: the SPA keeps its `SessionPhase` state machine for racing and adds a top-level `MenuRoute` union; no URL router dependency is required, but routes are mirrored to `location.hash` for deep links (`#/hub/ranked`, `#/profile/altar`).

```ts
type MenuRoute =
  | { screen: 'main' }
  | { screen: 'play' }                                   // → NewGameSetup
  | { screen: 'hub'; tab: 'overview' | 'create' | 'unranked' | 'ranked'; lobby?: LobbyId }
  | { screen: 'profile'; tab: 'dossier' | 'career' | 'badges' | 'slots' | 'altar'; racer?: RacerId }
  | { screen: 'garage'; tab: 'finish' | 'decals' | 'presets'; preset?: 0|1|2|3|4 }
  | { screen: 'bookie'; heat?: HeatId };                 // modal over hub
```

## 5A.2 Main menu layout (1440 × 900 reference)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [HEAVY METAL GP 2 logo, furnace-lit]                             ⛁ 2,340 g   ◷ S2026-05 · 12d │ ← TopBar (h 64)
├───────────────────────────────┬──────────────────────────────────────────────────────────────┤
│                               │                                                              │
│   ▶ PLAY / RACE               │         ┌───────────── Live ball orbit (3D) ─────────────┐   │
│                               │         │  active racer's baked ball, slow idle roll      │   │
│   ◉ MULTIPLAYER HUB     [LIVE]│         │  goblin portrait billboard beside it            │   │
│      next ranked in 07:42     │         └─────────────────────────────────────────────────┘   │
│                               │   RIVET-7 "The Unkillable"  ·  GEARHEAD  ·  1,612 Elo         │
│   ☠ GOBLIN PROFILE     [DEAD] │   ─── or, if dead: tombstone chip "Slain on Lava Loop —      │
│                               │        visit the Shaman" (pulsing ember border)               │
│   ⚙ GARAGE                    │                                                              │
│                               │   NEWS TICKER: "Grand Champion Grub-3 retired after 5th       │
│   ─────────                   │   death" · "Bookie: 14,220 g in tonight's 20:30 pool"         │
│   Settings · Controls         │                                                              │
└───────────────────────────────┴──────────────────────────────────────────────────────────────┘
  col 1: 360 px nav rail                       col 2: flexible hero stage
```

- Nav items are 72 px tall, big hit-targets, gamepad D-pad focus ring (brass outline + gear tick sound).
- **Status badges** on nav items are data-driven: `[LIVE]` when a lobby you're queued for is < 2 min out; `[DEAD]` red when the active racer is dead; `[SICK 5h]` amber during Soul Sickness.
- Narrow (< 900 px): nav becomes a bottom 4-icon bar; hero collapses to portrait card.

## 5A.3 `MultiplayerHubScreen.tsx` — layout

```
┌── TopBar ──────────────────────────────────────────────────────────────────────── ⛁ 2,340 g ──┐
├── HubTabs:  [ Overview ]  [ Create Race ]  [ Unranked · 10 min ]  [ Ranked · 30 min ]  [🎲 Bookie]┤
├──────────────────────────────────────────────────────────────┬───────────────────────────────┤
│  QUICK-MATCH CARDS (3-up grid, 1fr each, min 280 px)          │  RACER READINESS PANEL (360)  │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│ ┌───────────────────────────┐ │
│ │ UNRANKED         │ │ RANKED  ☠        │ │ CREATE RACE      ││ │ [portrait] RIVET-7        │ │
│ │ ◷ 04:12          │ │ ◷ 22:41          │ │ host a lobby     ││ │ 1,612 Elo · Gearhead       │ │
│ │ 38/100 queued    │ │ bracket 1500-1750│ │ 4–100 racers     ││ │ Status: ● ALIVE            │ │
│ │ Free · no death  │ │ entry 150 g      │ │ fee 0–5,000 g    ││ │ Deaths this season: 1      │ │
│ │ [🐑 Sheep −25g]  │ │ betting: OPEN    │ │                  ││ │ Next fee if slain: 1,137 g │ │
│ │ [ JOIN  (A) ]    │ │ [ JOIN  (X) ]    │ │ [ CREATE (Y) ]   ││ ├───────────────────────────┤ │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘│ │ Loadout: Siegebreaker      │ │
│                                                               │ │ Ball: [mini-orbit 96px]    │ │
│  UPCOMING HEATS — timeline strip (next 3 h, scrollable)       │ │ [Change preset ▾]          │ │
│  ──●────────●────────●────────●────────●────────●──────►      │ ├───────────────────────────┤ │
│   U 20:10  U 20:20  R 20:30  U 20:30  U 20:40  R 21:00        │ │ WALLET 2,340 g             │ │
│                                                               │ │ Can afford: entry ✔        │ │
│  OPEN CUSTOM LOBBIES (table, virtualized)                     │ │  resurrection (n=2) ✔      │ │
│  Host      Track        Field  Fee   Mode     Bets  Spectate  │ └───────────────────────────┘ │
│  Nix-2     Lava Loop    12/20  200g  full     ✔     👁  [Join]│  (bankrupt? → AI Pilot card) │
│  Grub-9    Rust Canyon   4/4   0g    ghost    ✖     👁  [Full]│                               │
└──────────────────────────────────────────────────────────────┴───────────────────────────────┘
```

### Component tree

```
<MultiplayerHubScreen>
  <TopBar wallet season />
  <HubTabs value={route.tab} onChange />
  <HubGrid>                                         CSS grid: [main 1fr | aside 360px]
    <QuickMatchCard kind="unranked" lobby={nextUnranked} />
    <QuickMatchCard kind="ranked"   lobby={nextRanked} lockout={soulSickness} />
    <QuickMatchCard kind="create" />
    <HeatTimeline lobbies={next3h} onSelect />
    <CustomLobbyTable rows filters sort />          react-window virtual list (100s of lobbies)
    <RacerReadinessPanel racer wallet quote />
      <AiPilotContractCard />                       rendered only when eligibility.all === true
  </HubGrid>
  <LobbyRoomDrawer lobbyId />                       slides in from right when queued (560 px)
  <CreateRaceDialog />                              modal
  <BookieParlorModal heat />                        modal (§5E)
</MultiplayerHubScreen>
```

### State & data flow

```ts
interface HubState {
  clockSkewMs: number;                    // server time − local, from WS 'hello'; ALL countdowns use server time
  schedule: LobbyMatchmaking[];           // pushed by WS 'schedule' every 30 s + on change
  queued: { lobby: LobbyId; racer: RacerId; sheep: boolean } | null;
  quote: ResurrectionCalculation | null;  // "next fee if slain", refetched on Elo/wallet change
  eligibility: AiPilotContract['eligibility'] | null;
}
```

Queue state machine per lobby card:

```
idle ─JOIN─► validating ─ok─► queued ─T-2min─► locked ─T0─► loading-grid ─► racing ─► results
   ▲            │ fail(reason)          │ LEAVE (≤ T-2min, entry refunded)
   └────────────┴───────────────────────┘
```

Rejection reasons are surfaced *inline on the card* (not toasts): `soul-sick (5h 12m)`, `racer-dead`, `insufficient-gold (need 150, have 90)`, `elo-bracket`, `lobby-full`, `already-queued`.

### Card specs

- **Unranked card:** countdown ring (10-min cycle), queued count, "Free · no death" chip, **Sheep Hire toggle** (shows `-25 g · est. +50–100 g`, and the diminishing-returns meter "8 / 12 full-rate today"). If wallet < 25 g the toggle is disabled with the tooltip "Can't afford a sheep — see AI Pilot Contract".
- **Ranked card:** skull icon, red-brass border, entry fee by bracket, **"Next fee if slain"** line pulled from `calculateResurrectionCost(n+1, elo, snw)`. Soul Sickness replaces the JOIN button with a countdown and a "Queue Unranked instead" secondary.
- **Create card:** opens `CreateRaceDialog`: track picker (thumbnail grid), field-size slider snapping 4/8/12/20/50/100, collision segmented control (Full · Ghost start · Ghost), entry fee numeric (0–5,000, step 50), spectator betting toggle (disabled if field < 8: markets too thin), private code toggle. Hosting costs 5 % of the entry pool as `lobby-host-fee` (sink) when fee > 0.

### AI Pilot Contract card (bankrupt safety net)

```
┌─ 🤖 AI PILOT CONTRACT ─────────────────────────────┐
│ Flat broke? The Guild needs drivers.               │
│ Pilot a standard runner in unranked fill-in races. │
│ Pay: 25–50 g per finish (50 % of sheep payout)     │
│ ✔ wallet < 25 g  ✔ no affordable racer  ✔ no loot  │
│ [ SIGN CONTRACT & QUEUE ]                          │
└────────────────────────────────────────────────────┘
```

### Lobby Room drawer (after JOIN)

```
┌─ RANKED 20:30 · Lava Loop · 100 racers ──────────── ◷ 06:12 ─┐
│ seed commit: 9f3a…c21e  (revealed at start)                   │
│ Grid preview: 10×10 portrait mosaic (DNA → 64 px, lazy)       │
│ Your slot: #47   Bracket 1500–1750   Entry paid 150 g         │
│ Betting locks in 01:12  [Open Bookie ▸]                       │
│ Chat (rate-limited, profanity filter)                         │
│ [ LEAVE (refund) ]   — disabled after queue lock (T-2:00)     │
└───────────────────────────────────────────────────────────────┘
```

### Motion, sound, accessibility

- Countdown rings tick every second with a subtle gear click in the last 10 s; ranked cards pulse red at T-60 s.
- `aria-live="polite"` region announces "Ranked heat locks in 1 minute"; every countdown also has text, never colour-only.
- Gamepad: LB/RB switch tabs, A/X/Y map to the three quick-match cards, Start opens Bookie.
- Loading: skeleton cards (fixed height, no layout shift). WS disconnect → banner "Reconnecting to the Guild…" and all JOIN buttons disabled.
