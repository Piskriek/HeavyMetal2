# PLAN 58 // Unified Preset Menu & Interface System (From-Scratch Holo-Deck, LitRPG System & Rung-6 Meta-Shell)
> **Author**: Argon (Creative & Modular Systems Architect) & Piskriek (Owner)  
> **Date**: 2026-10-29  
> **Status**: ACTIVE SPECIFICATION & WAVE 1 IMPLEMENTATION  
> **Owner Directive**: *"we also need to remove all the old game stuff from the lab/gate idea. plan a new menu and interface system. from scratch, covering everthing and matching in style, its should be presets so the style can be changed"*  
> **Packages**: `@hm/hudlayout` (`packages/hudlayout/src/ui.ts`), `@hm/harness` (`packages/harness/src/meta-shell.ts`), `apps/web/src/shell/*`, `apps/web/src/play/ui-*`, `apps/web/src/studio/*`

---

## 1. Executive Summary & Design Philosophy
Previously, FIDELITY's menus and interfaces grew across three different eras:
1. The early **SetMix / Goblin Racing** island browser (`goblin-front.tsx`, `galaxy.tsx`);
2. The parked **Earth Bunker Lab / Console Lever / Moon Twin Gate / Dr. Gwen Haddy** storyline (`planetary-grid.tsx` locking Moon spawn behind the Earth Lab lever, `shell.tsx` warning *"The Moon Twin Gate is still dark. Pull the console lever in the Earth lab first"*, *"Substrate Research Initiative"*);
3. The new **Plan 57 Seeded Solar System + LitRPG System + Holo-Room Game Bridge**.

**Plan 58** replaces the fragmented legacy menu/HUD styling with a **single, unified, 100% preset-driven Menu & Interface Architecture**:
1. **Complete Purge of Legacy Lab/Gate Storyline Locks from Active UI**:
   - No menu or spawn selector ever locks the player behind the parked Earth Lab console lever (`gateOn`), references "Earth Bunker / Operator Console", or shows hardcoded story telemetry ("Containment integrity 98.4%", "Dr. Gwen Haddy").
   - Legacy `?story` tests keep their isolated entry path, while the default game is 100% **Seeded Worlds + Holo-Room + Studio**.
2. **Everything is a 5-Rung `ui:` Preset (`@hm/hudlayout`)**:
   - Every screen in the application—**Home Holo-Deck**, **Solar System & Stargate Map**, **In-Game LitRPG System HUD**, **Rung-6 Wanderer Meta-Shell (Comms, Party/Guild, Clip Recorder, Harness Bridge, Higher Self Seat)**, and **The Studio**—climbs the same 5 rungs:
     $$\text{Rung 1 (Tokens / Style)} \to \text{Rung 2 (Widget Look)} \to \text{Rung 3 (Grounded Part)} \to \text{Rung 4 (Panel)} \to \text{Rung 5 (Screen)}$$
3. **One Style Preset Changes the Entire Game's Look (`UI_STYLE_SHELF` + `uiTokensToCssVars`)**:
   - Every colour, surface translucency, corner radius, typography family, scale factor, and motion rule flows from Rung-1 `UiTokens` into root CSS custom properties (`--ui-ink`, `--ui-paper`, `--ui-accent`, `--ui-warn`, `--ui-dim`, `--ui-font`, `--ui-scale`, `--ui-radius`).
   - Selecting or hovering any style preset on the shelf (or importing a `uic:` share code) immediately restyles the Home Menu, Modal Dialogs, Solar System Map, Play HUD, and Meta-Shell in unison (`previews-drive-play`).

---

## 2. Legacy Lab / Gate / Storyline Clutter Purge Checklist

| Location | Legacy Lab / Story Clutter | Clean Seeded-World Replacement |
|---|---|---|
| `apps/web/src/shell/goblin-front.tsx` | Brand subtitle `"A SetMix System // Substrate Research Initiative"`; inline hardcoded `rgba(8, 12, 20, 0.74)` and `#3dc8ff` border ignoring `UiTokens`. | Subtitle `"Seeded Worlds // LitRPG & Co-Creation Sandbox"`; blade styled via `--ui-*` CSS variables from the active `UiStylePreset` + live **UI Style Switcher** with hover try-on. |
| `apps/web/src/shell/shell.tsx` | `spawnAt('gate')` blocked by `!readGridView().gateOn` with toast `"The Moon Twin Gate is still dark. Pull the console lever in the Earth lab first."` | Always allow direct deployment to the **World Arrival Pad (Stage 3)** or **Stargate Plinth** without requiring the parked Earth Lab lever. |
| `apps/web/src/shell/planetary-grid.tsx` | `NEIGHBOR_ENCLAVES` `owner: 'Gwen_Haddy'`; Spawn Selector cards `"EARTH BUNKER — Earth Observation Lab (Deploy inside the bunker at Operator Console)"` and `"MOON CRATER — Moon Twin Gate Pad (Locked: Power the gate in the Lab first)"`. | `owner: 'Lyra_Vance'`; Spawn Selector cards `"ARRIVAL PAD — Seeded World (Stage 3)"` and `"STARGATE PLINTH — Active World Gate"` (unlocked, direct deployment). |
| `apps/web/src/play/ui-play-hud.ts` | Uses a single hardcoded `tokens` block on `PLAY_HUD_SCREEN`. | Supports applying any `UiStylePreset` from `UI_STYLE_SHELF` (`applyStyleToScreen(screen, styleId)`). |

---

## 3. Rung 1: The Curated UI Style Preset Shelf (`UI_STYLE_SHELF`)

Every `UiStylePreset` packages a complete, validated `UiTokens` record (`ink`, `paper`, `accent`, `warn`, `dim`, `font`, `scale`, `radius`, `reducedMotion`) plus a human-readable `id`, `name`, and `tagline`:

| Preset ID | Name | Ink / Paper / Accent / Warn / Dim | Font / Radius / Scale | Aesthetic Direction |
|---|---|---|---|---|
| `holodeck-violet` *(Default)* | **Overwatch Holo-Deck** | `#f1f5f9` / `#080c14` / `#a78bfa` / `#f43f5e` / `#94a3b8` | `setmix`, `6px`, `1.0x` | Deep obsidian glass, Overwatch drone violet, crisp technical framing. |
| `litrpg-system` | **Isekai System Appraisal** | `#f8fafc` / `#0a1628` / `#38bdf8` / `#fbbf24` / `#7dd3fc` | `sans`, `4px`, `1.0x` | Translucent sapphire appraisal slate with sky-cyan & gold status trim. |
| `stargate-ancient` | **Lantean Gate Crystal** | `#fef3c7` / `#14110b` / `#f59e0b` / `#ef4444` / `#d97706` | `setmix`, `2px`, `1.0x` | Warm bronze-obsidian and amber-gold glyph illumination. |
| `studio-precision` | **Studio CAD Dark** | `#e2e8f0` / `#111318` / `#22d3ee` / `#f97316` / `#64748b` | `mono`, `3px`, `0.95x` | Neutral engineering dark with zero-distraction monospace readouts. |
| `retro-amber-crt` | **Stage-2 Phosphor CRT** | `#ffb000` / `#0a0802` / `#ffd000` / `#ff4500` / `#b37700` | `mono`, `0px`, `1.0x` | Classic amber terminal phosphor honoring $S_1/S_2$ heritage. |
| `high-contrast` | **High-Contrast Access** | `#ffffff` / `#000000` / `#00ffff` / `#ffff00` / `#cccccc` | `sans`, `4px`, `1.15x`, `reducedMotion: true` | WCAG AAA maximum legibility, larger type scale, zero motion. |

### `uiTokensToCssVars(tokens: UiTokens)`
A pure helper in `@hm/hudlayout` that maps any `UiTokens` object to a `Readonly<Record<string, string>>` of CSS custom properties:
- `--ui-ink`: `tokens.ink`
- `--ui-paper`: `tokens.paper`
- `--ui-accent`: `tokens.accent`
- `--ui-warn`: `tokens.warn`
- `--ui-dim`: `tokens.dim`
- `--ui-font`: mapped font stack (`Oxanium` / `Inter` / `JetBrains Mono`)
- `--ui-scale`: `String(tokens.scale)`
- `--ui-radius`: `${tokens.radius}px`

---

## 4. Rung 5: The Unified Screen Suite (`UI_SCREEN_SHELF`)

Every layer of FIDELITY is represented as a validated `UiScreen` in `@hm/hudlayout` that satisfies `validateScreen(screen, sources, commands) === []` and round-trips through `encodeScreen` / `decodeScreen` (`uic:`):

### 4.1 `HOME_HOLODECK_SCREEN` (`id: 'home-holodeck'`)
- **Backdrop**: The 3D `GridRoom` (warming presets rung by rung from `S0a` to `S3`, 0 idle draws when static, 15 fps when a game window is linked to the Holo-Room screen).
- **Left Blade (`top-left` panel `home-nav`)**:
  - Brand header + Stage warm-up progress (`room.stage`, `room.warmShare`).
  - Action parts bound to real shell commands:
    - `nav.expedition` — **Enter Seeded World** (Solo/Co-Op Simulation, Stage 3 arrival with Overwatch Drone).
    - `nav.grid` — **Solar System & Stargate Network** (Seeded worlds, co-op enclaves, gate codes).
    - `nav.studio` — **The Studio** (5-rung preset & world editor + AI agent bridge).
    - `nav.community` — **Community & Guild Shelf** (Shared presets, worlds, clips).
    - `nav.settings` — **Settings & UI Theme** (Graphics, audio, bridge permissions, UI style preset).
- **Top-Right Pill (`top-right` panel `home-profile`)**:
  - Active profile name (`profile.name`), credits (`profile.credits`), and UI Style Preset selector (`ui.styleName`, `ui.cycleStyle`).
- **Bottom-Right Bridge Control (`bottom-right` panel `home-bridge`)**:
  - Holo-Room Game Bridge status (`bridge.status`) and link/unlink action (`bridge.toggleLink`).

### 4.2 `PLAY_HUD_SCREEN` (`id: 'play-hud'`)
- **Top-Left (`goal`)**: Current world stage & active objective (`goal.title`, `goal.hint`, `goal.next`).
- **Top-Center (`system`)**: Drone's LitRPG System voice notice (`system.notice`, violet/kind-bordered under the compass).
- **Top-Right (`floats`)**: Stage badge (`plot.stage`) + the Four Floats (`floats.pxd`, `floats.vtx`, `floats.lx`, `floats.aq`).
- **Middle-Right (`appraise`)**: Context-sensitive LitRPG Appraise card when aiming at any part, element, contraption, or native (`appraise.name`, `appraise.author`, `appraise.mass`, `appraise.charge`, `appraise.sockets`).
- **Bottom-Left (`comms`)**: Overwatch & Party/Guild Comms action chip (`comms.toggle`).
- **Bottom-Right (`plot` + `health`)**: Ore (`plot.ore`, rate, linked crates, out-of-ore alert), Power (`power.demand` of `power.supply`, satisfaction share, brownout alert), and Player Health (`player.hp` of `player.hpMax`, 20-segment bar, shield/low notes).

### 4.3 `META_SHELL_SCREEN` (`id: 'meta-shell'`, Plan 57 §19 Rung-6 Wanderer Layer)
- **Top-Left (`wanderer-party`)**:
  - Player Wanderer anchor status (`wanderer.bal`, `wanderer.calm` lent to drone/party).
  - Party working-group multiplier (`party.doubling` $2^{N-1}$) & Guild Social Memory Complex coherence (`guild.coherence`, `guild.pooledCauses`).
- **Bottom-Left (`comms-drawer`)**:
  - Tiered Comms feed (`comms.messages` list) + action triggers for canned callouts (`comms.pingGate`, `comms.pingCraft`, `comms.pingEureka`, `comms.pingHelp`).
- **Top-Right (`clip-stream`)**:
  - Video Clip & Shorthand Replay status (`clip.status`) + 1-click capture/share command (`clip.capture`).
- **Middle-Left (`harness-deck`)**:
  - Bridge mode readout (`harness.bridgeMode`: `off | mirror-only | checked-profile-relay`) + Higher Self Dream Cue trigger (`harness.cueDream`).

### 4.4 `STUDIO_UI_EDITOR_TAB` (Plan 57 §15 & `UI_EDITOR_RESEARCH.md` P1–P7)
- Live preview of any `UiScreen` (`PLAY_HUD_SCREEN`, `HOME_HOLODECK_SCREEN`, `META_SHELL_SCREEN`) with real `UiPanelView` rendering.
- Style preset switcher (`UI_STYLE_SHELF`) with **hover try-on** (`previews-drive-play`).
- Panel & Part inspector rows with 8px snapped offsets, live `validateScreen` lens-rule feedback, live overlap detection, and `uic:` copy/paste share codes.

