// ============================================================================
// File: apps/web/src/credits/timeline.ts
// Brief: TASK-33 / TICKET-14 (Real-Time In-Engine Credits Music Video — "Four Floats" v4b)
// Tempo: 144 BPM (1.2x speed v4b, 1 beat = 0.4167 s, 1 bar = 1.6667 s)
// Rescaled to the real built track:
// - Last vocal line "See you, Sector Four" ends at 2:40.2 (160.20 s)
// - Song switches to music-ending-loop.mp3 at 2:40.73 (160.73 s)
// - Loop region from levels.json: start = 13.328957 s, end = 26.657914 s (8 bars @ 144 BPM)
// Pure TypeScript: zero DOM, zero timers, zero external runtime dependencies.
// ============================================================================

export type HudFidelitySkin = '0a' | '0b' | '1' | '2' | '3' | '4-6';

export interface FourFloats {
  readonly Pxd: number;
  readonly Vtx: number;
  readonly Lx: number;
  readonly Aq: number;
}

export interface StagePostUniforms {
  readonly uPxd: number;
  readonly uVtx: number;
  readonly uLx: number;
  readonly uAq: number;
  readonly uWireframeMix: number;
  readonly uIrisExposure: number;
  readonly uWetLens: number;
  readonly uHasActiveMachine: number;
}

/**
 * Pure stage post-processing uniform evaluator for the credits sequence.
 */
export function computeStagePostUniforms(
  floats: FourFloats,
  hasActiveMachine: boolean,
  currentIrisEV: number,
  targetIrisEV: number,
  dt: number,
  wetLens = 0,
): StagePostUniforms {
  const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.25, dt) : 0.016;
  const alpha = 1 - Math.exp(-safeDt / 0.22);
  const nextIris = currentIrisEV + (targetIrisEV - currentIrisEV) * alpha;
  const uWireframeMix = floats.Pxd < 0.1 ? 1.0 : 0.0;
  return {
    uPxd: floats.Pxd,
    uVtx: floats.Vtx,
    uLx: floats.Lx,
    uAq: floats.Aq,
    uWireframeMix,
    uIrisExposure: nextIris,
    uWetLens: Math.max(0, Math.min(1, wetLens)),
    uHasActiveMachine: hasActiveMachine ? 1 : 0,
  };
}

export const CREDITS_BPM = 144;
export const SECONDS_PER_BEAT = 60 / CREDITS_BPM;      // 0.4166667 s
export const SECONDS_PER_BAR  = SECONDS_PER_BEAT * 4;  // 1.6666667 s

/** Timestamp where "See you, Sector Four" finishes (2:40.2 = 160.20 s). */
export const VOCAL_LINE_END_SEC = 160.20;
/** Timestamp where music-ending.mp3 ends and music-ending-loop.mp3 takes over (2:40.73 = 160.73 s). */
export const VOCAL_SWITCH_SEC = 160.73;

export interface MusicOutroMeta {
  readonly bpm: number;
  readonly vocalEnd: number;
  readonly outroStart: number;
  readonly loopStart: number;
  readonly loopEnd: number;
}

/**
 * Default loop metadata matching `apps/web/public/audio/levels.json` (`music-ending-loop`: 13.328957 .. 26.657914)
 * and the 2:40.73 (`160.73 s`) switch after "See you, Sector Four" (`160.20 s`).
 */
export const DEFAULT_OUTRO_META: MusicOutroMeta = {
  bpm: 144,
  vocalEnd: VOCAL_LINE_END_SEC,
  outroStart: VOCAL_SWITCH_SEC,
  loopStart: 13.328957,
  loopEnd: 26.657914,
};

/**
 * Parses `MusicOutroMeta` from `apps/web/public/audio/levels.json` (or `outro.json` if provided).
 */
export function parseOutroMeta(raw: unknown): MusicOutroMeta {
  if (!raw || typeof raw !== 'object') return DEFAULT_OUTRO_META;
  const obj = raw as Record<string, unknown>;

  // Case 1: levels.json format `{ levels: { "music-ending-loop": { start, end } } }`
  if (obj.levels && typeof obj.levels === 'object') {
    const levels = obj.levels as Record<string, { start?: number; end?: number }>;
    const loopEntry = levels['music-ending-loop'];
    if (
      loopEntry &&
      typeof loopEntry.start === 'number' &&
      typeof loopEntry.end === 'number' &&
      loopEntry.end > loopEntry.start
    ) {
      return {
        bpm: 144,
        vocalEnd: VOCAL_LINE_END_SEC,
        outroStart: VOCAL_SWITCH_SEC,
        loopStart: loopEntry.start,
        loopEnd: loopEntry.end,
      };
    }
  }

  // Case 2: direct outro.json format `{ bpm, outroStart, loopStart, loopEnd }`
  const bpm = typeof obj.bpm === 'number' && obj.bpm > 0 ? obj.bpm : 144;
  const outroStart =
    typeof obj.outroStart === 'number' && obj.outroStart > 0
      ? obj.outroStart
      : DEFAULT_OUTRO_META.outroStart;
  const loopStart =
    typeof obj.loopStart === 'number' && obj.loopStart >= 0
      ? obj.loopStart
      : DEFAULT_OUTRO_META.loopStart;
  const loopEnd =
    typeof obj.loopEnd === 'number' && obj.loopEnd > loopStart
      ? obj.loopEnd
      : DEFAULT_OUTRO_META.loopEnd;

  return {
    bpm,
    vocalEnd: VOCAL_LINE_END_SEC,
    outroStart,
    loopStart,
    loopEnd,
  };
}

export type CreditsChapterId =
  | 'ch1-cold-boot'
  | 'ch2-one-bit-facets'
  | 'ch3-chorus-bloom'
  | 'ch4-archive-rifts'
  | 'ch5-window-heal'
  | 'ch6-suitcam-finale'
  | 'ch7-outro-loop';

export interface CreditsShotSpec {
  readonly id: string;
  readonly tStart: number;
  readonly tEnd: number;
  readonly cameraPreset: string;
  readonly description: string;
}

export interface CreditsChapterSpec {
  readonly id: CreditsChapterId;
  readonly index: number;
  readonly title: string;
  readonly stage: number;
  readonly stageBadge: string;
  readonly hudSkin: HudFidelitySkin;
  readonly floats: FourFloats;
  readonly tStart: number;
  readonly tEnd: number; // Infinity for ch7-outro-loop
  readonly shots: readonly CreditsShotSpec[];
}

export interface LyricCue {
  readonly tStart: number;
  readonly tEnd: number;
  readonly line: string;
  readonly nextLine?: string;
  readonly section:
    | 'intro'
    | 'verse1'
    | 'verse2'
    | 'prechorus1'
    | 'chorus1'
    | 'verse3'
    | 'verse4'
    | 'prechorus2'
    | 'chorus2'
    | 'bridge'
    | 'finalchorus'
    | 'outro';
}

/**
 * 7 Chapters rescaled monotonically across 0.00 s .. 160.73 s (2:40.73 switch),
 * walking all 6 progressive HUD skins ('0a' -> '0b' -> '1' -> '2' -> '3' -> '4-6').
 */
export const CREDITS_CHAPTERS: readonly CreditsChapterSpec[] = [
  {
    id: 'ch1-cold-boot',
    index: 1,
    title: 'Cold Boot & Wireframe Moon',
    stage: 0,
    stageBadge: 'STAGE 0a // VECTOR WIREFRAME',
    hudSkin: '0a',
    floats: { Pxd: 0.02, Vtx: 0.02, Lx: 0.05, Aq: 0.00 },
    tStart: 0.00,
    tEnd: 25.00,
    shots: [
      {
        id: 'SHOT-1A',
        tStart: 0.00,
        tEnd: 8.33,
        cameraPreset: 'lab-wake-breaker',
        description: 'Dark Lab wake under 1.2Hz red strobe; red button ("you pulled it right in front of me"); armoured glove throws Power Wall breaker.',
      },
      {
        id: 'SHOT-1B',
        tStart: 8.33,
        tEnd: 16.67,
        cameraPreset: 'gate-threshold-wireframe',
        description: 'Gate ribbed amber coils ignite bottom-to-top; step onto Stage 0a Hidden-Line Vector Wireframe Moon under real starry lunar sky.',
      },
      {
        id: 'SHOT-1C',
        tStart: 16.67,
        tEnd: 25.00,
        cameraPreset: 'pad-first-drill',
        description: 'Astro in armoured suit places first Rock Drill and Texture Mill on wireframe stone with #7cff4d bottom-up print sweep.',
      },
    ],
  },
  {
    id: 'ch2-one-bit-facets',
    index: 2,
    title: '1-Bit Facets & The 12 kW Brownout',
    stage: 1,
    stageBadge: 'STAGE 0b -> 1 // 1-BIT & EGA FACETS',
    hudSkin: '0b',
    floats: { Pxd: 0.24, Vtx: 0.22, Lx: 0.18, Aq: 0.00 },
    tStart: 25.00,
    tEnd: 50.00,
    shots: [
      {
        id: 'SHOT-2A',
        tStart: 25.00,
        tEnd: 33.33,
        cameraPreset: 'crater-facet-wave',
        description: 'Radial scan-wave fills wireframe triangles into Stage 0b 1-Bit Flat-Shaded Facets; Astro fires real-size (1.0x) Extraction Beam Rifle.',
      },
      {
        id: 'SHOT-2B',
        tStart: 33.33,
        tEnd: 41.67,
        cameraPreset: 'gate-brownout-power-unit',
        description: '4th machine trips 12 kW Gate breaker into amber brownout; Astro bolts down Power Unit (+kW) as Stage 1 EGA mineral facets lock in.',
      },
      {
        id: 'SHOT-2C',
        tStart: 41.67,
        tEnd: 50.00,
        cameraPreset: 'lab-studio-schema',
        description: 'Whip-pan to Lab Studio terminal (A4-03) patching "dirt" in schema; HUD skin glitches from 0b to 1 (EGA double-border).',
      },
    ],
  },
  {
    id: 'ch3-chorus-bloom',
    index: 3,
    title: 'Chorus 1: Four Floats in the Dark',
    stage: 2,
    stageBadge: 'STAGE 1 -> 2 // EGA TO 256-COLOR VGA & SHADOWS',
    hudSkin: '1',
    floats: { Pxd: 0.52, Vtx: 0.48, Lx: 0.42, Aq: 0.10 },
    tStart: 50.00,
    tEnd: 75.00,
    shots: [
      {
        id: 'SHOT-3A',
        tStart: 50.00,
        tEnd: 63.33,
        cameraPreset: 'outpost-four-plumes-crane',
        description: 'Crane shot behind Sheet 13 gunmetal box-section foundations; Texture Mill (#ff3d8a), Shape Press (#7cff4d), Light Projector (#ffc13d), and Water Maker (#3dc8ff) fire on beat.',
      },
      {
        id: 'SHOT-3B',
        tStart: 63.33,
        tEnd: 75.00,
        cameraPreset: 'vga-shadows-grass-bloom',
        description: 'Stage 2 VGA 1024^2 directional shadows sweep across boulders as emerald grass blooms under the Moon twilight sky.',
      },
    ],
  },
  {
    id: 'ch4-archive-rifts',
    index: 4,
    title: 'Archive Rifts, Vance Ridge & Rover Jump',
    stage: 3,
    stageBadge: 'STAGE 2 -> 3 // VGA TO 16-BIT GOURAUD & RAYLEIGH SKY',
    hudSkin: '2',
    floats: { Pxd: 0.70, Vtx: 0.68, Lx: 0.68, Aq: 0.32 },
    tStart: 75.00,
    tEnd: 101.67,
    shots: [
      {
        id: 'SHOT-4A',
        tStart: 75.00,
        tEnd: 83.33,
        cameraPreset: 'rim-rift-sprites-md1',
        description: 'Under Moon Rayleigh blue sky, vertical glitch Rift Column spawns 2D Freedoom sprite then 3D LibreQuake .md1 brute; 2 kW Perimeter Turret & Seal beam engage.',
      },
      {
        id: 'SHOT-4B',
        tStart: 83.33,
        tEnd: 93.33,
        cameraPreset: 'vance-ridge-rover-jump',
        description: 'Modular Scout Rover (empty tinted cab, square [-u-] yoke, raycast aerial) crests Vance Wreck Ridge in 1.62 m/s^2 lunar gravity against real lunar sky.',
      },
      {
        id: 'SHOT-4C',
        tStart: 93.33,
        tEnd: 101.67,
        cameraPreset: 'combiner-violet-splice',
        description: 'Lab Preset Combiner (#b46bff violet globe) fuses Anomaly Core + cartridges into Golden Master .smx.',
      },
    ],
  },
  {
    id: 'ch5-window-heal',
    index: 5,
    title: 'Hydro Lakes & The Earth Window Breach Heals',
    stage: 5,
    stageBadge: 'STAGE 4 -> 5 // HYDRO LAKES & COVERAGE',
    hudSkin: '3',
    floats: { Pxd: 0.82, Vtx: 0.80, Lx: 0.80, Aq: 0.65 },
    tStart: 101.67,
    tEnd: 128.33,
    shots: [
      {
        id: 'SHOT-5A',
        tStart: 101.67,
        tEnd: 113.33,
        cameraPreset: 'hydro-basin-flood',
        description: 'Sheet 17 Heavy Terraformers on 8m hardpoints flood the eastern lunar basin with turquoise water (@hm/hydro) as moss and clover creep up the banks.',
      },
      {
        id: 'SHOT-5B',
        tStart: 113.33,
        tEnd: 128.33,
        cameraPreset: 'lab-window-breach-heal',
        description: 'Astro pulls Operator Console Master Sync Lever; outside the 14.8m x 3.1m window, the 120m cyan Breach Column zips shut and golden-hour trees bloom across Earth.',
      },
    ],
  },
  {
    id: 'ch6-suitcam-finale',
    index: 6,
    title: 'Suit-Cam PBR Biosphere & The 11 Domes',
    stage: 6,
    stageBadge: 'STAGE 6 // SUIT-CAM CMOS PBR (1.00)',
    hudSkin: '4-6',
    floats: { Pxd: 1.00, Vtx: 1.00, Lx: 1.00, Aq: 1.00 },
    tStart: 128.33,
    tEnd: VOCAL_SWITCH_SEC,
    shots: [
      {
        id: 'SHOT-6A',
        tStart: 128.33,
        tEnd: 145.00,
        cameraPreset: 'suitcam-fpv-forest-walkout',
        description: 'First-person Suit-Cam walkout through Twin Gate: lagging auto-exposure iris blows out sky (+0.85 EV) then reveals L-system conifer forest, fauna, and Heavy Crawler.',
      },
      {
        id: 'SHOT-6B',
        tStart: 145.00,
        tEnd: VOCAL_SWITCH_SEC,
        cameraPreset: 'horizon-11-domes-crane',
        description: 'High crane shot over shimmering lake and forest canopy toward 11 neighboring enclave domes on the 4.2 km lunar horizon as vocal ends on "See you, Sector Four".',
      },
    ],
  },
  {
    id: 'ch7-outro-loop',
    index: 7,
    title: 'Instrumental Chorus Loop: Dual-World Diptych',
    stage: 6,
    stageBadge: 'SECTOR 04 // KERNEL COMPILED (1.00, 1.00, 1.00, 1.00)',
    hudSkin: '4-6',
    floats: { Pxd: 1.00, Vtx: 1.00, Lx: 1.00, Aq: 1.00 },
    tStart: VOCAL_SWITCH_SEC,
    tEnd: Number.POSITIVE_INFINITY,
    shots: [
      {
        id: 'SHOT-7A',
        tStart: VOCAL_SWITCH_SEC,
        tEnd: Number.POSITIVE_INFINITY,
        cameraPreset: 'lab-healed-diptych-hold',
        description: 'Loops seamlessly on levels.json 144 BPM bar grid: healed golden-hour Earth window on left, lush Stage 6 Lunar forest through open Gate on right, rotating Planet Table in foreground.',
      },
    ],
  },
];

/**
 * Synced Lyric Cues for "Four Floats" v4b (144 BPM across 0.00 .. 160.73 s,
 * ending on "See you, Sector Four." at 160.20 s / 2:40.2 and switching at 160.73 s / 2:40.73).
 */
export const CREDITS_LYRIC_CUES: readonly LyricCue[] = [
  { tStart: 0.00,   tEnd: 8.33,   section: 'intro',       line: '[144 BPM CHIPTUNE & DRUM MACHINE INTRO]', nextLine: 'Lights out, breakers down, static where the sky should be.' },
  { tStart: 8.33,   tEnd: 16.67,  section: 'verse1',      line: 'Lights out, breakers down — static where the sky should be.', nextLine: 'Told you not that switch — you pulled it right in front of me.' },
  { tStart: 16.67,  tEnd: 25.00,  section: 'verse1',      line: 'Told you not that switch — you pulled it right in front of me.', nextLine: 'Wireframe moon, so cold, just the lines and not the stone.' },
  { tStart: 25.00,  tEnd: 33.33,  section: 'verse2',      line: 'Wireframe moon, so cold — just the lines and not the stone.', nextLine: 'Then your mill came on and the pixels came back home.' },
  { tStart: 33.33,  tEnd: 41.67,  section: 'verse2',      line: 'Then your mill came on — and the pixels came back home.', nextLine: 'One bit, sixteen, two-five-six, turn it up, turn it up.' },
  { tStart: 41.67,  tEnd: 50.00,  section: 'prechorus1',  line: 'One bit, sixteen, two-five-six — turn it up, turn it up.', nextLine: 'Four floats in the dark, pixels, vertices and light!' },
  { tStart: 50.00,  tEnd: 63.33,  section: 'chorus1',     line: 'Four floats in the dark — pixels, vertices and light,', nextLine: 'Pour a little water and the moon comes back tonight.' },
  { tStart: 63.33,  tEnd: 75.00,  section: 'chorus1',     line: 'Four floats in the dark — watch it render, line by line.', nextLine: "It's not really dirt, but the world is looking fine." },
  { tStart: 75.00,  tEnd: 83.33,  section: 'verse3',      line: 'Sprites from ninety-three — crawling out to say hello.', nextLine: 'Seal them with the beam, send the archive down below.' },
  { tStart: 83.33,  tEnd: 93.33,  section: 'verse4',      line: 'Vance went out alone — lost his signal on the ridge.', nextLine: 'You had me, and tape, and a Studio, and the Bridge.' },
  { tStart: 93.33,  tEnd: 101.67, section: 'prechorus2',  line: 'One bit, sixteen, two-five-six — turn it up, turn it up.', nextLine: 'Four floats in the dark, pixels, vertices and light!' },
  { tStart: 101.67, tEnd: 113.33, section: 'chorus2',     line: 'Four floats in the dark — pixels, vertices and light,', nextLine: 'Pour a little water and the moon comes back tonight.' },
  { tStart: 113.33, tEnd: 128.33, section: 'bridge',      line: 'Look out the window now — the tear is sewing shut,', nextLine: "The grass is switching on. Don't ask who's running us." },
  { tStart: 128.33, tEnd: 145.00, section: 'finalchorus', line: 'Four floats in the dark — watch it render, line by line.', nextLine: "It's not really dirt, but the world is looking fine." },
  { tStart: 145.00, tEnd: 153.50, section: 'outro',       line: "Don't touch the red one.", nextLine: 'See you, Sector Four.' },
  { tStart: 153.50, tEnd: 160.20, section: 'outro',       line: 'See you, Sector Four.', nextLine: '[INSTRUMENTAL CHORUS LOOP — SECTOR 04 ONLINE]' },
  { tStart: 160.20, tEnd: 160.73, section: 'outro',       line: '[CHIPTUNE BEEP // OUTRO HANDOFF @ 2:40.73]' },
];

export interface CreditsSectionBlock {
  readonly heading: string;
  readonly entries: readonly { readonly role?: string; readonly name: string; readonly detail?: string }[];
}

export function buildCreditsRollManifest(operatorName = 'Operator Astro'): CreditsSectionBlock[] {
  return [
    {
      heading: 'FIDELITY // THE SETMIX MULTIVERSE',
      entries: [
        { role: 'CREATED & DIRECTED BY', name: 'Francois (Piskriek)', detail: 'Original Concept, World Constitution, Four-Float Architecture & Direction' },
        { role: 'CREATIVE LEAD', name: 'Gemini Argo', detail: 'Art Direction, Stage Look Bible, Lore Expansion, Audio & UX Plans' },
        { role: 'ENGINEERING LEAD', name: 'Claude Opus', detail: 'Core Engine, Pure Simulation Packages, Shader Pipeline, Asset Bake & Tooling' },
        { role: 'IMPLEMENTATION SIDECARS', name: 'Claude Haiku Sidecar Fleet', detail: 'Sequential Brief Execution & Verification' },
        { role: 'PURE-PACKAGE CODE BATTLES', name: 'Arena.ai Contestants', detail: 'Pure TypeScript Simulation & Math Modules' },
        { role: 'EARLY PROTOTYPE SCAFFOLDING', name: 'Gemini Flash' },
        { role: 'FIELD SYSTEMS ENGINEER (OPERATOR)', name: operatorName },
      ],
    },
    {
      heading: 'VOICE & ORIGINAL MUSIC',
      entries: [
        { role: '"DR. GWEN HADDY" VOICEOVER', name: 'RUN.world Voice Pipeline', detail: 'Radio DSP Chain & Web Audio Synth' },
        { role: 'ENDING THEME: "FOUR FLOATS" (v4b @ 144 BPM) & "FOUR FLOATS (OVERCLOCKED)"', name: 'Gemini Argo & Claude Opus (Lyrics & Story)', detail: 'RUN.world (ElevenLabs) Generation, Demucs & scripts/music-outro.py Loop, @hm/musicbox Synth' },
      ],
    },
    {
      heading: '3D GENERATION & BAKE PIPELINE',
      entries: [
        { role: 'CONCEPT SHEETS & MULTI-VIEW PLATES', name: 'RUN.world Image Generation' },
        { role: 'ARMOURED ASTRONAUT CHARACTER ("ASTRO")', name: 'Meshy.ai', detail: '3D Character Generation & Rigging' },
        { role: '3D MESH SYNTHESIS', name: 'Local Hunyuan3D 2.1 Pipeline' },
        { role: 'AUTOMATED LOD & DE-METALLED BAKING', name: 'Blender 5.2 Headless Bake Pipeline', detail: 'low.glb / mid.glb / high.glb' },
      ],
    },
    {
      heading: 'OPEN-SOURCE & LEGAL ASSET CREDITS',
      entries: [
        { role: '2D ARCHIVE SPRITES & RETRO AUDIO LUMPS', name: 'Freedoom Project & Blasphemer Project', detail: 'BSD-3-Clause License' },
        { role: 'EARLY-3D VERTEX-MORPHED MONSTER MESHES', name: 'LibreQuake Project', detail: 'BSD-3-Clause License' },
        { role: 'RIGGED 3D LOW-POLY MONSTER & PROP MESHES', name: 'Quaternius', detail: 'CC0 1.0 Public Domain' },
        { role: 'RENDERING & RUNTIME ENGINE', name: 'three.js & React', detail: 'MIT License' },
        { role: 'TYPOGRAPHY (SIL OPEN FONT LICENSE 1.1)', name: 'Oxanium (Severin Meyer), Inter (Rasmus Andersson)', detail: 'SIL OFL-1.1' },
        { role: 'PIXEL TYPEFACE (FIDELITY PIXEL 5x7)', name: 'Drawn in-house for this game', detail: 'Generated by scripts/build-pixel-font.mjs' },
      ],
    },
  ];
}

export interface CreditsPlaybackState {
  readonly elapsedSec: number;
  readonly barNumber: number;
  readonly beatInBar: number;
  readonly beatPulse: number; // 1.0 on beat downstroke -> decays to 0.0
  readonly chapter: CreditsChapterSpec;
  readonly activeShot: CreditsShotSpec;
  readonly activeLyric: LyricCue | null;
  readonly isLoopingOutro: boolean;
  readonly loopedAudioTime: number;
}

/**
 * Pure deterministic lookup of the entire credits director state at any timestamp t >= 0.
 */
export function getCreditsStateAt(
  elapsedSec: number,
  outro: MusicOutroMeta = DEFAULT_OUTRO_META,
): CreditsPlaybackState {
  const safeT = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  const totalBeats = safeT / SECONDS_PER_BEAT;
  const barNumber = Math.floor(totalBeats / 4) + 1;
  const beatInBar = (Math.floor(totalBeats) % 4) + 1;
  const beatFrac = totalBeats - Math.floor(totalBeats);
  const beatPulse = Math.max(0, 1 - beatFrac * 2.5);

  const isLoopingOutro = safeT >= outro.outroStart;
  const loopSpan = Math.max(0.1, outro.loopEnd - outro.loopStart);
  const loopedAudioTime = isLoopingOutro
    ? outro.loopStart + ((safeT - outro.outroStart) % loopSpan)
    : safeT;

  const chapter =
    CREDITS_CHAPTERS.find((ch) => safeT >= ch.tStart && safeT < ch.tEnd) ??
    CREDITS_CHAPTERS[CREDITS_CHAPTERS.length - 1]!;

  const activeShot =
    chapter.shots.find((s) => safeT >= s.tStart && safeT < s.tEnd) ??
    chapter.shots[chapter.shots.length - 1]!;

  const activeLyric =
    CREDITS_LYRIC_CUES.find((cue) => safeT >= cue.tStart && safeT < cue.tEnd) ?? null;

  return {
    elapsedSec: safeT,
    barNumber,
    beatInBar,
    beatPulse,
    chapter,
    activeShot,
    activeLyric,
    isLoopingOutro,
    loopedAudioTime,
  };
}
