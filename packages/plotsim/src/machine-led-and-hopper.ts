// ============================================================================
// File: packages/plotsim/src/machine-led-and-hopper.ts
// TICKET-23 (POL-281, POL-282, POL-39, POL-33, POL-73, POL-76, POL-77):
// Pure deterministic helpers for:
// 1. POL-281 (ARGO_NOTE_17 Ruling #1): Lateral exhaust stack offset for
//    `press` and `heavy-press` so rising green Vtx plumes clear the top input
//    hopper chute by > 1.0 m (1.096 m horizontal clearance).
// 2. POL-282 (ARGO_NOTE_17 Ruling #2): Per-kind vertical plume gravity (m/s^2)
//    giving ballistic downward arcs on drills/pylons, gentle settling on presses,
//    and buoyant upward acceleration on mills, watermakers, projectors, and power units.
// 3. POL-39 & POL-73: Square housing status LED evaluator supporting switched-off
//    (`on === false`), unpowered, starved/brownout blinking amber, and running green.
// 4. POL-77: Hopper capacity calculator separating the machine's local 100-item
//    hopper buffer from linked network storage (`+N linked`) so the inspector bar
//    never prints `4835 / 100`.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

export type PlumeMachineKind =
  | 'drill'
  | 'mill'
  | 'pylon'
  | 'press'
  | 'power'
  | 'projector'
  | 'water'
  | 'heavy-mill'
  | 'heavy-press'
  | 'heavy-projector'
  | 'heavy-water'
  | 'fabricator';

export type HousingLedStatus = 'running' | 'warn' | 'unpowered' | 'off';

export const HOUSING_LED_HEX: Readonly<Record<HousingLedStatus, string>> = {
  running: '#22c55e',   // Green: actively running at full grid satisfaction
  warn: '#f59e0b',      // Amber blink: starved of input ore/feed or under brownout
  unpowered: '#ef4444', // Red solid: disconnected from relay grid
  off: '#ef4444',       // Red dim: manually switched off via POL-73 switch command
};

/**
 * POL-282 (ARGO_NOTE_17 Ruling #2): Canonical vertical gravity (m/s^2) per machine kind.
 * Negative values pull ballistic sparks/facets downward; positive values give buoyant
 * thermal/photon lift as the plume rises.
 */
export const MACHINE_PLUME_GRAVITY: Readonly<Record<PlumeMachineKind, number>> = {
  drill: -3.6,
  pylon: -4.8,
  press: -0.65,
  'heavy-press': -0.75,
  mill: 0.45,
  'heavy-mill': 0.55,
  water: 0.35,
  'heavy-water': 0.45,
  projector: 0.60,
  'heavy-projector': 0.75,
  power: 0.40,
  fabricator: 0.30,
};

export function machinePlumeGravity(kind: PlumeMachineKind): number {
  return MACHINE_PLUME_GRAVITY[kind] ?? 0;
}

/**
 * POL-281 (ARGO_NOTE_17 ruling a, "keep this socket"): the exhaust vent `[x, y, z]` in the
 * unscaled prop frame for `press` and `heavy-press` is the measured stack behind the chute
 * (no side stack, no mesh change), plus the top input hopper chute `[0, y, 0.30]`. The vent
 * sits 0.86 m behind the chute, about 0.77 m after the fit: clear of the falling ore.
 * (machine-props.ts GEN_VENT holds the same socket for the scene.)
 */
export const PRESS_CHUTE_LOCAL: Readonly<Record<'press' | 'heavy-press', readonly [number, number, number]>> = {
  press: [0, 2.85, 0.30],
  'heavy-press': [0, 3.35, 0.30],
};

export const PRESS_SIDE_VENT_LOCAL: Readonly<Record<'press' | 'heavy-press', readonly [number, number, number]>> = {
  press: [0, 3.44, -0.56],
  'heavy-press': [0, 3.2, -0.56],
};

/**
 * Computes the horizontal XZ clearance (metres) between the press's side exhaust vent
 * and its top input hopper chute after applying uniform table-height scale `scale`.
 */
export function computePressVentChuteClearanceM(
  kind: 'press' | 'heavy-press',
  scale = 1,
): number {
  const vent = PRESS_SIDE_VENT_LOCAL[kind];
  const chute = PRESS_CHUTE_LOCAL[kind];
  const dx = (vent[0] - chute[0]) * scale;
  const dz = (vent[2] - chute[2]) * scale;
  return Math.hypot(dx, dz);
}

/**
 * POL-39 & POL-73: Pure evaluator for a machine housing's square emissive status LED.
 */
export function evaluateHousingStatusLed(params: {
  readonly running: number;
  readonly connected: boolean;
  readonly switchedOn?: boolean;
  readonly satisfaction?: number;
  readonly timeSec?: number;
}): {
  readonly status: HousingLedStatus;
  readonly colour: string;
  readonly intensity: number;
} {
  const switchedOn = params.switchedOn ?? true;
  if (!switchedOn) {
    return { status: 'off', colour: HOUSING_LED_HEX.off, intensity: 0.45 };
  }
  if (!params.connected) {
    return { status: 'unpowered', colour: HOUSING_LED_HEX.unpowered, intensity: 0.85 };
  }
  const sat = params.satisfaction ?? 1;
  if (params.running <= 0.05 || sat < 0.99) {
    const t = params.timeSec ?? 0;
    const blinkOn = Math.sin(t * Math.PI * 4) >= -0.1;
    return {
      status: 'warn',
      colour: HOUSING_LED_HEX.warn,
      intensity: blinkOn ? 0.92 : 0.18,
    };
  }
  return { status: 'running', colour: HOUSING_LED_HEX.running, intensity: 0.95 };
}

export interface InspectorHopperBreakdown {
  readonly item: string;
  /** Amount shown inside the machine's local hopper buffer (`0..cap`, never exceeding `cap`). */
  readonly n: number;
  /** The machine's local hopper capacity (default `100` for one stack). */
  readonly cap: number;
  /** Additional stock available across linked storage bins on the bridge network. */
  readonly linkedReserve: number;
  /** Total stock across local hopper + linked network. */
  readonly totalAvailable: number;
  /** Normalized progress bar fill `0..1` (`n / cap`, never > 1). */
  readonly fill01: number;
  /** Formatted readout string, e.g. `"Regolith Ore: 100 / 100 (+4,735 linked)"`. */
  readonly formatted: string;
}

/**
 * POL-77: Formats and caps a station's feed hopper readout so network stock (`4835`)
 * never overflows the local hopper bar (`100`), displaying `"100 / 100 (+4735 linked)"`.
 */
export function computeInspectorHopperView(
  itemName: string,
  totalNetworkAndPackCount: number,
  localHopperCap = 100,
): InspectorHopperBreakdown {
  const cap = Math.max(1, Math.floor(localHopperCap));
  const total = Math.max(0, Math.floor(Number.isFinite(totalNetworkAndPackCount) ? totalNetworkAndPackCount : 0));
  const n = Math.min(cap, total);
  const linkedReserve = Math.max(0, total - n);
  const fill01 = Math.max(0, Math.min(1, n / cap));
  const formatted =
    linkedReserve > 0
      ? `${itemName}: ${n} / ${cap} (+${linkedReserve} linked)`
      : `${itemName}: ${n} / ${cap}`;
  return {
    item: itemName,
    n,
    cap,
    linkedReserve,
    totalAvailable: total,
    fill01,
    formatted,
  };
}
