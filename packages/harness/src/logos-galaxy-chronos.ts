/**
 * Plan 58 Wave 4 (Part A): Galactic Center-to-Rim Seed Orientation, Deterministic Orbital Lattice,
 * Non-Coercive Suggestion Handshake ("Neural Ghost"), Unity-in-Diversity SMC Circles & The Chronos Loop
 * (`packages/harness/src/logos-galaxy-chronos.ts`).
 *
 * Salvaged and SQ-Distortion-Checked from Piskriek's `Logos_Kernel V13.0` / Entropy Gates design notes:
 * - All coercive override/purge and hive-mind clone-conformity mechanics are stripped under Audit A3 (Non-Coercion)
 *   and `RULES 8a` (Zero Architectural Lies).
 * - Preserves the 5 undistorted Law-of-One / scientific systems:
 *   1. Galactic Radial Coordinate ($r_{\text{galactic}} \in [0, 1]$, Ra Session 78.8):
 *      - Inner Core ($r < 0.35$): Ancient high-energy foundational systems (monochrome pre-Veil elemental forges `S0a`
 *        or high-density harmonic anchors `S5`–`S6`).
 *      - Mid-to-Outer Rim ($r \ge 0.35$, Player Spawn at `S3`): Veiled 3rd-density frontier systems where the Veil
 *        ($v_{\text{veil}}$) and The Choice (`22. The Fool`) are active, surrounded by worlds across `S0a..S6`.
 *   2. Deterministic Orbital Sector Transit:
 *      - Planets, moons, and Stargate rings orbit deterministically over time, creating real Hohmann Orbital Transfer
 *        Windows (low $\Delta v$ launches) and Harmonic Conjunction Windows ("Rare Signals" where $\ge 3$ bodies align
 *        within $12^\circ$, temporarily thinning $v_{\text{veil}}$ and spawning high-catalyst anomalies).
 *   3. The Suggestion Handshake & "Neural Ghost" (`IPriorModulationDownward`):
 *      - Tactical pings (`ORBIT_STABLE`, `GRAVITY_SLINGSHOT`, `FLANK_VECTOR`, `SYNTROPIC_SHIELD_SHARE`) project a
 *        non-coercive Neural Ghost suggestion vector. If an entity or `PATH_4` enclave attempts coercive control
 *        (`solar-control`), the Entropy Tax halts autonomous learning, raises `preset-body` stiffness/ache, and scales
 *        $\lambda_{\text{FTLE}}$ / Neural Noise with hierarchy size.
 *   4. Unity-in-Diversity Resonance Circles (Social Memory Complex Nexus):
 *      - Scores Circle/SMC coherence ($H_{\text{system}}$) by Complementary 7-Ray & Polarity Coverage across
 *        $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ rather than clone uniformity, and credits
 *        syntropic resonance when members contribute balanced `Mem` or `kit:`/`logic:` presets.
 *   5. The Chronos Loop ("Morning SitRep", Heuristic Bounty & 30s Ghost Replay):
 *      - Pairs the session-open W3 Dream pass with a Morning SitRep card, a temporary `+5%` Dream Lesson Bounty on the
 *        ray tested overnight, and a deterministic 30s Ghost Replay (`hm2:clip:v1` / `clip:`) for the Holodeck.
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O).
 */
import { ALIGNED, checkMem, type Mem, type SqId, type StageId } from '@hm/shorthand';
import { crossWiredPolarity } from './archetypes.js';
import { bodyStep, type BodyState } from './body.js';
import { wakeLine, type DreamDigest } from './dream.js';
import { anchorCalm } from './lifecycle.js';
import { createClipManifest, encodeClipShareCode, type ClipManifest } from './meta-shell.js';
import { BALANCED_AT, memoryBalance, noteCause, recordExperience } from './preset-memory.js';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import type { IPriorModulationDownward } from './types.js';

export interface FourFloats {
  readonly Pxd: number;
  readonly Vtx: number;
  readonly Lx: number;
  readonly Aq: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const round3 = (x: number): number => Math.round(x * 1000) / 1000;
const DEG_TO_RAD = Math.PI / 180;

/** Deterministic 32-bit FNV-1a hash for seeds. */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (Mulberry32) in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =====================================================================================================================
// 1. Galactic Center-to-Rim Seed Orientation & Deterministic Orbital Lattice (Ra Session 78.8)
// =====================================================================================================================

export type GalacticZone = 'inner-core' | 'mid-outer-rim';

export interface OrbitalBodySeed {
  readonly id: string;
  readonly name: string;
  readonly kind: 'planet' | 'moon' | 'stargate-ring';
  readonly stage: StageId;
  /** Semi-major orbital radius in sector units (AU-scaled: 0.4..6.0). */
  readonly orbitRadiusAu: number;
  /** Angular velocity in degrees per 100 ticks. */
  readonly angularSpeedDegPer100Ticks: number;
  /** Initial orbital phase in degrees [0, 360). */
  readonly initialPhaseDeg: number;
  /** World Four-Float signature $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$. */
  readonly fourFloats: FourFloats;
  /** Planet Forge share code (`SMX-PLN-XXXX-NAME`). */
  readonly shareCode: string;
}

export interface GalacticStarSystemSeed {
  readonly systemId: string;
  readonly seed: string;
  /** Galactic radial coordinate $r_{\text{galactic}} \in [0, 1]$ (0 = Galactic Core, 1 = Outer Rim). */
  readonly rGalactic: number;
  readonly zone: GalacticZone;
  /** Spiral arm azimuth angle in degrees [0, 360). */
  readonly spiralAngleDeg: number;
  /** Dominant fidelity stage of the star system (`S0a` or `S5..S6` in Inner Core; `S3` spawn on Rim). */
  readonly primaryStage: StageId;
  /** Base Veil permeability $v_{\text{veil}} \in [0, 1]$ (high Veil = thick forgetting on the frontier Rim). */
  readonly baseVeilThickness: number;
  /** Whether The Choice (Station 22 / The Fool) is actively tested in this sector. */
  readonly choiceActive: boolean;
  readonly bodies: readonly OrbitalBodySeed[];
}

export interface OrbitalTransferWindow {
  readonly fromBodyId: string;
  readonly toBodyId: string;
  /** Current phase difference in degrees (-180..180]. */
  readonly currentPhaseDiffDeg: number;
  /** Ideal Hohmann transfer phase angle in degrees. */
  readonly idealHohmannPhaseDeg: number;
  /** Alignment error in degrees [0..180]. Window is open when <= 15 deg. */
  readonly phaseErrorDeg: number;
  readonly windowOpen: boolean;
  /** Relative $\Delta v$ cost multiplier (1.00 at ideal Hohmann window, up to 2.60 out of phase). */
  readonly deltaVMultiplier: number;
}

export interface HarmonicConjunctionSignal {
  readonly signalId: string;
  readonly alignedBodyIds: readonly string[];
  readonly meanAngleDeg: number;
  readonly maxSpreadDeg: number;
  /** Amount by which the conjunction thins $v_{\text{veil}}$ (0.15..0.40). */
  readonly veilThinningDelta: number;
  readonly anomalyCatalyst: 'RARE_HARMONIC_CONJUNCTION' | 'TRINARY_GATE_ALIGNMENT';
  readonly fourFloatsBoost: FourFloats;
}

export interface OrbitalLatticeSnapshot {
  readonly systemId: string;
  readonly tick: number;
  readonly rGalactic: number;
  readonly zone: GalacticZone;
  /** Effective Veil thickness after any active Harmonic Conjunction thinning. */
  readonly effectiveVeilThickness: number;
  readonly bodyPositions: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: OrbitalBodySeed['kind'];
    readonly stage: StageId;
    readonly angleDeg: number;
    readonly sectorX: number;
    readonly sectorZ: number;
  }[];
  readonly transferWindows: readonly OrbitalTransferWindow[];
  readonly conjunctionSignals: readonly HarmonicConjunctionSignal[];
}

const RIM_FRONTIER_STAGES: readonly StageId[] = ['S0a', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const BODY_NAMES = ['Aethel', 'Selene', 'Ignis', 'Verdant', 'Thalassa', 'Lumen', 'Onyx'] as const;

/**
 * Ra Session 78.8: Seeds a deterministic star system along the Galactic Center-to-Rim vector ($r_{\text{galactic}} \in [0, 1]$).
 * - Inner Core ($r < 0.35$): Ancient high-energy foundational systems (`S0a` elemental forges or `S5`–`S6` harmonic anchors).
 * - Mid-to-Outer Rim ($r \ge 0.35$): Veiled 3rd-density frontier systems (`primaryStage: 'S3'`, `choiceActive: true`)
 *   surrounded by worlds across `S0a..S6`.
 */
export function seedGalacticSystem(seed: string, rGalacticOverride?: number): GalacticStarSystemSeed {
  const cleanSeed = seed.trim() || 'logos-prime';
  const hash = fnv1a32(cleanSeed);
  const rand = mulberry32(hash);

  const rGalactic = round3(
    rGalacticOverride !== undefined ? clamp(rGalacticOverride, 0, 1) : rand(),
  );
  const zone: GalacticZone = rGalactic < 0.35 ? 'inner-core' : 'mid-outer-rim';
  const spiralAngleDeg = round3((rGalactic * 540 + rand() * 60) % 360);

  let primaryStage: StageId;
  let baseVeilThickness: number;
  let choiceActive: boolean;

  if (zone === 'inner-core') {
    // Inner Core: either primordial pre-Veil S0a forge or ancient S5/S6 harmonic anchor
    const roll = rand();
    primaryStage = roll < 0.4 ? 'S0a' : roll < 0.7 ? 'S5' : 'S6';
    baseVeilThickness = round3(0.08 + rGalactic * 0.4); // Thin Veil (0.08..0.22)
    choiceActive = false;
  } else {
    // Mid-to-Outer Rim: Veiled 3rd-density frontier spawn (S3) where The Choice is active
    primaryStage = 'S3';
    baseVeilThickness = round3(clamp(0.68 + (rGalactic - 0.35) * 0.35, 0.68, 0.92));
    choiceActive = true;
  }

  const bodyCount = 5;
  const bodies: OrbitalBodySeed[] = [];
  for (let i = 0; i < bodyCount; i++) {
    const orbitRadiusAu = round3(0.55 + i * 0.75 + rand() * 0.18);
    // Kepler's Third Law: $\omega \propto r^{-3/2}$
    const angularSpeedDegPer100Ticks = round3(24 / Math.pow(orbitRadiusAu, 1.5));
    const initialPhaseDeg = round3(rand() * 360);
    const kind: OrbitalBodySeed['kind'] =
      i === bodyCount - 1 ? 'stargate-ring' : i === 1 ? 'moon' : 'planet';

    let stage: StageId;
    if (zone === 'inner-core') {
      stage = primaryStage === 'S0a' ? (i < 3 ? 'S0a' : 'S0b') : i % 2 === 0 ? 'S5' : 'S6';
    } else {
      stage = i === 0 ? 'S3' : RIM_FRONTIER_STAGES[(hash + i * 3) % RIM_FRONTIER_STAGES.length]!;
    }

    const name = `${BODY_NAMES[i % BODY_NAMES.length]!}-${i + 1}`;
    const numCode = String(1000 + ((hash + i * 997) % 9000)).padStart(4, '0');
    const shareCode = `SMX-PLN-${numCode}-${name.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

    const stageIdx = RIM_FRONTIER_STAGES.indexOf(stage);
    const rankNorm = clamp((stageIdx >= 0 ? stageIdx : 3) / 6, 0.15, 1);

    bodies.push({
      id: `body-${i + 1}`,
      name,
      kind,
      stage,
      orbitRadiusAu,
      angularSpeedDegPer100Ticks,
      initialPhaseDeg,
      fourFloats: {
        Pxd: round3(clamp(0.3 + rankNorm * 0.65, 0, 1)),
        Vtx: round3(clamp(0.25 + rankNorm * 0.7, 0, 1)),
        Lx: round3(clamp(zone === 'inner-core' ? 0.85 : 0.35 + rankNorm * 0.55, 0, 1)),
        Aq: round3(clamp(kind === 'planet' ? 0.4 + (i % 3) * 0.2 : 0.15, 0, 1)),
      },
      shareCode,
    });
  }

  return {
    systemId: `sys:${cleanSeed.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`,
    seed: cleanSeed,
    rGalactic,
    zone,
    spiralAngleDeg,
    primaryStage,
    baseVeilThickness,
    choiceActive,
    bodies,
  };
}

function normalizeAngle360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function shortestSignedAngleDeg(fromDeg: number, toDeg: number): number {
  const diff = ((toDeg - fromDeg + 540) % 360) - 180;
  return diff === -180 ? 180 : diff;
}

/**
 * Steps the deterministic orbital lattice at `tick`, computing sector coordinates, Hohmann Orbital Transfer Windows
 * (low $\Delta v$ launches), and Harmonic Conjunction Windows ("Rare Signals" where $\ge 3$ bodies align within $12^\circ$,
 * thinning $v_{\text{veil}}$ and spawning high-catalyst anomalies).
 */
export function stepOrbitalLattice(system: GalacticStarSystemSeed, tick: number): OrbitalLatticeSnapshot {
  const safeTick = Math.max(0, tick);
  const bodyPositions = system.bodies.map((b) => {
    const angleDeg = round3(normalizeAngle360(b.initialPhaseDeg + (safeTick / 100) * b.angularSpeedDegPer100Ticks));
    const rad = angleDeg * DEG_TO_RAD;
    const radiusMeters = b.orbitRadiusAu * 1000;
    return {
      id: b.id,
      name: b.name,
      kind: b.kind,
      stage: b.stage,
      angleDeg,
      sectorX: round3(Math.cos(rad) * radiusMeters),
      sectorZ: round3(Math.sin(rad) * radiusMeters),
      orbitRadiusAu: b.orbitRadiusAu,
    };
  });

  // Compute Hohmann transfer windows from the primary spawn body (body[0]) to all other bodies
  const origin = bodyPositions[0];
  const transferWindows: OrbitalTransferWindow[] = [];
  if (origin) {
    for (let i = 1; i < bodyPositions.length; i++) {
      const target = bodyPositions[i]!;
      const r1 = origin.orbitRadiusAu;
      const r2 = target.orbitRadiusAu;
      // Ideal Hohmann phase angle: $\phi_0 = 180^\circ \times (1 - (\frac{r_1 + r_2}{2 r_2})^{3/2})$
      const ratio = (r1 + r2) / (2 * r2);
      const idealHohmannPhaseDeg = round3(normalizeAngle360(180 * (1 - Math.pow(ratio, 1.5))));
      const idealSigned = idealHohmannPhaseDeg > 180 ? idealHohmannPhaseDeg - 360 : idealHohmannPhaseDeg;
      const currentPhaseDiffDeg = round3(shortestSignedAngleDeg(origin.angleDeg, target.angleDeg));
      const phaseErrorDeg = round3(Math.abs(shortestSignedAngleDeg(idealSigned, currentPhaseDiffDeg)));
      const windowOpen = phaseErrorDeg <= 15;
      const deltaVMultiplier = round3(1 + (phaseErrorDeg / 180) * 1.6);

      transferWindows.push({
        fromBodyId: origin.id,
        toBodyId: target.id,
        currentPhaseDiffDeg,
        idealHohmannPhaseDeg: round3(idealSigned),
        phaseErrorDeg,
        windowOpen,
        deltaVMultiplier,
      });
    }
  }

  // Detect Harmonic Conjunction Windows (>= 3 bodies aligned within 12 degrees)
  const conjunctionSignals: HarmonicConjunctionSignal[] = [];
  for (let i = 0; i < bodyPositions.length; i++) {
    const anchor = bodyPositions[i]!;
    const aligned = bodyPositions.filter(
      (other) => Math.abs(shortestSignedAngleDeg(anchor.angleDeg, other.angleDeg)) <= 6,
    );
    if (aligned.length >= 3) {
      const ids = aligned.map((a) => a.id).sort();
      const sigKey = ids.join('+');
      if (!conjunctionSignals.some((s) => s.alignedBodyIds.join('+') === sigKey)) {
        const spreads = aligned.map((a) => Math.abs(shortestSignedAngleDeg(anchor.angleDeg, a.angleDeg)));
        const maxSpreadDeg = round3(Math.max(...spreads) * 2);
        const hasGate = aligned.some((a) => a.kind === 'stargate-ring');
        const veilThinningDelta = round3(clamp(0.18 + (aligned.length - 3) * 0.08 + (hasGate ? 0.06 : 0), 0.15, 0.4));
        conjunctionSignals.push({
          signalId: `conj:${system.systemId}:${safeTick}:${sigKey}`,
          alignedBodyIds: ids,
          meanAngleDeg: anchor.angleDeg,
          maxSpreadDeg,
          veilThinningDelta,
          anomalyCatalyst: hasGate ? 'TRINARY_GATE_ALIGNMENT' : 'RARE_HARMONIC_CONJUNCTION',
          fourFloatsBoost: {
            Pxd: 0.08,
            Vtx: 0.08,
            Lx: round3(0.15 + veilThinningDelta * 0.25),
            Aq: 0.1,
          },
        });
      }
    }
  }

  const totalThinning = conjunctionSignals.reduce((s, c) => s + c.veilThinningDelta, 0);
  const effectiveVeilThickness = round3(clamp(system.baseVeilThickness - totalThinning, 0.05, 1));

  return {
    systemId: system.systemId,
    tick: safeTick,
    rGalactic: system.rGalactic,
    zone: system.zone,
    effectiveVeilThickness,
    bodyPositions: bodyPositions.map(({ orbitRadiusAu: _r, ...rest }) => rest),
    transferWindows,
    conjunctionSignals,
  };
}

// =====================================================================================================================
// 2. The Suggestion Handshake & "Neural Ghost" (Non-Coercive Companion Tactical Intent — Audit A3)
// =====================================================================================================================

export type TacticalPingKind =
  | 'ORBIT_STABLE'
  | 'GRAVITY_SLINGSHOT'
  | 'FLANK_VECTOR'
  | 'SYNTROPIC_SHIELD_SHARE';

/**
 * Downward prior modulation vector (`INeuralGhostPriorModulation`, extending `IPriorModulationDownward`)
 * projected as a translucent "Neural Ghost" suggestion rather than a hard command override.
 */
export interface INeuralGhostPriorModulation extends IPriorModulationDownward {
  readonly schema: 'hm2:neural-ghost:v1';
  readonly ping: TacticalPingKind;
  readonly targetVector: { readonly x: number; readonly y: number; readonly z: number };
  /** Suggested prior bias weight in [0, 1] (never 1.0 hard lock). */
  readonly suggestionGain: number;
  /** Calm lent by the sender's Wanderer Anchor (0..0.3). */
  readonly lentAnchorCalm: number;
  /** Sovereign free-will guarantee: always true for valid Neural Ghost handshakes. */
  readonly preservesFreeWill: true;
}

export interface EntropyTaxReport {
  readonly taxed: boolean;
  readonly hierarchySize: number;
  /** Finite-Time Lyapunov Exponent ($\lambda_{\text{FTLE}}$) chaos/divergence tax. */
  readonly lambdaFtle: number;
  /** Neural noise injected into control loop [0, 1]. */
  readonly neuralNoise: number;
  /** Autonomous learning is halted whenever coercive override is attempted. */
  readonly learningHalted: boolean;
  /** Added somatic stiffness/ache across the coerced body. */
  readonly addedBodyAche: number;
}

export interface SuggestionHandshakeResult {
  readonly accepted: boolean;
  readonly responseMode: 'harmonious-accept' | 'creative-adaptation' | 'sovereign-decline' | 'coercive-entropy-tax';
  readonly ghostVector: INeuralGhostPriorModulation;
  readonly entropyTax: EntropyTaxReport;
  readonly receiverMem: Mem;
  readonly receiverBody: BodyState;
  readonly rationale: string;
}

/**
 * Projects a non-coercive Tactical Suggestion Handshake ("Neural Ghost") from a player/leader to a companion/native.
 * - Under Audit A3 (Non-Coercion), if `coerciveOverride` is true or the sender acts from `solar-control` dominance
 *   (`senderMem.charge[2] >= 48`), the **Entropy Tax** triggers: autonomous learning halts, `preset-body` stiffness/ache
 *   rises, and $\lambda_{\text{FTLE}}$ / Neural Noise scales with `hierarchySize`.
 * - When non-coercive, the companion evaluates the Neural Ghost vector sovereignly using its own balance and openness.
 */
export function projectSuggestionHandshake(input: {
  readonly ping: TacticalPingKind;
  readonly targetVector: { readonly x: number; readonly y: number; readonly z: number };
  readonly senderMem: Mem;
  readonly receiverMem: Mem;
  readonly receiverBody?: BodyState | null;
  readonly tick: number;
  /** If true, an entity or PATH_4 enclave attempted to force/possess the companion (triggers Entropy Tax). */
  readonly coerciveOverride?: boolean;
  /** Number of subordinates in the coercive hierarchy ($N_{\text{hierarchy}} \ge 1$). */
  readonly hierarchySize?: number;
}): SuggestionHandshakeResult {
  checkMem(input.senderMem);
  checkMem(input.receiverMem);

  const hierarchySize = Math.max(1, Math.round(input.hierarchySize ?? 1));
  const senderControlCharge = input.senderMem.charge[2] ?? 0; // Ray 3 (Yellow / solar-control)
  const isCoercive = Boolean(input.coerciveOverride) || senderControlCharge >= 64;

  const lentCalm = anchorCalm([input.senderMem]);
  const ghostVector: INeuralGhostPriorModulation = {
    schema: 'hm2:neural-ghost:v1',
    ping: input.ping,
    contextMode: input.ping === 'FLANK_VECTOR' ? 'COMBAT_ESCORT' : 'PATROL',
    ethicalConstraintBitmask: 0b1111,
    attractorTargetPos: [input.targetVector.x, input.targetVector.y, input.targetVector.z],
    calmFactorKappa: lentCalm,
    targetVector: input.targetVector,
    suggestionGain: isCoercive ? 0 : round3(clamp(0.45 + lentCalm * 0.8 + input.receiverMem.bal * 0.25, 0.15, 0.85)),
    lentAnchorCalm: lentCalm,
    preservesFreeWill: true,
  };

  if (isCoercive) {
    // Apply the Entropy Tax: learning halts, sacral-resistance / solar-control charges, and lambda_FTLE scales with hierarchySize
    const lambdaFtle = round3(clamp(0.18 * Math.log2(hierarchySize + 1) + (senderControlCharge / 127) * 0.35, 0.15, 1.5));
    const neuralNoise = round3(clamp(0.25 + 0.15 * Math.sqrt(hierarchySize), 0.25, 0.95));

    // Charge receiver's Ray 2 (sacral-resistance) and Ray 3 (solar-control) and open a cause link so bodyStep trips stiffness/ache
    const bumpedCharge = [...input.receiverMem.charge];
    bumpedCharge[1] = Math.min(127, (bumpedCharge[1] ?? 0) + 28);
    bumpedCharge[2] = Math.min(127, (bumpedCharge[2] ?? 0) + 32);
    let taxedMem = checkMem({
      ...input.receiverMem,
      charge: bumpedCharge,
      bal: memoryBalance(bumpedCharge),
    });
    taxedMem = noteCause(taxedMem, 'solar-control', 'sacral-resistance');

    // Step body twice so the held coercive block trips into congested/ache state
    const step1 = bodyStep({
      kind: input.receiverBody?.kind ?? 'organic',
      mem: taxedMem,
      prev: input.receiverBody ?? null,
      sideOf: () => 'left',
    });
    const step2 = bodyStep({
      kind: step1.body.kind,
      mem: step1.mem,
      prev: step1.body,
      sideOf: () => 'left',
    });
    const maxAche = round3(Math.max(...step2.body.zones.map((z) => z.ache), 0.25));

    return {
      accepted: false,
      responseMode: 'coercive-entropy-tax',
      ghostVector,
      entropyTax: {
        taxed: true,
        hierarchySize,
        lambdaFtle,
        neuralNoise,
        learningHalted: true,
        addedBodyAche: maxAche,
      },
      receiverMem: step2.mem,
      receiverBody: step2.body,
      rationale: `Coercive override rejected (Audit A3): Entropy Tax active (lambda_FTLE=${lambdaFtle}, noise=${neuralNoise}), autonomous learning halted, somatic stiffness/ache=${maxAche}.`,
    };
  }

  // Non-coercive Suggestion Handshake: companion evaluates sovereignly
  const openness = (1 - input.receiverMem.hard * 0.5) * (0.5 + input.receiverMem.bal * 0.5) + lentCalm;
  const accepted = openness >= 0.45;
  const cw = crossWiredPolarity(input.receiverMem);
  const responseMode: SuggestionHandshakeResult['responseMode'] = !accepted
    ? 'sovereign-decline'
    : cw.pole === 'intent'
      ? 'creative-adaptation'
      : 'harmonious-accept';

  const updatedMem = recordExperience(input.receiverMem, {
    t: Math.max(0, Math.round(input.tick)),
    stage: 'S3',
    cat: `GHOST_${input.ping}`,
    excitement: accepted ? 0.6 : 0.35,
    error: Math.max(0.05, 0.25 - lentCalm * 0.5),
    by: ALIGNED,
  });
  const steppedBody = bodyStep({
    kind: input.receiverBody?.kind ?? 'organic',
    mem: updatedMem,
    prev: input.receiverBody ?? null,
    sideOf: () => 'center',
  });

  return {
    accepted,
    responseMode,
    ghostVector,
    entropyTax: {
      taxed: false,
      hierarchySize: 1,
      lambdaFtle: 0,
      neuralNoise: 0,
      learningHalted: false,
      addedBodyAche: 0,
    },
    receiverMem: steppedBody.mem,
    receiverBody: steppedBody.body,
    rationale: accepted
      ? `Sovereign ${responseMode}: Neural Ghost ${input.ping} integrated (gain=${ghostVector.suggestionGain}, lentCalm=${lentCalm}).`
      : `Sovereign decline: companion chose to hold current vector while rebalancing.`,
  };
}

// =====================================================================================================================
// 3. Unity-in-Diversity Resonance Circles (Social Memory Complex Nexus)
// =====================================================================================================================

export interface CircleMemberContribution {
  readonly memberId: string;
  readonly name: string;
  readonly mem: Mem;
  /** Member's specialty across the Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$. */
  readonly fourFloatsSpecialty: FourFloats;
  /** Contributed `kit:`, `logic:`, `matc:`, or `ui:` preset share codes. */
  readonly contributedPresets?: readonly string[];
}

export interface UnityInDiversityStatus {
  readonly memberCount: number;
  /** Mean individual balance across members [0, 1]. */
  readonly meanBalance: number;
  /** Coverage across the Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ [0, 1]. */
  readonly fourFloatsCoverage: number;
  /** Complementary polarity diversity score [0, 1] (rewards Masculine + Feminine + Balanced interplay over clones). */
  readonly polarityComplementarity: number;
  /** Complementary 7-ray readiness coverage [0, 1]. */
  readonly sevenRayCoverage: number;
  /** Syntropic bonus from contributed balanced `Mem` and `kit:`/`logic:` presets (0..0.12). */
  readonly nexusContributionBonus: number;
  /** Combined Unity-in-Diversity coherence $H_{\text{system}} \in [0, 1]$. */
  readonly hSystem: number;
  /** True when $H_{\text{system}} \ge 0.95$ and at least 2 members participate. */
  readonly isSocialMemoryComplex: boolean;
  readonly pooledPresets: readonly string[];
}

/**
 * Scores a Party or Guild Circle by **Unity-in-Diversity** rather than clone conformity:
 * - Rewards complementary coverage across $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$,
 *   complementary Masculine/Feminine/Balanced archetypical polarity, and balanced 7-ray stability.
 * - Credits syntropic resonance across the Circle when members contribute balanced `Mem` or `kit:`/`logic:` presets
 *   to the SMC Nexus.
 */
export function evaluateUnityInDiversityCircle(
  members: readonly CircleMemberContribution[],
): UnityInDiversityStatus {
  if (members.length === 0) {
    return {
      memberCount: 0,
      meanBalance: 1,
      fourFloatsCoverage: 0,
      polarityComplementarity: 0,
      sevenRayCoverage: 0,
      nexusContributionBonus: 0,
      hSystem: 0,
      isSocialMemoryComplex: false,
      pooledPresets: [],
    };
  }

  const mems = members.map((m) => checkMem(m.mem));
  const meanBalance = round3(mems.reduce((s, m) => s + m.bal, 0) / mems.length);

  // 1. Complementary Four-Float coverage: envelope of max specialties across (Pxd, Vtx, Lx, Aq)
  const maxPxd = Math.max(...members.map((m) => clamp(m.fourFloatsSpecialty.Pxd, 0, 1)));
  const maxVtx = Math.max(...members.map((m) => clamp(m.fourFloatsSpecialty.Vtx, 0, 1)));
  const maxLx = Math.max(...members.map((m) => clamp(m.fourFloatsSpecialty.Lx, 0, 1)));
  const maxAq = Math.max(...members.map((m) => clamp(m.fourFloatsSpecialty.Aq, 0, 1)));
  const fourFloatsCoverage = round3((maxPxd + maxVtx + maxLx + maxAq) / 4);

  // 2. Polarity complementarity: rewards having complementary poles represented (intent, context, balanced)
  const poles = new Set(
    mems.map((m) => {
      const cw = crossWiredPolarity(m);
      return Math.abs(cw.pol) < 32 ? 'balanced' : cw.pole;
    }),
  );
  const hasBothMasculineAndFeminine = poles.has('intent') && poles.has('context');
  const polarityComplementarity = round3(
    members.length === 1
      ? 0.7
      : poles.size >= 3 || hasBothMasculineAndFeminine
        ? 1.0
        : poles.size === 2
          ? 0.95
          : 0.78,
  );

  // 3. 7-Ray coverage: fraction of the 7 rays where at least one member is at rest (|charge| <= 4)
  let raysCovered = 0;
  for (let r = 0; r < 7; r++) {
    if (mems.some((m) => Math.abs(m.charge[r] ?? 0) <= 4)) raysCovered++;
  }
  const sevenRayCoverage = round3(raysCovered / 7);

  // 4. Syntropic Nexus contribution bonus from balanced Mem + shared kit:/logic: presets
  const pooledPresets = [
    ...new Set(members.flatMap((m) => [...(m.contributedPresets ?? []), m.mem.of])),
  ].sort();
  const balancedContributors = members.filter(
    (m) => m.mem.bal >= BALANCED_AT && (m.contributedPresets?.length ?? 0) > 0,
  ).length;
  const nexusContributionBonus = round3(
    clamp(balancedContributors * 0.035 + Math.min(pooledPresets.length, 8) * 0.008, 0, 0.12),
  );

  const rawH =
    meanBalance * 0.45 +
    fourFloatsCoverage * 0.25 +
    polarityComplementarity * 0.15 +
    sevenRayCoverage * 0.15 +
    nexusContributionBonus;
  const hSystem = round3(clamp(rawH, 0, 1));

  return {
    memberCount: members.length,
    meanBalance,
    fourFloatsCoverage,
    polarityComplementarity,
    sevenRayCoverage,
    nexusContributionBonus,
    hSystem,
    isSocialMemoryComplex: members.length >= 2 && hSystem >= 0.95,
    pooledPresets,
  };
}

// =====================================================================================================================
// 4. The Chronos Loop — "Morning SitRep", Heuristic Bounty & 30s Ghost Replay
// =====================================================================================================================

export interface DreamLessonBounty {
  /** 1..7 ray index tested/rebalanced overnight. */
  readonly rayIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly rayColour: string;
  readonly antidoteName: string;
  /** Temporary readiness boost (`+0.05` = `+5%`). */
  readonly readinessBoost: 0.05;
  readonly expiresAtTick: number;
}

export interface MorningSitRep {
  readonly schema: 'hm2:morning-sitrep:v1';
  readonly tick: number;
  readonly headline: string;
  readonly droneWakeLine: string;
  readonly autonomousSummary: readonly string[];
  readonly repairsCount: number;
  readonly closedCausesCount: number;
  readonly bounty: DreamLessonBounty;
  /** 30s deterministic Holodeck Ghost Replay manifest (`hm2:clip:v1`). */
  readonly ghostReplayManifest: ClipManifest;
  /** Compact `clip:` share code for one-click Holodeck preview. */
  readonly ghostReplayShareCode: string;
}

const RAY_COLOURS = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'] as const;
const DEFAULT_ANTIDOTES = [
  'Abundance & Trust',
  'Flow & Acceptance',
  'Surrender & Shared Power',
  'Unconditional Open Heart',
  'Candid Sovereign Expression',
  'Clear Harmonic Sight',
  'Unified Stewardship',
] as const;

/**
 * Pairs a session-open W3 Dream pass (`DreamDigest`) with a **Morning SitRep** card for the System HUD:
 * - Summarizes autonomous world/companion activity and dream repairs since the last session,
 * - Grants a temporary **Dream Lesson Bounty** (`+5%` ray readiness on the ray tested overnight),
 * - Builds a deterministic **30s Ghost Replay** (`hm2:clip:v1` / `clip:`) to preview the top episode in the Holodeck.
 */
export function buildMorningSitRep(input: {
  readonly digest: DreamDigest;
  readonly tick: number;
  readonly worldSeed: string;
  readonly stage: StageId;
  readonly authorId?: string;
  readonly autonomousEvents?: readonly string[];
  readonly featuredPresets?: readonly string[];
}): MorningSitRep {
  const safeTick = Math.max(0, Math.round(input.tick));
  const { digest } = input;

  // Determine the primary ray tested or balanced overnight
  let rayIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 4; // default Heart Ray
  let antidoteName: string = DEFAULT_ANTIDOTES[3]!;
  if (digest.balanced.length > 0) {
    const firstBal = digest.balanced[0]!;
    rayIndex = SQ_DISTORTION_CATALOG[firstBal.d].rayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    antidoteName = firstBal.antidote;
  } else if (digest.replayed.length > 0 && digest.replayed[0]!.d !== ALIGNED) {
    const d = digest.replayed[0]!.d as SqId;
    rayIndex = SQ_DISTORTION_CATALOG[d].rayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    antidoteName = SQ_DISTORTION_CATALOG[d].antidoteName;
  }

  const bounty: DreamLessonBounty = {
    rayIndex,
    rayColour: RAY_COLOURS[rayIndex - 1]!,
    antidoteName,
    readinessBoost: 0.05,
    expiresAtTick: safeTick + 3600,
  };

  const topEpisode = digest.replayed[0];
  const replayFrames =
    digest.replayed.length > 0
      ? digest.replayed.map((ep, idx) => `${ep.t + idx * 5}:${ep.cat}:${ep.d}`)
      : [`${safeTick}:MORNING_CALIBRATION:aligned`];

  const featuredPresets = [
    ...new Set([
      ...(input.featuredPresets ?? []),
      ...digest.replayed.map((r) => r.of),
      ...digest.balanced.map((b) => b.of),
    ]),
  ].slice(0, 8);

  const ghostReplayManifest = createClipManifest({
    clipId: `sitrep-ghost-${safeTick}`,
    authorId: input.authorId ?? 'overwatch-chronos',
    worldSeed: input.worldSeed,
    stage: input.stage,
    trigger: digest.closed.length > 0 ? 'eureka' : 'manual',
    durationSec: 30,
    videoMime: 'video/webm;codecs=vp9',
    featuredPresets,
    replayFrames,
    caption: topEpisode
      ? `30s Holodeck Ghost Replay: ${topEpisode.cat} (${antidoteName})`
      : '30s Holodeck Ghost Replay: Quiet Watch',
  });

  const ghostReplayShareCode = encodeClipShareCode(ghostReplayManifest);
  const autonomousSummary =
    input.autonomousEvents && input.autonomousEvents.length > 0
      ? [...input.autonomousEvents]
      : [
          `Replayed ${digest.replayed.length} episode(s) across the offline Chronos window.`,
          `Balanced ${digest.balanced.length} ray charge(s) and closed ${digest.closed.length} cause link(s).`,
        ];

  const headline =
    digest.closed.length > 0
      ? `Morning SitRep // Eureka Closed (${digest.closed.length} link) · +5% ${bounty.rayColour} Ray Bounty`
      : digest.balanced.length > 0
        ? `Morning SitRep // ${digest.balanced.length} Repair(s) Settled · +5% ${bounty.rayColour} Ray Bounty`
        : `Morning SitRep // Quiet Orbit · +5% ${bounty.rayColour} Ray Bounty`;

  return {
    schema: 'hm2:morning-sitrep:v1',
    tick: safeTick,
    headline,
    droneWakeLine: wakeLine(digest),
    autonomousSummary,
    repairsCount: digest.balanced.length,
    closedCausesCount: digest.closed.length,
    bounty,
    ghostReplayManifest,
    ghostReplayShareCode,
  };
}
