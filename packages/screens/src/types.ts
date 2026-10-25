export interface RacerCard { id: string; name: string; color: string; accent: string; weight: number; speed: number; bounce: number; blurb?: string }
export interface StandingRow { id: string; name: string; color: string; points: number; wins: number; best: number }
export interface ResultRow { id: string; name: string; color: string; position: number; timeMs?: number; dnf?: boolean; isPlayer?: boolean; pointsGained?: number }

export interface Settings {
  master: number; sfx: number; music: number;
  /** auto picks from the device and drops a tier when frames run slow. */
  quality: 'auto' | 'potato' | 'low' | 'medium' | 'high' | 'ultra';
  touchControls: 'auto' | 'on' | 'off';
  reducedMotion: boolean;
  invertSteer: boolean;
  showMinimap: boolean;
  /** The monsters on the planet: Off (no leaks open), Calm (they fight back when hit), Normal, Hard. */
  monsters: 'off' | 'calm' | 'normal' | 'hard';
  /** Camera shake trauma multiplier 0..1 (DEC-09: default 0.35 Subtle). */
  cameraShake?: number;
}

export const DEFAULT_SETTINGS: Settings = { master: 0.8, sfx: 0.9, music: 0.5, quality: 'auto', touchControls: 'auto', reducedMotion: false, invertSteer: false, showMinimap: true, monsters: 'normal', cameraShake: 0.35 };

/** Points a custom goblin may spend across weight, speed and bounce (each 1..10). */
export const STAT_BUDGET = 15;
