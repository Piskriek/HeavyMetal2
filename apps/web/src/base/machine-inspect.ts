// ============================================================================
// File: apps/web/src/base/machine-inspect.ts
// TICKET-03 (OPUS_NOTE_09 Items A & C):
// - inspectMachine(world, env, id): MachineInspect
// - machineSize(kind): { h, w, d } in metres (2.5m to 6.0m, heavies largest)
// - machinePlumeColour(kind): string (vivid hex colour for all 11 MachineKinds)
// ============================================================================

import * as L from '@hm/lattice';
import {
  KINDS,
  MIN_RICHNESS,
  network as solvePlotNetwork,
  running as solvePlotRunning,
  type Env as PlotEnv,
  type MachineKind,
  type Metric,
  type PlotState,
} from '@hm/plotsim';
import { BIN_SLOTS, machineAt, networkAt, relays, type BaseWorld, type WorldEnv } from './world';
import { ITEMS, RECIPES, type StationKind } from './catalog';

export type InspectStatus = 'running' | 'idle' | 'no-power' | 'no-feed' | 'off';
/**
 * refine / fabricate open the machine's window; toggle switches a plot machine (the plot's own switch);
 * controls opens the plot machine's panel (cartridge slot, take it down). A base hardpoint machine has no
 * switch yet (no world command), so it offers no toggle.
 */
export type InspectAction = 'refine' | 'fabricate' | 'toggle' | 'controls';

export interface HopperView {
  readonly item: string;
  readonly n: number;
  readonly cap: number;
}

export interface MachineInspect {
  readonly kind: MachineKind | StationKind;
  readonly name: string;
  readonly status: InspectStatus;
  readonly runPct: number;
  readonly kwDraw: number;
  readonly kwSupplied: number;
  readonly hopper: HopperView | null;
  readonly cartridge: string | null;
  readonly emits: Metric | null;
  readonly plumeOn: boolean;
  readonly actions: InspectAction[];
}

/**
 * BaseEnv extends WorldEnv from apps/web/src/base/world.ts with optional live
 * telemetry overrides (power shares, on/off switches, slotted cartridges, or PlotState)
 * so inspectMachine works with a plain WorldEnv OR full play-scene state.
 */
export interface BaseEnv extends WorldEnv {
  readonly power?: Readonly<Record<number, number>>;
  readonly on?: Readonly<Record<number, boolean>>;
  readonly cartridges?: Readonly<Record<number, string | null>>;
  readonly plot?: PlotState;
  readonly plotEnv?: PlotEnv;
  readonly kwSupplied?: number;
}

export interface MachineDimensions {
  readonly h: number;
  readonly w: number;
  readonly d: number;
}

/**
 * Real-world machine dimensions in metres (2.8 m to 6.0 m tall; heavies largest).
 */
export const MACHINE_SIZES: Readonly<Record<MachineKind, MachineDimensions>> = {
  drill: { h: 3.2, w: 2.2, d: 2.2 },
  mill: { h: 2.8, w: 2.6, d: 2.2 },
  pylon: { h: 3.8, w: 1.2, d: 1.2 },
  press: { h: 3.1, w: 2.6, d: 2.4 },
  power: { h: 2.9, w: 2.5, d: 2.3 },
  projector: { h: 3.6, w: 2.0, d: 2.0 },
  water: { h: 2.8, w: 3.2, d: 2.6 },
  'heavy-mill': { h: 4.8, w: 5.4, d: 5.0 },
  'heavy-press': { h: 5.2, w: 5.6, d: 5.2 },
  'heavy-projector': { h: 6.0, w: 5.0, d: 5.0 },
  'heavy-water': { h: 4.9, w: 6.0, d: 5.4 },
};

/**
 * Creative Lead canonical pixel-plume colours per MachineKind:
 * - Metric emitters use the 4 canonical float colours (#ff3d8a, #7cff4d, #ffc13d, #3dc8ff).
 * - Non-metric machines emit distinct vivid industrial pixel plumes while operating.
 */
export const MACHINE_PLUME_COLOURS: Readonly<Record<MachineKind, string>> = {
  drill: '#ff7b3d',
  mill: '#ff3d8a',
  pylon: '#5ce1e6',
  press: '#7cff4d',
  power: '#b46bff',
  projector: '#ffc13d',
  water: '#3dc8ff',
  'heavy-mill': '#ff3d8a',
  'heavy-press': '#7cff4d',
  'heavy-projector': '#ffc13d',
  'heavy-water': '#3dc8ff',
};

export function machineSize(kind: MachineKind): { h: number; w: number; d: number } {
  const s = MACHINE_SIZES[kind] ?? MACHINE_SIZES.mill;
  return { h: s.h, w: s.w, d: s.d };
}

export function machinePlumeColour(kind: MachineKind): string {
  return MACHINE_PLUME_COLOURS[kind] ?? '#ff3d8a';
}

const STATION_TO_HEAVY: Readonly<Record<StationKind, MachineKind | 'fabricator'>> = {
  mill: 'heavy-mill',
  press: 'heavy-press',
  projector: 'heavy-projector',
  water: 'heavy-water',
  fabricator: 'fabricator',
};

const STATION_NAMES: Readonly<Record<StationKind, string>> = {
  mill: 'Heavy texture mill',
  press: 'Heavy shape press',
  projector: 'Heavy light projector',
  water: 'Heavy water maker',
  fabricator: 'Vehicle fabricator',
};

const STATION_KW_DRAW: Readonly<Record<StationKind, number>> = {
  mill: KINDS['heavy-mill'].draw,
  press: KINDS['heavy-press'].draw,
  projector: KINDS['heavy-projector'].draw,
  water: KINDS['heavy-water'].draw,
  fabricator: 12,
};

function isRelayReached(world: BaseWorld, env: WorldEnv, stationId: number): boolean {
  const at = machineAt(world, stationId);
  if (!at) return false;
  const allRelays = relays(world, env);
  return allRelays.some((r) => Math.hypot(r.x - at.x, r.z - at.z) <= r.range);
}

/**
 * Computes the linked storage capacity (in items) across the boxes on the station's network (POL-77),
 * so network stock never overflows a hardcoded /100 or /200 cap.
 */
function networkItemCap(world: BaseWorld, netIds: readonly number[], itemId: string, currentCount: number): number {
  const stackSize = ITEMS[itemId]?.stack ?? 100;
  const linkedBoxes = world.boxes.filter((b) => netIds.includes(b.id));
  const boxSlots = linkedBoxes.reduce((acc, b) => acc + b.slots.length, 0);
  const effectiveSlots = boxSlots > 0 ? boxSlots : BIN_SLOTS;
  return Math.max(stackSize, effectiveSlots * stackSize, currentCount);
}

function findStationFeedHopper(
  world: BaseWorld,
  env: WorldEnv,
  stationId: number,
  stationKind: StationKind
): { hopper: HopperView | null; hasFeed: boolean } {
  const m = world.machines.find((x) => x.id === stationId);
  if (m && m.out.length > 0) {
    const first = m.out[0]!;
    const totalOut = m.out.reduce((acc, s) => acc + s.n, 0);
    const outStack = ITEMS[first.item]?.stack ?? 100;
    return {
      hopper: { item: first.item, n: totalOut, cap: Math.max(BIN_SLOTS * outStack, totalOut) },
      hasFeed: true,
    };
  }

  const at = machineAt(world, stationId) ?? { x: env.bridge.x, z: env.bridge.z };
  const netIds = networkAt(world, env, at);
  const netTotals = L.totals(world.boxes, netIds);
  const countOf = (itemId: string): number =>
    L.count(world.player, itemId) + (netTotals[itemId] ?? 0);

  if (stationKind === 'projector') {
    return { hopper: null, hasFeed: true };
  }

  if (stationKind === 'water') {
    const oreCount = countOf('ore');
    return {
      hopper: { item: 'ore', n: oreCount, cap: networkItemCap(world, netIds, 'ore', oreCount) },
      hasFeed: oreCount > 0,
    };
  }

  // For mill, press, fabricator: check recipes belonging to this stationKind
  const stationRecipes = RECIPES.filter((r) => r.machine === stationKind);
  let bestItem = stationKind === 'mill' ? 'pixel-mono' : stationKind === 'press' ? 'vertex-rough' : 'ore';
  let bestCount = 0;
  let canAffordAny = false;

  for (const r of stationRecipes) {
    let recipeOk = true;
    for (const inp of r.inputs) {
      const have = countOf(inp.item);
      if (have > bestCount) {
        bestCount = have;
        bestItem = inp.item;
      }
      if (have < inp.n) {
        recipeOk = false;
      }
    }
    if (recipeOk) canAffordAny = true;
  }

  if (bestCount === 0) {
    const fallbackOre = countOf('ore');
    if (fallbackOre > 0 && stationKind === 'fabricator') {
      bestCount = fallbackOre;
      bestItem = 'ore';
    }
  }

  const itemName = ITEMS[bestItem]?.name ?? bestItem;
  return {
    hopper: { item: itemName, n: bestCount, cap: networkItemCap(world, netIds, bestItem, bestCount) },
    hasFeed: canAffordAny || bestCount > 0,
  };
}

/**
 * Inspects either a base hardpoint machine (`world.machines`) or a plot machine (`env.plot.machines`)
 * by `id`, returning its live telemetry, status, hopper, cartridge, emitted metric, plume state, and actions.
 */
export function inspectMachine(world: BaseWorld, env: BaseEnv, id: number): MachineInspect {
  // 1. Check base hardpoint machines in world.machines first
  const baseMachine = world.machines.find((m) => m.id === id);
  if (baseMachine) {
    const mappedKind = STATION_TO_HEAVY[baseMachine.kind];
    const kindSpec = mappedKind !== 'fabricator' ? KINDS[mappedKind] : null;
    const name = STATION_NAMES[baseMachine.kind];
    const kwDraw = STATION_KW_DRAW[baseMachine.kind];
    const emits: Metric | null = kindSpec ? kindSpec.emits : null;
    const cartridge = env.cartridges?.[id] ?? null;

    const actions: InspectAction[] =
      baseMachine.kind === 'mill' || baseMachine.kind === 'press'
        ? ['refine', 'toggle']
        : baseMachine.kind === 'fabricator'
          ? ['fabricate', 'toggle']
          : ['toggle'];

    const isSwitchedOn = (env.on?.[id] ?? baseMachine.on ?? true) !== false;
    const { hopper, hasFeed } = findStationFeedHopper(world, env, id, baseMachine.kind);

    if (!isSwitchedOn) {
      return {
        kind: mappedKind,
        name,
        status: 'off',
        runPct: 0,
        kwDraw,
        kwSupplied: 0,
        hopper,
        cartridge,
        emits,
        plumeOn: false,
        actions,
      };
    }

    const reached = isRelayReached(world, env, id);
    const powerShare =
      baseMachine.kind === 'fabricator'
        ? reached
          ? 1
          : 0
        : !reached
          ? 0
          : Math.max(0, Math.min(1, env.power?.[id] ?? 1));

    const kwSupplied =
      env.kwSupplied !== undefined
        ? env.kwSupplied
        : Math.round(kwDraw * powerShare * 10) / 10;

    if (!reached || powerShare <= 0 || kwSupplied <= 0) {
      return {
        kind: mappedKind,
        name,
        status: 'no-power',
        runPct: 0,
        kwDraw,
        kwSupplied: 0,
        hopper,
        cartridge,
        emits,
        plumeOn: false,
        actions,
      };
    }

    const usesRecipeQueue =
      baseMachine.kind === 'mill' ||
      baseMachine.kind === 'press' ||
      baseMachine.kind === 'fabricator';

    if (usesRecipeQueue) {
      if (baseMachine.jobs.length > 0) {
        const runPct = Math.round(powerShare * 100);
        return {
          kind: mappedKind,
          name,
          status: 'running',
          runPct,
          kwDraw,
          kwSupplied,
          hopper,
          cartridge,
          emits,
          plumeOn: runPct > 5,
          actions,
        };
      }
      // Queue is empty: if no feed materials exist in pack/network, report 'no-feed'; otherwise 'idle'
      return {
        kind: mappedKind,
        name,
        status: hasFeed ? 'idle' : 'no-feed',
        runPct: 0,
        kwDraw,
        kwSupplied,
        hopper,
        cartridge,
        emits,
        plumeOn: false,
        actions,
      };
    }

    // Continuous heavy terraformers (projector, water)
    if (!hasFeed) {
      return {
        kind: mappedKind,
        name,
        status: 'no-feed',
        runPct: 0,
        kwDraw,
        kwSupplied,
        hopper,
        cartridge,
        emits,
        plumeOn: false,
        actions,
      };
    }

    const runPct = Math.round(powerShare * 100);
    return {
      kind: mappedKind,
      name,
      status: 'running',
      runPct,
      kwDraw,
      kwSupplied,
      hopper,
      cartridge,
      emits,
      plumeOn: runPct > 5,
      actions,
    };
  }

  // 2. Check plot machines in env.plot.machines if provided
  const plot = env.plot;
  const plotMachine = plot?.machines.find((m) => m.id === id);
  if (plot && plotMachine) {
    const spec = KINDS[plotMachine.kind];
    const kwDraw = Math.max(0, spec.draw);
    const defaultPlotEnv: PlotEnv = env.plotEnv ?? {
      gate: { x: env.bridge.x, z: env.bridge.z },
      plotRadius: 500,
      richness: () => 0.8,
    };
    const net = solvePlotNetwork(plot, defaultPlotEnv);
    const runMap = solvePlotRunning(plot, defaultPlotEnv);
    const runShare = runMap.get(plotMachine.id) ?? 0;
    const isConnected = net.connected.has(plotMachine.id);
    const kwSupplied = isConnected
      ? spec.draw > 0
        ? Math.round(spec.draw * net.satisfaction * 10) / 10
        : net.supply
      : 0;

    const hopper: HopperView | null =
      spec.oreUse > 0 || spec.mine > 0
        ? { item: 'Ore', n: Math.floor(plot.ore), cap: 8000 }
        : null;

    const actions: InspectAction[] = ['toggle', 'controls'];

    if (!plotMachine.on || env.on?.[id] === false) {
      return {
        kind: plotMachine.kind,
        name: spec.name,
        status: 'off',
        runPct: 0,
        kwDraw,
        kwSupplied: 0,
        hopper,
        cartridge: plotMachine.cartridge,
        emits: spec.emits,
        plumeOn: false,
        actions,
      };
    }

    if (!isConnected || (spec.draw > 0 && net.satisfaction <= 0)) {
      return {
        kind: plotMachine.kind,
        name: spec.name,
        status: 'no-power',
        runPct: 0,
        kwDraw,
        kwSupplied: 0,
        hopper,
        cartridge: plotMachine.cartridge,
        emits: spec.emits,
        plumeOn: false,
        actions,
      };
    }

    const rich = defaultPlotEnv.richness(plotMachine.x, plotMachine.z);
    if (
      (spec.oreUse > 0 && runShare <= 0) ||
      (spec.mine > 0 && rich < MIN_RICHNESS)
    ) {
      return {
        kind: plotMachine.kind,
        name: spec.name,
        status: 'no-feed',
        runPct: 0,
        kwDraw,
        kwSupplied,
        hopper,
        cartridge: plotMachine.cartridge,
        emits: spec.emits,
        plumeOn: false,
        actions,
      };
    }

    if (plotMachine.kind === 'pylon') {
      return {
        kind: plotMachine.kind,
        name: spec.name,
        status: 'idle',
        runPct: 100,
        kwDraw: 0,
        kwSupplied: net.supply,
        hopper: null,
        cartridge: null,
        emits: null,
        plumeOn: false,
        actions,
      };
    }

    const runPct = Math.round(runShare * 100);
    return {
      kind: plotMachine.kind,
      name: spec.name,
      status: runPct > 0 ? 'running' : 'idle',
      runPct,
      kwDraw,
      kwSupplied,
      hopper,
      cartridge: plotMachine.cartridge,
      emits: spec.emits,
      plumeOn: runPct > 5,
      actions,
    };
  }

  // Fallback for unknown machine ID
  return {
    kind: 'mill',
    name: 'Unknown machine',
    status: 'off',
    runPct: 0,
    kwDraw: 0,
    kwSupplied: 0,
    hopper: null,
    cartridge: null,
    emits: null,
    plumeOn: false,
    actions: [],
  };
}
