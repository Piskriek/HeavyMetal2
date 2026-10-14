// ============================================================================
// File: packages/credits/src/timeline.ts
// Fix: "Four Floats" v4b at 1.2x is 144 BPM; "See you, Sector Four" ends at 2:40.2 (160.2s);
// song file stops at 2:40.73 (160.73s) where the 8-bar (13.329s) chorus loop begins.
// Guarded for noUncheckedIndexedAccess.
// ============================================================================

export const FOUR_FLOATS_BPM = 144.0;
export const FOUR_FLOATS_BEAT_SEC = 60.0 / FOUR_FLOATS_BPM; // 0.41667s
export const FOUR_FLOATS_BAR_SEC = FOUR_FLOATS_BEAT_SEC * 4.0; // 1.66667s
export const LAST_LYRIC_END_SEC = 160.2; // 2:40.2 "See you, Sector Four"
export const SONG_SWITCH_TO_LOOP_SEC = 160.73; // 2:40.73 downbeat switch
export const CHORUS_LOOP_BARS = 8;
export const CHORUS_LOOP_DURATION_SEC = 13.329; // 8 bars at 144 BPM
export const LOOP_MIDDLE_COPY_START_SEC = 13.329;
export const LOOP_MIDDLE_COPY_END_SEC = 26.658;

export interface LyricCue {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  accentColorHex: string;
}

export interface CreditRollCard {
  id: string;
  startSec: number;
  endSec: number;
  roleHeader: string;
  names: string[];
  badgeColorHex: string;
}

export const FOUR_FLOATS_LYRIC_TIMELINE: LyricCue[] = [
  {
    id: 'lyric-01',
    startSec: 0.0,
    endSec: 13.33,
    text: 'Cold boot in the bunker, red strobe on the concrete floor...',
    accentColorHex: '#ff3d8a',
  },
  {
    id: 'lyric-02',
    startSec: 13.33,
    endSec: 26.66,
    text: 'One-bit stars above the crater when we threw the silver door.',
    accentColorHex: '#ffc13d',
  },
  {
    id: 'lyric-03',
    startSec: 26.66,
    endSec: 53.32,
    text: 'Four floats in the register: Pxd, Vtx, Lx, and Aq on the line—',
    accentColorHex: '#7cff4d',
  },
  {
    id: 'lyric-04',
    startSec: 53.32,
    endSec: 86.64,
    text: 'Not really dirt, not really stone, just a world we had to compile in time.',
    accentColorHex: '#3dc8ff',
  },
  {
    id: 'lyric-05',
    startSec: 86.64,
    endSec: 126.63,
    text: 'Now the pines are catching golden-hour light across the lake...',
    accentColorHex: '#ffc13d',
  },
  {
    id: 'lyric-06',
    startSec: 126.63,
    endSec: LAST_LYRIC_END_SEC,
    text: 'Consensus locked at eighty-five. See you, Sector Four.',
    accentColorHex: '#b46bff',
  },
];

export const CREDITS_ROLL_CARDS: CreditRollCard[] = [
  {
    id: 'card-01-creator',
    startSec: 2.0,
    endSec: 28.0,
    roleHeader: 'CREATED & DIRECTED BY',
    names: ['Francois (Piskriek) — Vision, SetMix Constitution & Studio Direction'],
    badgeColorHex: '#ffc13d',
  },
  {
    id: 'card-02-engineering',
    startSec: 28.0,
    endSec: 64.0,
    roleHeader: 'ARCHITECTURE, SHADERS & SIMULATION CORE',
    names: [
      'Claude Opus — Lead Systems Architect & Pipeline Orchestration',
      'Claude Haiku Sidecars — Deterministic Packages & Gameplay Wiring',
      'Arena.ai Champions — Pure TypeScript Simulation Kernels',
    ],
    badgeColorHex: '#7cff4d',
  },
  {
    id: 'card-03-creative',
    startSec: 64.0,
    endSec: 104.0,
    roleHeader: 'CREATIVE DIRECTION, AUDIO & DIEGETIC DESIGN',
    names: [
      'Gemini Argo — Creative Lead, Stage Lighting & 9-Zone HUD',
      'Dr. Gwen Haddy — Chief Bridge Array Engineer (Sub-Sim #01)',
    ],
    badgeColorHex: '#ff3d8a',
  },
  {
    id: 'card-04-open-source',
    startSec: 104.0,
    endSec: 142.0,
    roleHeader: 'OPEN-SOURCE & LEGAL ARCHIVE CONTRIBUTORS (RULE 18)',
    names: [
      'Freedoom & Blasphemer Projects (BSD) — Stage 0–1 Sprite Archives',
      'LibreQuake Project (BSD) — Stage 2–3 Vertex-Morphed Meshes',
      'Quaternius (CC0) & Three.js Contributors — 3D Runtime',
    ],
    badgeColorHex: '#3dc8ff',
  },
  {
    id: 'card-05-player',
    startSec: 142.0,
    endSec: SONG_SWITCH_TO_LOOP_SEC,
    roleHeader: 'AND YOU — THE LAST SYSTEMS ENGINEER',
    names: ['Thank you for rebuilding the rendering pipeline of the universe.'],
    badgeColorHex: '#b46bff',
  },
];

export function evaluateCreditsTimelineAt(elapsedSec: number): {
  activeLyric: LyricCue | null;
  activeCard: CreditRollCard | null;
  progress0to1: number;
  isChorusLoopPhase: boolean;
  chorusLoopBar0to7: number;
  chorusLoopOffsetSec: number;
} {
  const t = Math.max(0, elapsedSec);
  const activeLyric =
    FOUR_FLOATS_LYRIC_TIMELINE.find((l) => t >= l.startSec && t < l.endSec) ?? null;
  const activeCard =
    CREDITS_ROLL_CARDS.find((c) => t >= c.startSec && t < c.endSec) ?? null;

  const isChorusLoopPhase = t >= SONG_SWITCH_TO_LOOP_SEC;
  const postSwitchSec = Math.max(0, t - SONG_SWITCH_TO_LOOP_SEC);
  const chorusLoopOffsetSec = Number(
    (LOOP_MIDDLE_COPY_START_SEC + (postSwitchSec % CHORUS_LOOP_DURATION_SEC)).toFixed(3)
  );
  const chorusLoopBar0to7 =
    Math.floor(postSwitchSec / FOUR_FLOATS_BAR_SEC) % CHORUS_LOOP_BARS;

  return {
    activeLyric,
    activeCard,
    progress0to1: Number(Math.min(1.0, t / SONG_SWITCH_TO_LOOP_SEC).toFixed(4)),
    isChorusLoopPhase,
    chorusLoopBar0to7,
    chorusLoopOffsetSec,
  };
}
