/**
 * Where the campaign's base world starts (one game, TASK-20): from the profile's base save when there is one, else fresh.
 * Pure: the screen (play.tsx) reads the save text and passes it in. An old profile (no base save, or an unreadable one)
 * starts with the starter kit in the hotbar and the bridge store at the origin; the screen moves the store to the gate
 * when it builds the scene. The dev kit (`?kit=1`) is a test fixture: it adds stock and two blueprints.
 */
import * as L from '@hm/lattice';
import { STARTER } from './catalog';
import { BRIDGE_RANGE, BRIDGE_STORE, PLAYER_KG, createWorld, withBridgeStore, type BaseWorld, type WorldEnv } from './world';
import { loadWorld } from './save';

/** The stock the dev kit fixture starts with (the `?kit=1` route; test fixtures only). */
export const DEV_KIT_STOCK: readonly L.Stack[] = [
  { item: 'ore', n: 600 },
  { item: 'prim-cube', n: 15 },
  { item: 'prim-chassis', n: 8 },
  { item: 'prim-beam', n: 8 },
  { item: 'prim-column', n: 8 },
  // the TASK-13 house needs 14 basalt maps (one per cube and beam piece, and the draft); the seed carries 16
  { item: 'map-basalt', n: 16 },
  { item: 'pxd-mono', n: 80 },
  { item: 'vtx-rough', n: 80 },
];

export interface CampaignWorldStart {
  readonly world: BaseWorld;
  /** The save held a shelter, so the world is a played one: the starter shelter is not dropped again. */
  readonly played: boolean;
}

/** The loadout every world starts with (the save fills in what it lacks). */
function withLoadout(w: BaseWorld): BaseWorld {
  return {
    ...w,
    loadout: {
      core: w.loadout.core ?? 'core-semi',
      barrel: w.loadout.barrel ?? 'barrel-scatter',
      sight: w.loadout.sight ?? 'sight-iron',
      cell: w.loadout.cell ?? 'cell-compact',
    },
  };
}

/** Whether a world holds anything the player made or stored (a fresh world's starter kit in the hotbar does not count). */
export const hasWork = (w: BaseWorld): boolean => w.shelter || w.base.pieces.length > 0 || w.boxes.some((b) => b.slots.some((s) => s !== null));

/** The base world a profile starts with: its save, or a fresh world with the starter kit (and the dev kit when asked). */
export function startCampaignWorld(rawSave: string | null, opts: { readonly seed?: number; readonly devKit?: boolean } = {}): CampaignWorldStart {
  const seed = opts.seed ?? 1;
  if (rawSave) {
    const loaded = withLoadout(loadWorld(rawSave, seed));
    // a save that holds none of the player's work (no shelter, pieces or items: an empty or unreadable one) starts as a new profile
    if (hasWork(loaded)) return { world: loaded, played: true };
  }
  const defaultEnv: WorldEnv = { heightAt: () => 0, bridge: { x: 0, z: 0, range: BRIDGE_RANGE } };
  const fresh = withLoadout(createWorld(seed));
  const slots = fresh.player.slots.slice();
  slots[0] = { item: STARTER, n: 1 };
  if (opts.devKit) {
    slots[1] = { item: 'bp:beam:basalt', n: 1 };
    slots[2] = { item: 'bp:column:basalt', n: 1 };
  }
  const stocked = withBridgeStore(fresh, defaultEnv, opts.devKit ? DEV_KIT_STOCK : []);
  return { world: { ...stocked, player: { ...stocked.player, maxKg: PLAYER_KG, slots } }, played: false };
}

/** Whether the bridge store is in the world (the screen checks it once the gate is known). */
export const hasBridgeStore = (w: BaseWorld): boolean => w.boxes.some((b) => b.id === BRIDGE_STORE);
