// ============================================================================
// File: apps/web/src/credits/timeline.ts
// Brief: TASK-33 (Real-Time In-Engine Credits Music Video — "Four Floats" v4b)
// Tempo: 144 BPM (1.2x speed v4b, 1 beat = 0.4167s, 1 bar = 1.6667s)
// ============================================================================

import type { FourFloats, HudFidelitySkin } from '../../../../packages/groundshader/src/stage-post.glsl';

export const CREDITS_BPM = 144;
export const SECONDS_PER_BEAT = 60 / CREDITS_BPM;      // 0.4166667 s
export const SECONDS_PER_BAR  = SECONDS_PER_BEAT * 4;  // 1.6666667 s

export interface MusicOutroMeta {
  bpm: number;
  outroStart: number;
  loopStart: number;
  loopEnd: number;
}

export const DEFAULT_OUTRO_META: MusicOutroMeta = {
  bpm: 144,
  outroStart: 116.67, // Bar 71 (1:56.67) after final vocal "Sector Four"
  loopStart: 116.67,
  loopEnd: 130.00,    // 8-bar instrumental chorus loop on 144 BPM grid
};

export type CreditsChapterId =
  | 'ch1-cold-boot'
  | 'ch2-one-bit-facets'
  | 'ch3-chorus-bloom'
  | 'ch4-archive-rifts'
  | 'ch5-window-heal'
  | 'ch6-suitcam-finale'
  | 'ch7-outro-loop';

export interface CreditsShotSpec {
  id: string;
  tStart: number;
  tEnd: number;
  cameraPreset: string;
  description: string;
}

export interface CreditsChapterSpec {
  id: CreditsChapterId;
  index: number;
  title: string;
  stageBadge: string;
  hudSkin: HudFidelitySkin;
  floats: FourFloats;
  tStart: number;
  tEnd: number; // Infinity for ch7-outro-loop
  shots: CreditsShotSpec[];
}

export interface LyricCue {
  tStart: number;
  tEnd: number;
  line: string;
  nextLine?: string;
  section: 'intro' | 'verse1' | 'verse2' | 'prechorus1' | 'chorus1' | 'verse3' | 'prechorus2' | 'bridge' | 'chorus2' | 'outro';
}

export const CREDITS_CHAPTERS: CreditsChapterSpec[] = [
  {
    id: 'ch1-cold-boot',
    index: 1,
    title: 'Cold Boot & Wireframe Moon',
    stageBadge: 'STAGE 0a // VECTOR WIREFRAME',
    hudSkin: '0a',
    floats: { Pxd: 0.02, Vtx: 0.02, Lx: 0.05, Aq: 0.00 },
    tStart: 0.0,
    tEnd: 18.33,
    shots: [
      {
        id: 'SHOT-1A',
        tStart: 0.0,
        tEnd: 6.67,
        cameraPreset: 'lab-wake-breaker',
        description: 'Dark Lab wake under 1.2Hz red strobe; red button ("you pulled it right in front of me"); armoured glove throws Power Wall breaker.',
      },
      {
        id: 'SHOT-1B',
        tStart: 6.67,
        tEnd: 13.33,
        cameraPreset: 'gate-threshold-wireframe',
        description: 'Gate ribbed amber coils ignite bottom-to-top; step onto Stage 0a Hidden-Line Vector Wireframe Moon under real starry lunar sky.',
      },
      {
        id: 'SHOT-1C',
        tStart: 13.33,
        tEnd: 18.33,
        cameraPreset: 'pad-first-drill',
        description: 'Astro in armoured suit places first Rock Drill and Texture Mill on wireframe stone with #7cff4d bottom-up print sweep.',
      },
    ],
  },
  {
    id: 'ch2-one-bit-facets',
    index: 2,
    title: '1-Bit Facets & The 12 kW Brownout',
    stageBadge: 'STAGE 0b -> 1 // 1-BIT & EGA FACETS',
    hudSkin: '0b',
    floats: { Pxd: 0.24, Vtx: 0.22, Lx: 0.18, Aq: 0.00 },
    tStart: 18.33,
    tEnd: 36.67,
    shots: [
      {
        id: 'SHOT-2A',
        tStart: 18.33,
        tEnd: 25.00,
        cameraPreset: 'crater-facet-wave',
        description: 'Radial scan-wave fills wireframe triangles into Stage 0b 1-Bit Flat-Shaded Facets; Astro fires real-size (1.0x) Extraction Beam Rifle.',
      },
      {
        id: 'SHOT-2B',
        tStart: 25.00,
        tEnd: 31.67,
        cameraPreset: 'gate-brownout-power-unit',
        description: '4th machine trips 12 kW Gate breaker into amber brownout; Astro bolts down Power Unit (+kW) as Stage 1 EGA mineral facets lock in.',
      },
      {
        id: 'SHOT-2C',
        tStart: 31.67,
        tEnd: 36.67,
        cameraPreset: 'lab-studio-schema',
        description: 'Whip-pan to Lab Studio terminal (A4-03) patching "dirt" in schema; HUD skin glitches from 0b to 1 (EGA double-border).',
      },
    ],
  },
  {
    id: 'ch3-chorus-bloom',
    index: 3,
    title: 'Chorus 1: Four Floats in the Dark',
    stageBadge: 'STAGE 2 // 256-COLOR VGA & SHADOWS',
    hudSkin: '2',
    floats: { Pxd: 0.52, Vtx: 0.48, Lx: 0.42, Aq: 0.10 },
    tStart: 36.67,
    tEnd: 55.00,
    shots: [
      {
        id: 'SHOT-3A',
        tStart: 36.67,
        tEnd: 46.67,
        cameraPreset: 'outpost-four-plumes-crane',
        description: 'Crane shot behind Sheet 13 gunmetal box-section foundations; Texture Mill (#ff3d8a), Shape Press (#7cff4d), Light Projector (#ffc13d), and Water Maker (#3dc8ff) fire on beat.',
      },
      {
        id: 'SHOT-3B',
        tStart: 46.67,
        tEnd: 55.00,
        cameraPreset: 'vga-shadows-grass-bloom',
        description: 'Stage 2 VGA 1024^2 directional shadows sweep across boulders as emerald grass blooms under the Moon twilight sky.',
      },
    ],
  },
  {
    id: 'ch4-archive-rifts',
    index: 4,
    title: 'Archive Rifts, Vance Ridge & Rover Jump',
    stageBadge: 'STAGE 3 // 16-BIT GOURAUD & RAYLEIGH SKY',
    hudSkin: '3',
    floats: { Pxd: 0.70, Vtx: 0.68, Lx: 0.68, Aq: 0.32 },
    tStart: 55.00,
    tEnd: 73.33,
    shots: [
      {
        id: 'SHOT-4A',
        tStart: 55.00,
        tEnd: 61.67,
        cameraPreset: 'rim-rift-sprites-md1',
        description: 'Under Moon Rayleigh blue sky, vertical glitch Rift Column spawns 2D Freedoom sprite then 3D LibreQuake .md1 brute; 2 kW Perimeter Turret & Seal beam engage.',
      },
      {
        id: 'SHOT-4B',
        tStart: 61.67,
        tEnd: 68.33,
        cameraPreset: 'vance-ridge-rover-jump',
        description: 'Modular Scout Rover (empty tinted cab, square [-u-] yoke, raycast aerial) crests Vance Wreck Ridge in 1.62 m/s^2 lunar gravity against real lunar sky.',
      },
      {
        id: 'SHOT-4C',
        tStart: 68.33,
        tEnd: 73.33,
        cameraPreset: 'combiner-violet-splice',
        description: 'Lab Preset Combiner (#b46bff violet globe) fuses Anomaly Core + cartridges into Golden Master .smx.',
      },
    ],
  },
  {
    id: 'ch5-window-heal',
    index: 5,
    title: 'Hydro Lakes & The Earth Window Breach Heals',
    stageBadge: 'STAGE 4 -> 5 // HYDRO LAKES & COVERAGE',
    hudSkin: '4-6',
    floats: { Pxd: 0.82, Vtx: 0.80, Lx: 0.80, Aq: 0.65 },
    tStart: 73.33,
    tEnd: 93.33,
    shots: [
      {
        id: 'SHOT-5A',
        tStart: 73.33,
        tEnd: 81.67,
        cameraPreset: 'hydro-basin-flood',
        description: 'Sheet 17 Heavy Terraformers on 8m hardpoints flood the eastern lunar basin with turquoise water (@hm/hydro) as moss and clover creep up the banks.',
      },
      {
        id: 'SHOT-5B',
        tStart: 81.67,
        tEnd: 93.33,
        cameraPreset: 'lab-window-breach-heal',
        description: 'Astro pulls Operator Console Master Sync Lever; outside the 14.8m x 3.1m window, the 120m cyan Breach Column zips shut and golden-hour trees bloom across Earth.',
      },
    ],
  },
  {
    id: 'ch6-suitcam-finale',
    index: 6,
    title: 'Suit-Cam PBR Biosphere & The 11 Domes',
    stageBadge: 'STAGE 6 // SUIT-CAM CMOS PBR (1.00)',
    hudSkin: '4-6',
    floats: { Pxd: 1.00, Vtx: 1.00, Lx: 1.00, Aq: 1.00 },
    tStart: 93.33,
    tEnd: 116.67,
    shots: [
      {
        id: 'SHOT-6A',
        tStart: 93.33,
        tEnd: 105.00,
        cameraPreset: 'suitcam-fpv-forest-walkout',
        description: 'First-person Suit-Cam walkout through Twin Gate: lagging auto-exposure iris blows out sky (+0.85 EV) then reveals L-system conifer forest, fauna, and Heavy Crawler.',
      },
      {
        id: 'SHOT-6B',
        tStart: 105.00,
        tEnd: 116.67,
        cameraPreset: 'horizon-11-domes-crane',
        description: 'High crane shot over shimmering lake and forest canopy toward 11 neighboring enclave domes on the 4.2 km lunar horizon as vocal ends on "Sector Four".',
      },
    ],
  },
  {
    id: 'ch7-outro-loop',
    index: 7,
    title: 'Instrumental Chorus Loop: Dual-World Diptych',
    stageBadge: 'SECTOR 04 // KERNEL COMPILED (1.00, 1.00, 1.00, 1.00)',
    hudSkin: '4-6',
    floats: { Pxd: 1.00, Vtx: 1.00, Lx: 1.00, Aq: 1.00 },
    tStart: 116.67,
    tEnd: Number.POSITIVE_INFINITY,
    shots: [
      {
        id: 'SHOT-7A',
        tStart: 116.67,
        tEnd: Number.POSITIVE_INFINITY,
        cameraPreset: 'lab-healed-diptych-hold',
        description: 'Loops seamlessly on outro.json 144 BPM bar grid: healed golden-hour Earth window on left, lush Stage 6 Lunar forest through open Gate on right, rotating Planet Table in foreground.',
      },
    ],
  },
];

/**
 * Synced Lyric Cues for "Four Floats" v4b (1.2x @ 144 BPM, including owner-selected line "you pulled it right in front of me")
 */
export const CREDITS_LYRIC_CUES: LyricCue[] = [
  { tStart: 0.00,   tEnd: 6.67,   section: 'intro',      line: '[144 BPM CHIPTUNE & DRUM MACHINE INTRO]', nextLine: 'Woke up on the floor' },
  { tStart: 6.67,   tEnd: 10.00,  section: 'verse1',     line: 'Woke up on the floor — red light on the wall', nextLine: 'Told you not that switch, you pulled it right in front of me' },
  { tStart: 10.00,  tEnd: 13.33,  section: 'verse1',     line: 'Told you not that switch — you pulled it right in front of me', nextLine: 'Coils hummed in the dark, stepped out through the door' },
  { tStart: 13.33,  tEnd: 18.33,  section: 'verse1',     line: 'Coils hummed in the dark — stepped out on wireframe stone', nextLine: 'Lines across the dust, naked vectors in the cold' },
  { tStart: 18.33,  tEnd: 25.00,  section: 'verse2',     line: 'Fed the Texture Mill — fifty dirt from the crater floor', nextLine: 'Haddy on the comms: "It\'s not really dirt, you know"' },
  { tStart: 25.00,  tEnd: 31.67,  section: 'verse2',     line: 'Blew the twelve-kilowatt line — plumes dropped to a crawl', nextLine: 'Bolted down a Power Unit, watched the EGA facets lock' },
  { tStart: 31.67,  tEnd: 36.67,  section: 'prechorus1', line: 'Opened up the Studio — patched the schema key', nextLine: 'One-bit into sixteen colors, watch the palette breathe' },
  { tStart: 36.67,  tEnd: 46.67,  section: 'chorus1',    line: 'Four floats in the dark — Pixels, Vertices, Light, and Water!', nextLine: 'Pink and green and amber plumes rising from the pad' },
  { tStart: 46.67,  tEnd: 55.00,  section: 'chorus1',    line: 'Compiling up the moon — shadows falling on the grass', nextLine: 'Proving the old kernel wrong, one cartridge at a time' },
  { tStart: 55.00,  tEnd: 61.67,  section: 'verse3',     line: 'Rifts along the rim — where the nineties leaked right through', nextLine: 'Flat sprites with no back, then the Quake brutes learned to jump' },
  { tStart: 61.67,  tEnd: 68.33,  section: 'verse3',     line: 'Vance\'s transponder on the ridge — Scout Rover in the air', nextLine: 'Square yoke in an empty cab, drifting under Rayleigh blue' },
  { tStart: 68.33,  tEnd: 73.33,  section: 'prechorus2', line: 'Violet plasma in the Lab — splicing up the Golden Master', nextLine: 'Heavy Terraformershum on the eight-metre pads' },
  { tStart: 73.33,  tEnd: 81.67,  section: 'bridge',     line: 'Water floods the eastern basin — clover creeping up the stone', nextLine: 'Pull the Master Sync lever, look out through the glass' },
  { tStart: 81.67,  tEnd: 93.33,  section: 'bridge',     line: 'The Breach column zips shut — golden sun on Earth again', nextLine: 'Wait... if we just patched the host, who\'s running our server?' },
  { tStart: 93.33,  tEnd: 105.00, section: 'chorus2',    line: 'Four floats in the dark — full biosphere in the visor glass!', nextLine: 'Iris clips the morning sun, conifers along the lake' },
  { tStart: 105.00, tEnd: 116.67, section: 'outro',      line: 'Eleven domes on the horizon — best one-kilometre moon', nextLine: 'Compiled and online... welcome home to Sector Four.' },
];

export interface CreditsSectionBlock {
  heading: string;
  entries: Array<{ role?: string; name: string; detail?: string }>;
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
        { role: 'TYPOGRAPHY (SIL OPEN FONT LICENSE 1.1)', name: 'Oxanium (Severin Meyer), Inter (Rasmus Andersson), Share Tech Mono (Carrois Apostrophe)', detail: 'SIL OFL-1.1' },
      ],
    },
  ];
}

export interface CreditsPlaybackState {
  elapsedSec: number;
  barNumber: number;
  beatInBar: number;
  beatPulse: number; // 1.0 on beat downstroke -> decays to 0.0
  chapter: CreditsChapterSpec;
  activeShot: CreditsShotSpec;
  activeLyric: LyricCue | null;
  isLoopingOutro: boolean;
  loopedAudioTime: number;
}

/**
 * Pure deterministic lookup of the entire credits director state at any timestamp t >= 0.
 */
export function getCreditsStateAt(
  elapsedSec: number,
  outro: MusicOutroMeta = DEFAULT_OUTRO_META
): CreditsPlaybackState {
  const safeT = Math.max(0, elapsedSec);
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
    CREDITS_CHAPTERS[CREDITS_CHAPTERS.length - 1];

  const activeShot =
    chapter.shots.find((s) => safeT >= s.tStart && safeT < s.tEnd) ??
    chapter.shots[chapter.shots.length - 1];

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
