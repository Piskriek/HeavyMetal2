/**
 * TICKET-05 ambient motion contract.
 *
 * Pure constants and helpers shared by `AnimatedMenuBackground.tsx` and the
 * accompanying tests. This module is DOM-free so it can be imported by node:test
 * without pulling in React, framer-motion or CSS.
 */

/** Visual presets the menus can render. Each one owns its own backdrop URL,
 *  parallax tilt, ember count, flicker style and ambient overlay tint. */
export type MenuBackdropPreset = 'main' | 'arena' | 'workshop' | 'settings' | 'vault';

/** Backdrop images are 1920×1080 painted webp/jpg/png files under `public/art/`. */
export interface MenuBackdrop {
  readonly preset: MenuBackdropPreset;
  /** URL served by Vite from `public/`. */
  readonly url: string;
  /** Default focal point for `background-position`. */
  readonly position: string;
  /** Optional parallax tilt range in pixels (0 = static). */
  readonly parallax: number;
  /** Recommended ember count when ambient particles are enabled. */
  readonly embers: number;
  /** Whether the flicker filter animation should run. */
  readonly flicker: boolean;
  /** Ambient overlay tint identifier — controls which gradient to use. */
  readonly overlay: 'menu' | 'dialog' | 'round-result';
}

/** The single source of truth for menu backdrop files. Tests import this map
 *  directly so any drift is caught by `tests/ticket05-backdrop.test.ts`. */
export const MENU_BACKDROPS: Readonly<Record<MenuBackdropPreset, MenuBackdrop>> = Object.freeze({
  main: {
    preset: 'main',
    url: '/art/ui/menu-heavy-metal-2.jpg',
    position: '53% center',
    parallax: 8,
    embers: 22,
    flicker: true,
    overlay: 'menu',
  },
  arena: {
    preset: 'arena',
    url: '/art/menus/menu_arena.webp',
    position: '50% center',
    parallax: 7,
    embers: 16,
    flicker: true,
    overlay: 'dialog',
  },
  workshop: {
    preset: 'workshop',
    url: '/art/menus/menu_workshop.webp',
    position: '50% center',
    parallax: 6,
    embers: 24,
    flicker: true,
    overlay: 'dialog',
  },
  settings: {
    preset: 'settings',
    url: '/art/menus/menu_settings.webp',
    position: '50% center',
    parallax: 4,
    embers: 15,
    flicker: true,
    overlay: 'dialog',
  },
  vault: {
    preset: 'vault',
    url: '/art/menus/menu_vault.webp',
    position: '50% center',
    parallax: 5,
    embers: 18,
    flicker: true,
    overlay: 'round-result',
  },
});

/** Default ember count used when the ambient engine cannot infer a preset. */
export const AMBIENT_EMBER_DEFAULT = 18;
/** Lower bound for the ember count clamp (ticket spec: 15–25). */
export const AMBIENT_EMBER_MIN = 14;
/** Upper bound for the ember count clamp. */
export const AMBIENT_EMBER_MAX = 26;
/** Default mouse-driven parallax tilt in pixels. */
export const AMBIENT_PARALLAX_PX = 8;
/** Default ember rise time in seconds. */
export const AMBIENT_EMBER_DURATION_S = 13;

/** Resolve a preset id to its backdrop entry, with a guaranteed fallback. */
export function resolveBackdrop(preset: MenuBackdropPreset | string | null | undefined): MenuBackdrop {
  if (preset && preset in MENU_BACKDROPS) return MENU_BACKDROPS[preset as MenuBackdropPreset];
  return MENU_BACKDROPS.main;
}

/** Clamp an ember count into the ambient engine's safe operating range. */
export function clampEmberCount(requested: number): number {
  // `NaN` is the only input that has no safe number to clamp to.
  if (Number.isNaN(requested)) return AMBIENT_EMBER_DEFAULT;
  return Math.min(AMBIENT_EMBER_MAX, Math.max(AMBIENT_EMBER_MIN, Math.round(requested)));
}

/** Pick the ember count for a given preset, clamped into the safe range. */
export function emberCountFor(preset: MenuBackdropPreset | string | null | undefined): number {
  return clampEmberCount(resolveBackdrop(preset).embers);
}
