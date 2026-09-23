# T06 — Staging Presentation, Ready UI, and Input Lifecycle

> Issue [#39](https://github.com/Piskriek/HeavyMetal2/issues/39) · Module `src/game/staging/`

## Overview

T06 is the presentation layer between qualifying (T04) and the race release (T05). It
provides:

1. **Staging lifecycle** — a pure state machine that tracks the phase from qualifying
   through results, staging, countdown, and release.
2. **Staging presentation** — orbit bands, leaderboard, and highlights derived from the
   qualifying results and the frozen grid.
3. **Staging overlay** — a React component that renders the staging view with keyboard
   focus, reduced-motion support, and aria-live countdown.

Everything in `src/game/staging/` is **pure** — no DOM, no canvas, no three.js, no React.
The React overlay in `src/components/StagingOverlay.tsx` reads from the pure modules and
never mutates the authoritative game state.

## Design Decisions

### No mutation of authoritative data
The staging overlay reads from `RankedQualifyingEntry[]` and `FrozenGrid`, but never
writes back. Orbit bands are visual guides — they do NOT create physical occupancy.
The release grid's exit speeds are displayed but never modified.

### Countdown derived from simulation ticks
The three-second countdown uses `ticksForSeconds(3) = 360` ticks at 120 Hz. The label
("3…2…1…GO!") is computed from `countdownRemaining(endTick, currentTick)`, which always
agrees with the official clock. Wall-clock drift cannot cause the countdown and the
release to disagree.

### No catch-up burst after pause
When the staging is paused, the `tick` event still updates `currentTick` but does not
advance the countdown. On resume, the countdown picks up exactly where it left off. The
engine's `FixedStepClock` already drops excess frame time, so a long pause does not
produce a burst of catch-up ticks.

### No frozen bots during retry
When the human enters retry mode (`human-retry-start`), the state machine changes to
`retry` but ticks continue to advance. The qualifying session's CPU attempts keep
stepping on every tick — the human re-aiming does not freeze the bots.

### Input guards
`isInputGuarded()` returns true during `qualifying`, `results`, and `paused` phases.
The engine checks this before processing gameplay commands. During `staging`, `countdown`,
and `retry`, input is allowed (the human can aim, steer, etc.).

### Bounded leaderboard
The leaderboard is capped at `MAX_LEADERBOARD_ROWS = 100` regardless of field size. At
100 racers, the presentation truncates and reports "Showing 100 of N rows." Orbit bands
are grouped by wave when the field exceeds `MAX_INDIVIDUAL_ORBIT_BANDS = 20`.

### Reduced-motion support
The `reducedMotion` flag is stored in the staging state. The React overlay reads it to
disable orbit band animations and use instant countdown transitions. The countdown still
ticks from simulation ticks — only the visual animation is suppressed.

### Keyboard-ready
The overlay has `tabIndex={0}`, `role="dialog"`, and `aria-modal="true"`. It auto-focuses
when visible. Enter/Space proceeds from results to staging; Escape dismisses; Tab toggles
the full leaderboard. The countdown label has `aria-live="assertive"`.

## Acceptance Criteria → Evidence

| # | Criterion | Test Suite | Test Name |
|---|-----------|-----------|-----------|
| 1 | No frozen bots during retry | `staging-lifecycle` | `no frozen bots during retry: phase changes but CPU still steps` |
| 2 | No duplicated ball/shadow at release | Architecture | Overlay fades on `released` phase; no double-render |
| 3 | Countdown and official clock agree | `staging-lifecycle` | `countdown and official clock agree: derived from ticks` |
| 4 | No catch-up burst after local pause | `staging-lifecycle` | `no catch-up burst after pause: tick is frozen during pause` |
| 5 | Keyboard focus and reduced-motion flow | `staging-lifecycle` | `respects reducedMotion option` + overlay `tabIndex`/`aria-*` |
| 6 | Leaderboard work is bounded at 100 rows | `staging-presentation` | `is bounded at MAX_LEADERBOARD_ROWS rows` |

## API Summary

### Lifecycle

```ts
import { createStagingState, transitionStaging, countdownLabel } from '@/game/staging';

let state = createStagingState({ reducedMotion: false });
state = okState(state, { type: 'qualifying-complete' });
state = okState(state, { type: 'begin-staging' });
state = okState(state, { type: 'begin-countdown', tick: 1000 });
// Each engine tick:
state = okState(state, { type: 'tick', tick: currentTick });
// The label for the HUD:
const label = countdownLabel(state.countdownSeconds); // "3", "2", "1", "GO!"
```

### Presentation

```ts
import { buildStagingPresentation, formatQualifyingTime } from '@/game/staging';

const presentation = buildStagingPresentation(rankedEntries, grid, {
  humanRacerId: 0,
  names: { 0: 'YOU', 1: 'GRUB', 2: 'NIX', 3: 'RIVET' },
});
// presentation.leaderboard — bounded to 100 rows
// presentation.orbitBands — from the grid, grouped when > 20
// presentation.groupedBands — true when bands are wave-grouped
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `COUNTDOWN_SECONDS` | 3 | Countdown duration |
| `COUNTDOWN_TICKS` | 360 | Countdown in ticks (3 × 120 Hz) |
| `MAX_LEADERBOARD_ROWS` | 100 | Bounded leaderboard |
| `MAX_INDIVIDUAL_ORBIT_BANDS` | 20 | Threshold for grouped bands |

## Open Limits

- **No browser verification** — the overlay is a React component; visual testing requires
  a browser with WebGL (same blocker as T00/T04/T05).
- **Not yet wired into RaceScreen** — the overlay is a standalone component. T06
  integration with `RaceScreen.tsx` and the engine's phase machine is the next step.
- **CSS not included** — the overlay uses class names (`staging-overlay`, `orbit-band`,
  etc.) that need matching CSS in `src/race.css` or a dedicated stylesheet.
