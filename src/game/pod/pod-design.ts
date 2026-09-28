/**
 * Ball Garage designs on the Hoop-Pod (docs/HOOP_POD.md §Garage).
 *
 * The garage (src/components/garage/BallCustomizer.tsx) edits a `CustomBallConfig` and bakes it with
 * `bakeBall` into an equirect texture. The pod samples that same bake on its hoop crowns
 * (`bakeUvForPoint`), so every garage tool — metals, pin-line, decals, size/turn/strength, tint,
 * undo/redo, saving — keeps working untouched. This module decides which saved design the player
 * races and derives the livery the unbaked parts (walls, inner ball, hubcaps) wear.
 *
 * Which design races: the one equipped under `EQUIPPED_BALL_KEY` (a bakeKey), otherwise the most
 * recently saved design (`saveDesign` puts the newest first), otherwise none (loadout livery).
 */
import type { CustomBallConfig, HexColor } from '../meta/interfaces';
import { decalSources, listDesigns } from '../meta/ball-design';
import { BASE_MATERIALS, bakeBall, type RgbaImage } from '../meta/sphere-decal-baker';
import type { PodLivery } from './pod-livery';

export const EQUIPPED_BALL_KEY = 'hm2-equipped-ball-v1';
/** Fired on `window` after a design is equipped/saved, so a live fleet repaints the player. */
export const POD_DESIGN_EVENT = 'hm2:ball-design';
const announce = () => {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(POD_DESIGN_EVENT)); } catch { /* headless */ }
};

/** Cap finishes, matching CAP_FINISHES in BallShowroom.tsx (kept here so game code never imports UI). */
export const CAP_FINISH_HEX: Readonly<Record<CustomBallConfig['capFinish'], string>> = {
  brass: '#c08a2e', gunmetal: '#5a6068', copper: '#b8643a', chrome: '#e4e9ee',
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): StorageLike | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** The design the player races, or null for the loadout livery. Never throws. */
export function resolvePlayerDesign(storage: StorageLike | null = store()): CustomBallConfig | null {
  try {
    const designs = listDesigns(storage ?? undefined);
    if (!designs.length) return null;
    const equipped = storage?.getItem(EQUIPPED_BALL_KEY) ?? null;
    const pick = (equipped && designs.find((d) => d.config?.bakeKey === equipped)) || designs[0];
    const config = pick?.config;
    return config && typeof config.bakeKey === 'string' && config.base in BASE_MATERIALS ? config : null;
  } catch {
    return null;
  }
}

/** Equip a saved design by bakeKey (null = race the newest saved design). */
export function equipDesign(bakeKey: string | null, storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  try {
    if (bakeKey === null) storage.removeItem(EQUIPPED_BALL_KEY);
    else storage.setItem(EQUIPPED_BALL_KEY, bakeKey);
    announce();
    return true;
  } catch {
    return false;
  }
}

export interface PodBake {
  readonly albedo: RgbaImage;
  readonly emissive: RgbaImage | null;
  readonly key: string;
}

/** Bakes a design at `width` (512 = race field, 1024 = garage). Uses the painted decal art if loaded. */
export function bakeDesign(config: CustomBallConfig, width = 512): PodBake {
  const result = bakeBall(config, decalSources(), width);
  return { albedo: result.albedo, emissive: result.emissive, key: `${config.bakeKey}@${width}` };
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;

/** Average colour of the paintable band (|lat| ≤ ~50°) — what the walls and inner faces echo. */
function averageBand(img: RgbaImage): string {
  let r = 0, g = 0, b = 0, n = 0;
  const y0 = Math.floor(img.height * 0.22), y1 = Math.ceil(img.height * 0.78);
  for (let y = y0; y < y1; y += 4) {
    for (let x = 0; x < img.width; x += 8) {
      const i = (y * img.width + x) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
  }
  return n ? hex((r / n) * 0.85, (g / n) * 0.85, (b / n) * 0.85) : '#5a5058';
}

/** Livery for the parts a bake does not cover. `accent` is the pin-line colour (inner ball / accent walls). */
export function liveryFromBake(bake: RgbaImage, accent: string, capFinish: CustomBallConfig['capFinish']): PodLivery {
  const trim = CAP_FINISH_HEX[capFinish] ?? CAP_FINISH_HEX.brass;
  return {
    primary: averageBand(bake),
    secondary: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : '#e58a2b',
    trim,
    glass: '#ffb238',
    decalColor: '#efe3c4',
    hubDecal: 0,
    bandPattern: 0,
    wear: 0, // wear is painted into the bake by the chosen metal
  };
}

export const liveryForDesign = (config: CustomBallConfig, bake: RgbaImage): PodLivery =>
  liveryFromBake(bake, config.accentColor as HexColor, config.capFinish);

/** Pin-line colour read back from a bake (row at v = 0.5), for showrooms that only have the bake. */
export function accentFromBake(bake: RgbaImage): string {
  const y = Math.floor(bake.height / 2);
  const i = (y * bake.width + Math.floor(bake.width / 3)) * 4;
  return hex(bake.data[i], bake.data[i + 1], bake.data[i + 2]);
}
