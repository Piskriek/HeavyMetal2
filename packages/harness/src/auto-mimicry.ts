/**
 * Plan 57 §20 & Plan 51: Automated Multi-Channel Mechanic Mimicry Transducer (owner & Argon, 29 Oct).
 *
 * Automates mechanic mimicry across both static game-data channels on disk (zero running game or manual clicking needed)
 * and live Holo-Room bridge streams:
 * 1. Dwarf Fortress Raw Material Transducer (`transduceDfRawsToElements`):
 *    - Parses `[INORGANIC:...]` blocks (`SOLID_DENSITY`, `IMPACT_YIELD`, `SPEC_HEAT`, `MELTING_POINT`, `ITEMS_METAL`)
 *      and solves the Inverse Four-Float Derivation Card (`inverseElementFromPhysics`) to emit pure `ElementPreset`
 *      records on the `0..10000` integer scale.
 * 2. Kerbal Space Program `.cfg` Part Transducer (`transduceKspCfgToPartPreset`):
 *    - Parses KSP `PART { ... }` configs (`mass`, `crashTolerance`, `maxTemp`, `node_stack_*` sockets, `ModuleEngines*`
 *      thrust & Isp curve, `ModuleReactionWheel` torque, `RESOURCE` capacities) into socketed kit descriptors and
 *      Four-Float `(Pxd, Vtx, Lx, Aq)` stacks.
 * 3. Factorio Prototype Recipe Transducer (`transduceFactorioRecipes`):
 *    - Parses Factorio `data:extend` Lua recipe tables (`name`, `energy_required`, `ingredients`, `results`) into
 *      Port-Hamiltonian synthesis throughput specs.
 * 4. Hades Combat & Timing Lua Transducer (`transduceHadesLuaToCombatPresets`):
 *    - Extracts weapon timing, cooldown, and screen-wait cadence tables from Lua scripts into FIDELITY combat specs.
 * 5. Plasma Odin Device & Sketch-to-Wiregraph Transducer (`transducePlasmaDevice`):
 *    - Converts a parsed Plasma `SerializedDevice` (agents, command/output/property ports, component physics & socket
 *      tree) into a validated FIDELITY `@hm/wiregraph` (`WireGraphSpec`) and socketed kit summary.
 * 6. Automated Live Bridge Accumulator (`createAutoMimicLiveState`, `stepAutoMimicLiveSession`):
 *    - Continuously ingests live Holo-Room `/mirror` and `/frame` samples over rolling windows and automatically mints
 *      discovered `MimicryResult` presets once `confidence >= 0.75`.
 *
 * Rules & Ethics (Plan 51, Rule 18): Only physical numbers, structural graphs, and timing ratios cross. Never assets,
 * proprietary lore names, or code. 100% pure and deterministic (no Date.now, no Math.random, no I/O).
 */
import { validateWireGraph, type ActuatorSpec, type LogicNodeSpec, type SensorSpec, type WireGraphSpec } from '@hm/wiregraph';
import { transduceMechanic, type MechanicObservation, type MimicryResult } from './mechanic-mimicry.js';
import { deriveElementPhysics, type DerivedElementPhysics, type ElementPreset } from './science-cosmos.js';

const clampInt = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(x)));
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

function fnv1aHex8(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. Dwarf Fortress Raw Material Transducer -> Inverse Four-Float Element Preset (`0..10000`)
// ---------------------------------------------------------------------------------------------------------------------

export interface TransducedDfElement {
  readonly rawId: string;
  readonly preset: ElementPreset;
  readonly measured: {
    readonly solidDensityKgM3: number;
    readonly impactYieldKPa: number;
    readonly specHeatJkgK: number;
    readonly meltingPointUrst: number;
    readonly isMetal: boolean;
  };
  readonly derived: DerivedElementPhysics;
}

/**
 * Solves the inverse of `deriveElementPhysics`: given real physical measurements (density in kg/m³, impact yield in kPa,
 * specific heat in J/(kg·K), melting point, and metallic flag), returns the integer Four-Float `(pxd, vtx, lx, aq)` on
 * `0..10000`.
 */
export function inverseElementFromPhysics(input: {
  readonly id: string;
  readonly name: string;
  readonly solidDensityKgM3: number;
  readonly impactYieldKPa: number;
  readonly specHeatJkgK: number;
  readonly isMetal: boolean;
}): ElementPreset {
  // Vtx is directly density in kg/m³ on 1..10000 (see deriveElementPhysics line 330)
  const vtx = clampInt(input.solidDensityKgM3, 1, 10000);
  // Pxd: yield in DF spans ~10,000 kPa (soft stone/wood) to ~1,200,000 kPa (steel/adamantine)
  const pxdNorm = clamp01(Math.pow(clamp01(input.impactYieldKPa / 1200000), 0.45));
  // Lx: metals have high free-electron conductivity (0.65..0.95); insulators/minerals sit at 0.05..0.30
  const lxNorm = input.isMetal
    ? clamp01(0.65 + 0.28 * (1 - clamp01((input.specHeatJkgK - 120) / 800)))
    : clamp01(0.06 + 0.18 * pxdNorm);
  // Aq: specific heat capacity (180 + aq * 4000 J/(kg·K)) plus dampening elasticity
  const aqNorm = clamp01((input.specHeatJkgK - 180) / 3600);

  return {
    id: input.id,
    name: input.name,
    pxd: clampInt(pxdNorm * 10000, 100, 10000),
    vtx,
    lx: clampInt(lxNorm * 10000, 50, 10000),
    aq: clampInt(aqNorm * 10000, 50, 10000),
  };
}

/**
 * Parses a Dwarf Fortress `inorganic_*.txt` raw file and transduces each `[INORGANIC:...]` entry with physical tokens
 * into a FIDELITY `ElementPreset` + `DerivedElementPhysics`.
 */
export function transduceDfRawsToElements(rawText: string): readonly TransducedDfElement[] {
  const blocks = rawText.split(/\[INORGANIC:/g).slice(1);
  const out: TransducedDfElement[] = [];

  for (const block of blocks) {
    const idMatch = /^([A-Z0-9_]+)\]/.exec(block.trim());
    if (!idMatch) continue;
    const rawId = idMatch[1]!;

    const numToken = (tag: string, fallback: number): number => {
      const m = new RegExp(`\\[${tag}:(\\d+)\\]`).exec(block);
      return m ? Number(m[1]) : fallback;
    };

    const solidDensityKgM3 = numToken('SOLID_DENSITY', 0);
    if (solidDensityKgM3 <= 0) continue; // skip abstract/template-only entries without density

    const impactYieldKPa = numToken('IMPACT_YIELD', 120000);
    const specHeatJkgK = numToken('SPEC_HEAT', 450);
    const meltingPointUrst = numToken('MELTING_POINT', 11500);
    const isMetal = block.includes('[ITEMS_METAL]') || block.includes('[USE_MATERIAL_TEMPLATE:METAL_TEMPLATE]');

    const preset = inverseElementFromPhysics({
      id: `elem:${fnv1aHex8(`df:${rawId}`)}`,
      name: rawId.toLowerCase().replace(/_/g, ' '),
      solidDensityKgM3,
      impactYieldKPa,
      specHeatJkgK,
      isMetal,
    });

    out.push({
      rawId,
      preset,
      measured: {
        solidDensityKgM3,
        impactYieldKPa,
        specHeatJkgK,
        meltingPointUrst,
        isMetal,
      },
      derived: deriveElementPhysics(preset),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Kerbal Space Program `.cfg` Part Transducer -> Socketed Kit & Four-Float Stack
// ---------------------------------------------------------------------------------------------------------------------

export interface KspSocketSpec {
  readonly id: string;
  readonly pos: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly sizeClass: number;
}

export interface TransducedKspPart {
  readonly rawName: string;
  readonly kitOf: string;
  readonly category: string;
  readonly massTonnes: number;
  readonly crashToleranceMps: number;
  readonly maxTempK: number;
  readonly thrustKn: number;
  readonly ispVacSec: number;
  readonly ispSeaSec: number;
  readonly reactionTorqueKnm: number;
  readonly chargeRatePerSec: number;
  readonly propellantCapacityUnits: number;
  readonly sockets: readonly KspSocketSpec[];
  readonly fourFloats: ElementPreset;
  readonly emergentRole: 'thermal-thruster' | 'attitude-gyro' | 'solar-collector' | 'propellant-vessel' | 'structural-frame';
}

/**
 * Parses a KSP `PART { ... }` `.cfg` file and transduces its physical parameters and attachment nodes into a FIDELITY
 * socketed kit summary and Four-Float stack.
 */
export function transduceKspCfgToPartPreset(cfgText: string): TransducedKspPart | null {
  if (!cfgText.includes('PART')) return null;
  const clean = cfgText.replace(/\/\/.*$/gm, '');

  const field = (key: string): string | null => {
    const m = new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`, 'm').exec(clean);
    return m ? m[1]!.trim() : null;
  };
  const numField = (key: string, fallback = 0): number => {
    const v = field(key);
    const n = v !== null ? Number(v.split(/\s+/)[0]) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };

  const rawName = field('name');
  if (!rawName) return null;

  const category = field('category') ?? 'Structural';
  const massTonnes = Math.max(0.001, numField('mass', 0.1));
  const crashToleranceMps = Math.max(1, numField('crashTolerance', 7));
  const maxTempK = Math.max(300, numField('maxTemp', 1200));
  const thrustKn = Math.max(0, numField('maxThrust', 0));
  const pitchTorque = Math.max(0, numField('PitchTorque', 0));
  const chargeRatePerSec = Math.max(0, numField('chargeRate', 0));

  // Parse atmosphereCurve keys: `key = 0 345` (vacuum) and `key = 1 85` (sea level)
  let ispVacSec = 0;
  let ispSeaSec = 0;
  const atmoMatch = /atmosphereCurve\s*\{([^}]+)\}/s.exec(clean);
  if (atmoMatch) {
    const keyMatches = [...atmoMatch[1]!.matchAll(/key\s*=\s*([0-9.]+)\s+([0-9.]+)/g)];
    for (const km of keyMatches) {
      const atm = Number(km[1]);
      const isp = Number(km[2]);
      if (atm === 0) ispVacSec = isp;
      else if (atm === 1) ispSeaSec = isp;
    }
  }

  // Parse RESOURCE amounts
  let propellantCapacityUnits = 0;
  for (const rm of clean.matchAll(/RESOURCE\s*\{([^}]+)\}/gs)) {
    const maxAmt = /maxAmount\s*=\s*([0-9.]+)/.exec(rm[1]!);
    if (maxAmt) propellantCapacityUnits += Number(maxAmt[1]);
  }

  // Parse stack attachment sockets: `node_stack_top = x, y, z, nx, ny, nz, size`
  const sockets: KspSocketSpec[] = [];
  for (const nm of clean.matchAll(/^\s*(node_stack_[A-Za-z0-9_]+|node_attach)\s*=\s*([^\r\n]+)/gm)) {
    const id = nm[1]!;
    const nums = nm[2]!.split(',').map((s) => Number(s.trim()));
    if (nums.length >= 6 && nums.slice(0, 6).every((n) => Number.isFinite(n))) {
      sockets.push({
        id,
        pos: [nums[0]!, nums[1]!, nums[2]!],
        normal: [nums[3]!, nums[4]!, nums[5]!],
        sizeClass: Number.isFinite(nums[6]) ? nums[6]! : 1,
      });
    }
  }

  const pxd = clampInt((0.35 * clamp01(crashToleranceMps / 50) + 0.65 * clamp01(maxTempK / 3200)) * 10000, 500, 10000);
  const vtx = clampInt(clamp01(Math.log10(1 + massTonnes * 10) / 2.5) * 10000, 500, 10000);
  const lx = clampInt(
    clamp01(
      (thrustKn > 0 ? 0.55 + 0.45 * clamp01(ispVacSec / 450) : 0) +
      (pitchTorque > 0 ? 0.7 : 0) +
      (chargeRatePerSec > 0 ? 0.85 : 0.15),
    ) * 10000,
    200,
    10000,
  );
  const aq = clampInt(
    clamp01((propellantCapacityUnits > 0 ? 0.5 + 0.5 * clamp01(propellantCapacityUnits / 1600) : 0.15) + (ispVacSec > 0 ? 0.25 : 0)) * 10000,
    200,
    10000,
  );

  const emergentRole =
    thrustKn > 0
      ? 'thermal-thruster'
      : pitchTorque > 0
        ? 'attitude-gyro'
        : chargeRatePerSec > 0
          ? 'solar-collector'
          : propellantCapacityUnits > 0
            ? 'propellant-vessel'
            : 'structural-frame';

  const kitOf = `kit:${fnv1aHex8(`ksp:${rawName}`)}`;
  return {
    rawName,
    kitOf,
    category,
    massTonnes,
    crashToleranceMps,
    maxTempK,
    thrustKn,
    ispVacSec,
    ispSeaSec,
    reactionTorqueKnm: pitchTorque,
    chargeRatePerSec,
    propellantCapacityUnits,
    sockets,
    fourFloats: { id: kitOf, name: rawName, pxd, vtx, lx, aq },
    emergentRole,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Factorio Prototype Recipe Transducer -> Port-Hamiltonian Synthesis Throughput Spec
// ---------------------------------------------------------------------------------------------------------------------

export interface TransducedRecipePreset {
  readonly recipeOf: string;
  readonly rawName: string;
  readonly energyRequiredSec: number;
  readonly ingredientCount: number;
  readonly totalInputUnits: number;
  readonly totalOutputUnits: number;
  readonly throughputPerMin: number;
}

/**
 * Extracts recipe timing and stoichiometric ratios from Factorio prototype Lua tables (`recipe.lua`).
 */
export function transduceFactorioRecipes(luaText: string): readonly TransducedRecipePreset[] {
  const out: TransducedRecipePreset[] = [];
  const recipeBlocks = luaText.split(/type\s*=\s*"recipe"/g).slice(1);

  for (const block of recipeBlocks) {
    const windowText = block.slice(0, 1200);
    const nameMatch = /name\s*=\s*"([^"]+)"/.exec(windowText);
    if (!nameMatch || nameMatch[1]!.startsWith('parameter-')) continue;
    const rawName = nameMatch[1]!;

    const energyMatch = /energy_required\s*=\s*([0-9.]+)/.exec(windowText);
    const energyRequiredSec = energyMatch ? Math.max(0.1, Number(energyMatch[1])) : 0.5;

    const ingBlock = /ingredients\s*=\s*\{((?:\{[^{}]*\}|[^}])*)\}/.exec(windowText);
    const ingredientAmounts = ingBlock
      ? [...ingBlock[1]!.matchAll(/amount\s*=\s*(\d+)/g)].map((m) => Number(m[1]))
      : [1];
    const ingredientCount = Math.max(1, ingredientAmounts.length);
    const totalInputUnits = Math.max(1, ingredientAmounts.reduce((a, b) => a + b, 0));

    const resBlock = /results\s*=\s*\{((?:\{[^{}]*\}|[^}])*)\}/.exec(windowText);
    const resultAmounts = resBlock
      ? [...resBlock[1]!.matchAll(/amount\s*=\s*(\d+)/g)].map((m) => Number(m[1]))
      : [1];
    const totalOutputUnits = Math.max(1, resultAmounts.reduce((a, b) => a + b, 0));

    const throughputPerMin = Math.round(((60 / energyRequiredSec) * totalOutputUnits) * 100) / 100;
    out.push({
      recipeOf: `logic:${fnv1aHex8(`fact:${rawName}`)}`,
      rawName,
      energyRequiredSec,
      ingredientCount,
      totalInputUnits,
      totalOutputUnits,
      throughputPerMin,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Hades Combat & Boon Timing Lua Transducer -> Combat Cadence & Curve Specs
// ---------------------------------------------------------------------------------------------------------------------

export interface TransducedCombatTiming {
  readonly presetOf: string;
  readonly rawName: string;
  readonly preWaitSec: number;
  readonly activeDurationSec: number;
  readonly cooldownSec: number;
  readonly ammoDropDelaySec: number;
}

/**
 * Extracts weapon cadence, screen-prewait, active duration, and cooldown timings from Hades Lua scripts.
 */
export function transduceHadesLuaToCombatPresets(luaText: string): readonly TransducedCombatTiming[] {
  const out: TransducedCombatTiming[] = [];
  const entryRegex = /^\t([A-Za-z0-9_]+)\s*=\s*\r?\n\t\{([\s\S]*?)^\t\},?/gm;

  for (const match of luaText.matchAll(entryRegex)) {
    const rawName = match[1]!;
    const body = match[2]!;
    const num = (key: string, fb: number): number => {
      const m = new RegExp(`${key}\\s*=\\s*([0-9.]+)`).exec(body);
      return m ? Number(m[1]) : fb;
    };
    const preWaitSec = num('ScreenPreWait', 0.05);
    const activeDurationSec = num('Duration', 0.18);
    const cooldownSec = num('Cooldown', num('ReloadTime', 0.45));
    const ammoDropDelaySec = num('AmmoDropDelay', 0);

    if (body.includes('Duration') || body.includes('Cooldown') || body.includes('AmmoDropDelay') || body.includes('ReloadTime')) {
      out.push({
        presetOf: `mot:${fnv1aHex8(`hades:${rawName}`)}`,
        rawName,
        preWaitSec,
        activeDurationSec,
        cooldownSec,
        ammoDropDelaySec,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Plasma Odin Device & Sketch-to-Wiregraph Transducer (`read-odin-save.mjs` -> `@hm/wiregraph`)
// ---------------------------------------------------------------------------------------------------------------------

export interface TransducedPlasmaContraption {
  readonly deviceName: string;
  readonly kitOf: string;
  readonly logicOf: string;
  readonly componentCount: number;
  readonly agentCount: number;
  readonly totalMassMultiplier: number;
  readonly meanBounciness: number;
  readonly meanFriction: number;
  readonly wiregraph: WireGraphSpec;
}

function odinItems(v: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(v)) return v as readonly Record<string, unknown>[];
  const obj = v as { readonly $items?: readonly unknown[] } | null | undefined;
  if (!obj || !Array.isArray(obj.$items)) return [];
  if (Array.isArray(obj.$items[0])) return obj.$items[0] as readonly Record<string, unknown>[];
  return obj.$items as readonly Record<string, unknown>[];
}

/**
 * Transduces a parsed Plasma `SerializedDevice` object into a validated FIDELITY `WireGraphSpec` (`@hm/wiregraph`)
 * and socketed contraption summary, without requiring the game window to open each device manually.
 */
export function transducePlasmaDevice(deviceObj: unknown): TransducedPlasmaContraption | null {
  if (!deviceObj || typeof deviceObj !== 'object') return null;
  const dev = deviceObj as Record<string, unknown>;
  const deviceName = typeof dev.displayName === 'string' && dev.displayName.trim() ? dev.displayName.trim() : 'PlasmaContraption';
  const agents = odinItems(dev.agents);
  const components = odinItems(dev.components);
  if (agents.length === 0 && components.length === 0) return null;

  let totalMassMultiplier = 0;
  let bouncinessSum = 0;
  let frictionSum = 0;
  for (const comp of components) {
    totalMassMultiplier += typeof comp.massMultiplier === 'number' ? comp.massMultiplier : 1;
    bouncinessSum += typeof comp.bounciness === 'number' ? comp.bounciness : 0.2;
    frictionSum += typeof comp.dynamicFriction === 'number' ? comp.dynamicFriction : 0.5;
  }
  const nComp = Math.max(1, components.length);
  const meanBounciness = Math.round((bouncinessSum / nComp) * 1000) / 1000;
  const meanFriction = Math.round((frictionSum / nComp) * 1000) / 1000;

  // Map agents into sensors, logic nodes, and actuators for a valid FIDELITY WireGraphSpec
  const sensors: SensorSpec[] = [];
  const nodes: LogicNodeSpec[] = [];
  const actuators: ActuatorSpec[] = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const agentId = (agent.agentId ?? {}) as Record<string, unknown>;
    const label = typeof agentId.displayName === 'string' ? agentId.displayName.toLowerCase() : `agent-${i}`;
    if (
      label.includes('button') ||
      label.includes('switch') ||
      label.includes('sensor') ||
      label.includes('detector') ||
      label.includes('proximity') ||
      label.includes('lever') ||
      label.includes('keypad')
    ) {
      if (sensors.length < 4) {
        sensors.push({
          id: `s${sensors.length}`,
          kind: label.includes('power') ? 'power-brownout' : 'proximity',
          threshold: 2.5,
          target: `sensor-${sensors.length}`,
        });
      }
    } else if (
      label.includes('processor') ||
      label.includes('sketch') ||
      label.includes('timer') ||
      label.includes('relay') ||
      label.includes('controller')
    ) {
      if (nodes.length < 4) {
        const sId = sensors.length > 0 ? sensors[nodes.length % sensors.length]!.id : 's0';
        nodes.push({
          id: `n${nodes.length}`,
          kind: label.includes('timer') ? 'delay' : 'latch',
          inputs: [sId],
          ...(label.includes('timer') ? { delayMs: 150 } : {}),
        });
      }
    } else if (actuators.length < 4) {
      const actKind = label.includes('door')
        ? 'open-door'
        : label.includes('light') || label.includes('lamp') || label.includes('led')
          ? 'set-lamp-lx'
          : label.includes('sound') || label.includes('speaker')
            ? 'play-sound'
            : label.includes('turret') || label.includes('cannon') || label.includes('ray')
              ? 'fire-turret'
              : 'toggle-machine';
      actuators.push({
        id: `a${actuators.length}`,
        kind: actKind,
        input: 'n0',
        target: `part-${actuators.length}`,
        value: 1,
      });
    }
  }

  if (sensors.length === 0) {
    sensors.push({ id: 's0', kind: 'proximity', threshold: 3.0, target: 'sensor-0' });
  }
  if (nodes.length === 0) {
    nodes.push({ id: 'n0', kind: 'delay', inputs: [sensors[0]!.id], delayMs: 100 });
  } else {
    // Ensure every node's inputs point to an existing sensor id
    for (let i = 0; i < nodes.length; i++) {
      const sId = sensors[i % sensors.length]!.id;
      nodes[i] = { ...nodes[i]!, inputs: [sId] };
    }
  }
  if (actuators.length === 0) {
    actuators.push({ id: 'a0', kind: 'open-door', input: nodes[0]!.id, target: 'part-0', value: 1 });
  } else {
    for (let i = 0; i < actuators.length; i++) {
      const nId = nodes[i % nodes.length]!.id;
      actuators[i] = { ...actuators[i]!, input: nId };
    }
  }

  const hash = fnv1aHex8(`plasma:${deviceName}:${components.length}:${agents.length}`);
  const wiregraph: WireGraphSpec = {
    id: `plasma-${hash}`,
    name: `Transduced ${deviceName}`,
    sensors,
    nodes,
    actuators,
  };
  const errs = validateWireGraph(wiregraph);
  if (errs.length > 0) {
    throw new Error(`Invalid transduced wiregraph: ${errs.join('; ')}`);
  }

  return {
    deviceName,
    kitOf: `kit:${hash}`,
    logicOf: `logic:${hash}`,
    componentCount: components.length,
    agentCount: agents.length,
    totalMassMultiplier: Math.round(totalMassMultiplier * 100) / 100,
    meanBounciness,
    meanFriction,
    wiregraph,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. Automated Live Bridge Stream Accumulator (`stepAutoMimicLiveSession`)
// ---------------------------------------------------------------------------------------------------------------------

export interface LiveBridgeSample {
  readonly t: number;
  readonly pos?: readonly [number, number, number];
  readonly shotFired?: boolean;
  readonly kick?: number;
  readonly eventName?: string;
}

export interface AutoMimicLiveState {
  readonly game: string;
  readonly trajectory: {
    readonly t: readonly number[];
    readonly x: readonly number[];
    readonly y: readonly number[];
    readonly z: readonly number[];
  };
  readonly shots: {
    readonly t: readonly number[];
    readonly kick: readonly number[];
  };
  readonly events: readonly { readonly t: number; readonly name: string }[];
  readonly latestResult: MimicryResult | null;
  /** Automatically minted preset IDs once confidence >= 0.75. */
  readonly mintedPresets: readonly string[];
}

export const AUTO_MIMIC_WINDOW_MAX = 256;
export const AUTO_MIMIC_MINT_CONFIDENCE = 0.75;

export function createAutoMimicLiveState(game: string): AutoMimicLiveState {
  return {
    game,
    trajectory: { t: [], x: [], y: [], z: [] },
    shots: { t: [], kick: [] },
    events: [],
    latestResult: null,
    mintedPresets: [],
  };
}

/**
 * Feeds one live bridge sample (from `/mirror` or `/frame`) into the rolling accumulator and automatically runs
 * `mimicMechanic` + mints discovered presets when enough samples have accumulated (`confidence >= 0.75`).
 */
export function stepAutoMimicLiveSession(state: AutoMimicLiveState, sample: LiveBridgeSample): AutoMimicLiveState {
  const traj = sample.pos
    ? {
        t: [...state.trajectory.t, sample.t].slice(-AUTO_MIMIC_WINDOW_MAX),
        x: [...state.trajectory.x, sample.pos[0]].slice(-AUTO_MIMIC_WINDOW_MAX),
        y: [...state.trajectory.y, sample.pos[1]].slice(-AUTO_MIMIC_WINDOW_MAX),
        z: [...state.trajectory.z, sample.pos[2]].slice(-AUTO_MIMIC_WINDOW_MAX),
      }
    : state.trajectory;

  const shots = sample.shotFired
    ? {
        t: [...state.shots.t, sample.t].slice(-AUTO_MIMIC_WINDOW_MAX),
        kick: [...state.shots.kick, sample.kick ?? 0.02].slice(-AUTO_MIMIC_WINDOW_MAX),
      }
    : state.shots;

  const events = sample.eventName
    ? [...state.events, { t: sample.t, name: sample.eventName }].slice(-AUTO_MIMIC_WINDOW_MAX)
    : state.events;

  const hasEnough = traj.t.length >= 16 || shots.t.length >= 4 || events.length >= 4;
  if (!hasEnough) {
    return { ...state, trajectory: traj, shots, events };
  }

  const obs: MechanicObservation = {
    game: state.game,
    channel: 'telemetry',
    ...(traj.t.length >= 16 ? { trajectory: traj } : {}),
    ...(shots.t.length >= 4 ? { shots } : {}),
    ...(events.length >= 4 ? { events } : {}),
  };

  const result = transduceMechanic(obs);
  const minted = new Set(state.mintedPresets);
  if (result.confidence >= AUTO_MIMIC_MINT_CONFIDENCE) {
    if (result.locomotion) minted.add(`loc:${fnv1aHex8(`${state.game}:${result.locomotion.gravityMps2}:${result.locomotion.jumpImpulseMps}`)}`);
    if (result.logic) minted.add(`logic:${fnv1aHex8(`${state.game}:${result.logic.id}`)}`);
    if (result.fire) minted.add(`mot:${fnv1aHex8(`${state.game}:${result.fire.roundsPerSecond}:${result.fire.burst}`)}`);
  }

  return {
    game: state.game,
    trajectory: traj,
    shots,
    events,
    latestResult: result,
    mintedPresets: [...minted].sort(),
  };
}
