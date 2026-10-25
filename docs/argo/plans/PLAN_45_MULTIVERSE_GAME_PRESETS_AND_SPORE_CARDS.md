# PLAN 45 // MULTIVERSE GAME PRESETS, DUAL-GATEWAY RUNTIME & STEGANOGRAPHIC SPORE CARDS
> **Status**: Approved by Argon (Creative Architect) on `30ddd8a6`  
> **Phase**: Phase 6 (Immediate Post-1.0 Execution)  
> **Target Modules**: `packages/gamepreset` (or `apps/web/src/play/game-presets.ts`), `apps/web/src/main.ts`, `apps/web/src/studio/spore-card.ts`  
> **Rule 8a Mandate**: Zero bundle duplication, zero `eval` or unsafe deserialization, 100% single-engine reuse across exploration, racing, arena combat, and creature ecosystems.  

---

## 0. THE RUNG 5 GAME PRESET CONCEPT

A "Game Mode" in the SetMix Multiverse is not a separate codebase, forked loop, or standalone executable. It is a declarative **Rung 5 Preset** (`MultiverseGamePresetSpec`).

Just as a machine is assembled from parts on sockets, an entire playable game (circuit racing, wave survivor, ecosystem observer, factory automation, Stargate escape) is assembled by configuring:
1. **Camera Mode** (`first-person-suit`, `third-person-orbit`, `vehicle-chase`, `isometric-tactical`).
2. **HUD Blade** (`exploration-o2`, `race-lap-telemetry`, `arena-wave-survivor`, `ecosystem-observer`).
3. **Player Rig** (`kit:astro-suit`, `kit:scout-rover`, `kit:crawler-rig`, or any `CreatureGenomeSpec` ID).
4. **Active Rules & Win Conditions** (gravity, stage anim cadence, lap checkpoints, wave triggers, score/time limits).
5. **Roster Overrides** (which kits, vehicles, and creatures populate the world).

Every game mode executes on the exact same WebGL2 canvas, `@hm/matstack` shader pipeline, `kit-target.ts` AABB slab raycaster, and `@hm/soundlab` acoustic synthesizer.

---

## 1. DECLARATIVE `MultiverseGamePresetSpec` SCHEMA

```typescript
export interface MultiverseGamePresetSpec {
  readonly id: string;
  readonly title: string;
  readonly version: 1;
  readonly worldSeed: number;
  readonly stageBiomeId: string;
  readonly cameraMode: 'first-person-suit' | 'third-person-orbit' | 'vehicle-chase' | 'isometric-tactical';
  readonly hudBlade: 'exploration-o2' | 'race-lap-telemetry' | 'arena-wave-survivor' | 'ecosystem-observer';
  readonly playerRigId: string; // e.g. 'kit:astro-suit', 'kit:scout-rover', 'kit:crawler-rig', or any CreatureGenomeSpec ID
  readonly activeRules: {
    readonly gravityScale: number;
    readonly stageAnimRateHz: number; // 8..60 Hz
    readonly winCondition: 'stargate-escape' | 'checkpoint-circuit' | 'wave-clearance' | 'sandbox-freeplay';
    readonly targetScoreOrTimeSec: number;
  };
  readonly rosterOverrides: readonly string[]; // Kit/Creature IDs active in this preset
}
```

---

## 2. 6-LINE DUAL-GATEWAY ROUTER IN `apps/web/src/main.ts`

To allow creators, players, and autonomous BYOA agents to share direct clickable links that boot straight into custom games, `apps/web/src/main.ts` provides a lightweight query-param branch:

```typescript
// Dual-Gateway Query Router (apps/web/src/main.ts)
const urlParams = new URLSearchParams(window.location.search);
const standaloneGame = urlParams.get('game');
const worldSeed = urlParams.get('world') ? Number(urlParams.get('world')) : undefined;
const playerRig = urlParams.get('rig') ?? undefined;

if (standaloneGame) {
  // Boots standalone mode: swaps HUD blade and camera controller without booting the Moon campaign loop
  bootStandaloneGameMode({ gameId: standaloneGame, worldSeed, playerRig });
} else {
  // Standard Stargate campaign loop (Moon base -> Stargate -> Restored Earth)
  bootCampaign();
}
```

### Key Architectural Properties:
- **Zero Duplication**: Reuses 100% of the engine bundle and assets.
- **Frictionless Web Play**: Players clicking `/?game=circuit-rally&world=42069` are immediately in the driver's seat of a Scout rover on a Stage-6 Earth track without having to play through the Moon prologue.
- **In-Universe Parity**: Stepping through an active Stargate Event Horizon in the campaign performs the exact same preset switch internally.

---

## 3. STEGANOGRAPHIC PNG SPORE CARDS (`apps/web/src/studio/spore-card.ts`)

Inspired by Will Wright’s *Spore* (2008) creature card PNGs and [`wheresryan22/anatomy`'s collectible plate cards](https://github.com/wheresryan22/anatomy/blob/main/SKILL.md), any Rung 4 or Rung 5 creation (`MaterialSpec`, `KitSpec`, `CreatureGenomeSpec`, or `MultiverseGamePresetSpec`) can be shared as a single image file.

### 3.1 Encoding (`encodeSporeCardPng`)
1. **Turntable Snapshot**: The offscreen WebGL renderer captures a $512 \times 512$ beauty portrait with an integrated title badge, author signature, seed, and 6-zone coverage / audit stamp.
2. **Lossless Zlib Compression**: The canonical JSON preset is compressed using `fflate.zlibSync` (level 9).
3. **PNG Chunk Injection**: The compressed payload is injected into a standard PNG **`zTXt`** ancillary chunk under the keyword `"hm2:preset:v1"`, computing the exact IEEE 802.3 CRC-32 checksum.
4. **Result**: A standard `.png` file that previews beautifully in any browser, Discord, Twitter/X, or OS file explorer, while silently containing the full mathematical genome.

### 3.2 Decoding & Security Sandbox (`decodeSporeCardPng`)
When a player or agent drags a `.png` onto the browser viewport or Studio workbench:
1. **Header & Chunk Table Scan**: Parses the PNG chunk table without rendering or executing pixel buffers.
2. **Decompression Bomb Protection**: Caps decompressed payload size at a strict **`256 KiB`**.
3. **Zero `eval` / Zero Code Execution**: The decompressed string is parsed strictly via `JSON.parse()`.
4. **Frozen Schema Validation**: Validates the payload against frozen TypeScript/Zod schemas (`MultiverseGamePresetSchema.safeParse(json)`).
5. **Audit Verification**: Any embedded kit or creature must pass `studio.kit.audit(spec)`.
6. **Graceful Refusal**: Corrupted, tampered, or invalid PNGs return a structured refusal toast without mutating world state or undo history.
