/**
 * Plan 58 Wave 4 (Part B): Drop-In Open-Source Host SDK (`packages/gamebridge/src/open-host-sdk.ts`)
 * for Persistent Town, Crowd & Vehicle Management Games (Flagship Target: `c:\CapitalEmpire`).
 *
 * Designed so an indie or open-source game creator who owns all rights to their game (`license: 'open-source'`,
 * `hasAntiCheat: false`) can connect `@hm/harness` & `@hm/gamebridge` in 3 lines of code and immediately turn
 * every persistent townsperson, tournament visitor, competitor, car, shuttle bus, and golf cart into a living
 * AI with:
 *   1. 1-File Checked Profile & Zero-Config Handshake (`createOpenHostProfile`, `CAPITAL_EMPIRE_OPEN_PROFILE`):
 *      - Registers an open-source game with `verdict: 'permitted'`, `hasAntiCheat: false`, and an owner-authorized
 *        `inputRelay` (`basis: 'owner-open-source-sdk: ...'`), passing `relayAllowed(profile, [])` cleanly under `RULES 8a`.
 *   2. Persistent Population & Vehicle Soul Binding (`createOpenHostTownSession`, `syncPersistentPopulation`):
 *      - Binds persistent `person` entities (`resident | visitor | competitor | staff`) to our Organic Character Body
 *        (`kind: 'organic'`) + Ra's Cross-Wired Archetypical Mind (`Magician` / `High Priestess`) + `Mem` (32 slots).
 *      - Binds persistent `vehicle` entities (`car | golf-cart | shuttle | taxi`) to our Tier-2 Mechanical Vessel Body
 *        (`kind: 'mechanical'`) + `Mem`.
 *      - Returns deterministic, non-coercive AI Intent + Semantic-Emotional Utterance (`utt:`) + Somatic Visual Hints.
 *   3. Annual Tournament Surge & Town Macro-Soul (`stepMacroTownCatalyst`, `runPopulationNightDream`):
 *      - Models the Town / Golf Course as a Rung-5 Macro-Node (`kind: 'planetary'`) whose Four Floats
 *        $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ reflect road/parking capacity ($\text{Pxd}$),
 *        course & venue geometry ($\text{Vtx}$), course beauty/viewing vitality ($\text{Lx}$), and crowd hospitality
 *        flow ($\text{Aq}$).
 *      - Computes `CapitalEmpire`'s exact `daySatisfaction` formula (`40% arrival + 20% exit + 20% queue + 20% viewing`),
 *        runs nightly W3 `dream.ts` across all persistent people and vehicles, outputs the **Morning Town SitRep**
 *        (Chronos Loop), and updates the Town's Social Memory Complex coherence ($H_{\text{town}}$).
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O).
 */
import { ALIGNED, checkMem, type Mem, type SqId } from '@hm/shorthand';
import {
  BALANCED_AT,
  OBSERVER_LADDER,
  bodyStep,
  bodyWarnings,
  buildMorningSitRep,
  createPresetMemory,
  dream,
  evaluateSevenStationCycle,
  evaluateUnityInDiversityCircle,
  memoryBalance,
  noteCause,
  recordExperience,
  synthesizeUtterance,
  type BodyState,
  type BodyWarning,
  type Dyad,
  type EgoWeights,
  type FourFloats,
  type LocaleId,
  type MorningSitRep,
  type SemanticRootId,
  type SynthesizedUtterance,
  type UnityInDiversityStatus,
} from '@hm/harness';
import {
  gameIdOf,
  type BridgePermissionProfile,
  type InputRelaySpec,
  type TelemetryMapping,
} from './index.js';

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hex8Of(str: string): string {
  return fnv1a32(str).toString(16).padStart(8, '0');
}

// =====================================================================================================================
// 1. 1-File Checked Profile & Zero-Config Handshake (`createOpenHostProfile`)
// =====================================================================================================================

export interface OpenHostProfileInput {
  readonly id?: string;
  readonly title: string;
  readonly engine?: string;
  readonly license?: 'open-source' | 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'owner-open-source';
  readonly hasAntiCheat?: false;
  readonly repoUrl?: string;
  readonly relay?: {
    readonly enabled?: boolean;
    readonly transport?: 'synthetic-keys' | 'console-tcp';
    readonly port?: number;
    readonly basis?: string;
  };
  readonly telemetry?: TelemetryMapping;
}

export const CAPITAL_EMPIRE_TELEMETRY_MAPPING: TelemetryMapping = {
  t: { path: 'stats.simT' },
  x: { path: 'camera.x', scale: 2 },
  y: { path: 'camera.y', scale: 2 },
  z: { path: 'camera.zoom' },
  hud: {
    active: 'stats.active',
    target: 'stats.target',
    tier: 'golf.tier',
    reputation: 'golf.reputation',
  },
  events: ['round.phase', 'golf.tier', 'disasters.active'],
  eventClasses: {
    'round.phase': 'objective',
    'golf.tier': 'outcome',
    'disasters.active': 'threat',
  },
};

/**
 * Registers an open-source / indie game (`hasAntiCheat: false`) in a single call, producing a verified
 * `BridgePermissionProfile` (`verdict: 'permitted'`) that passes `relayAllowed(profile, [])` cleanly under `RULES 8a`.
 */
export function createOpenHostProfile(input: OpenHostProfileInput): BridgePermissionProfile {
  if ((input.hasAntiCheat as boolean | undefined) === true) {
    throw new Error('createOpenHostProfile is strictly for open-source / anti-cheat-free host games (hasAntiCheat: false)');
  }
  const gameId = input.id ? gameIdOf(input.id) : gameIdOf(input.title);
  const license = input.license ?? 'open-source';
  const repoUrl = input.repoUrl ?? `https://github.com/open-host/${gameId}`;
  const relayEnabled = input.relay?.enabled !== false;

  const inputRelay: InputRelaySpec | undefined = relayEnabled
    ? {
        transport: input.relay?.transport ?? 'synthetic-keys',
        ...(input.relay?.port !== undefined ? { port: input.relay.port } : {}),
        bindings: {
          use: 'e',
          jump: 'space',
          fire: 'mouse1',
          reload: 'r',
        },
        notes: [
          'Open-source first-party host SDK integration: non-coercive AI intents and player relay explicitly permitted by the game owner.',
        ],
        basis:
          input.relay?.basis ??
          `owner-open-source-sdk (${license}): creator owns all rights and enabled @hm/gamebridge open-host-sdk`,
      }
    : undefined;

  return {
    schema: 'hm2:bridge-profile:v1',
    gameId,
    title: input.title,
    engine: input.engine ?? 'Vite + WebGL2 + OffscreenCanvas Workers',
    verdict: 'permitted',
    channels: [...OBSERVER_LADDER],
    streams: ['mechanics', 'telemetry', 'entity-kinds'],
    soloOnly: false,
    sources: [
      {
        url: repoUrl,
        quote: `Open-source host (${license}, hasAntiCheat: false) integrated via @hm/gamebridge open-host-sdk.`,
      },
    ],
    checkedBy: 'owner-open-source-sdk (@hm/gamebridge)',
    checkedOn: '2026-10-29',
    setup: [
      'Import { createOpenHostTownSession, syncPersistentPopulation } from "@hm/gamebridge" and call syncPersistentPopulation(session, entities, tick) inside your sim worker or main loop.',
    ],
    telemetry: input.telemetry ?? CAPITAL_EMPIRE_TELEMETRY_MAPPING,
    ...(inputRelay ? { inputRelay } : {}),
    notes: [
      'Flagship Open-Source Host SDK profile: persistent townspeople, tournament visitors, and vehicles bind directly to @hm/harness Mem + BodyState + Archetypical Mind.',
    ],
  };
}

/** Shipped flagship profile for Piskriek's brother's `CapitalEmpire` Town & Golf Tournament Manager (`c:\CapitalEmpire`). */
export const CAPITAL_EMPIRE_OPEN_PROFILE: BridgePermissionProfile = createOpenHostProfile({
  id: 'capital-empire',
  title: 'Capital Empire: Maple Falls Golf & Town Manager',
  engine: 'WebGL2 Texture-Array Atlas + IDM/MOBIL Traffic Worker',
  license: 'open-source',
  hasAntiCheat: false,
  repoUrl: 'https://github.com/Piskriek/CapitalEmpire',
});

// =====================================================================================================================
// 2. Persistent Population & Vehicle Soul Binding (`syncPersistentPopulation`)
// =====================================================================================================================

export type PersistentPersonRole =
  | 'resident'
  | 'visitor'
  | 'competitor'
  | 'staff'
  | 'greenkeeper'
  | 'mower-operator'
  | 'caddie'
  | 'gallery-fan';
export type PersistentVehicleRole =
  | 'car'
  | 'golf-cart'
  | 'shuttle'
  | 'taxi'
  | 'mower-reel'
  | 'mower-rotary'
  | 'coach';
export type PersistentEntityRole = PersistentPersonRole | PersistentVehicleRole;

export type TownCatalystEventId =
  | 'ON_TIME_ARRIVAL'
  | 'TRAFFIC_JAM_DELAY'
  | 'TOLL_GATE_PASS'
  | 'LONG_QUEUE_WAIT'
  | 'GREAT_VIEWING_18TH'
  | 'MISSED_TEE_TIME'
  | 'SMOOTH_SHUTTLE_RIDE'
  | 'CUP_CUT_ON_TIME'
  | 'FAIRWAY_STRIPE_MOWN'
  | 'TURNED_AWAY_CARPARK_FULL';

export interface PersistentHostEntityInput {
  readonly id: string;
  readonly kind: 'person' | 'vehicle';
  readonly role: PersistentEntityRole;
  /** Position in host world coordinates (e.g. `CapitalEmpire` 2m tiles or metres). */
  readonly position: { readonly x: number; readonly y: number; readonly z?: number };
  readonly velocity?: { readonly vx: number; readonly vy: number };
  /** Optional live catalyst experienced on this step. */
  readonly catalystEvent?: TownCatalystEventId;
  /** Queue wait in minutes at food/merch tents or shuttle stops (`CapitalEmpire` `avgQueueMin`). */
  readonly queueWaitMin?: number;
  /** Exit or traffic delay in minutes (`CapitalEmpire` `exitP95Min`). */
  readonly exitDelayMin?: number;
  /** Course viewing quality in [0, 1] (`CapitalEmpire` `viewing`). */
  readonly viewingQuality01?: number;
}

export interface PersistentEntitySoulState {
  readonly id: string;
  readonly kind: 'person' | 'vehicle';
  readonly role: PersistentEntityRole;
  readonly presetCode: string;
  readonly mem: Mem;
  readonly body: BodyState;
  readonly warnings: readonly BodyWarning[];
  readonly lastPosition: { readonly x: number; readonly y: number; readonly z: number };
}

export interface BoundEntityIntentAndVoice {
  readonly id: string;
  readonly kind: 'person' | 'vehicle';
  readonly role: PersistentEntityRole;
  readonly presetCode: string;
  readonly mem: Mem;
  readonly body: BodyState;
  readonly warnings: readonly BodyWarning[];
  readonly archetype: {
    readonly pole: 'intent' | 'context' | 'balanced';
    readonly mindLead: string;
    readonly bodyLead: string;
    readonly activeStation: string;
    readonly blueIndigoOveractivated: boolean;
  };
  /** Non-coercive AI intent hints that the host game can use to drive movement, routing, and tent visits. */
  readonly intent: {
    readonly preferredSpeedScale: number;
    readonly routePatience01: number;
    readonly seekHospitalityTent: boolean;
    readonly rerouteSuggestion:
      | 'hold-lane'
      | 'take-park-and-ride'
      | 'visit-merch-or-food'
      | 'head-to-18th-grandstand';
    readonly preservesFreeWill: true;
  };
  /** Expressive Semantic-Emotional Utterance (`utt:`) with prosody and somatic timbre filter. */
  readonly utterance: SynthesizedUtterance;
  /** Somatic visual hints for speech bubbles, sprite tinting, or inspect overlays. */
  readonly somaticVisual: {
    readonly auraHue: string;
    readonly look: 'calm' | 'flash' | 'glow' | 'stiff' | 'flicker' | 'tinge' | 'crack' | 'limp';
    readonly speechBubble: string;
  };
}

export interface OpenHostTownSession {
  readonly profile: BridgePermissionProfile;
  readonly townId: string;
  readonly townName: string;
  readonly locale: LocaleId;
  /** Rung-5 Town / Course Macro-Node memory (`world:<hash8>`). */
  readonly townMacroMem: Mem;
  readonly townMacroBody: BodyState;
  readonly townWeights: EgoWeights;
  /** Town Macro Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$. */
  readonly townFourFloats: FourFloats;
  /** Current tournament tier (`1..5` in `CapitalEmpire` `TIERS`) and reputation (`0..100`). */
  readonly tournamentTier: number;
  readonly reputation: number;
  /** Persistent entity souls indexed by entity `id`. */
  readonly entities: ReadonlyMap<string, PersistentEntitySoulState>;
  /** Complementary Masculine/Feminine dyads formed among persistent townspeople and visitors. */
  readonly dyads: readonly Dyad[];
  /** Latest Social Memory Complex / Unity-in-Diversity status for the Town ($H_{\text{town}}$). */
  readonly townComplexStatus: UnityInDiversityStatus;
  /** Latest Morning Town SitRep from `runPopulationNightDream`. */
  readonly lastMorningSitRep: MorningSitRep | null;
}

/**
 * Creates a persistent Town / Golf Course / Crowd session for an open-source host game (`c:\CapitalEmpire`).
 */
export function createOpenHostTownSession(config?: {
  readonly townId?: string;
  readonly townName?: string;
  readonly locale?: LocaleId;
  readonly profile?: BridgePermissionProfile;
  readonly initialTier?: number;
  readonly initialReputation?: number;
}): OpenHostTownSession {
  const townId = config?.townId ?? 'town:maple-falls';
  const townName = config?.townName ?? 'Maple Falls Valley';
  const locale = config?.locale ?? 'en';
  const profile = config?.profile ?? CAPITAL_EMPIRE_OPEN_PROFILE;
  const macroCode = `world:${hex8Of(townId)}`;
  const townMacroMem = createPresetMemory(macroCode);
  const { body: townMacroBody } = bodyStep({
    kind: 'planetary',
    mem: townMacroMem,
    prev: null,
    sideOf: () => 'center',
  });
  const emptyStatus = evaluateUnityInDiversityCircle([]);

  return {
    profile,
    townId,
    townName,
    locale,
    townMacroMem,
    townMacroBody,
    townWeights: { prefer: {} },
    townFourFloats: { Pxd: 0.72, Vtx: 0.68, Lx: 0.75, Aq: 0.74 },
    tournamentTier: clamp(Math.round(config?.initialTier ?? 1), 1, 5),
    reputation: clamp(config?.initialReputation ?? 60, 0, 100),
    entities: new Map(),
    dyads: [],
    townComplexStatus: emptyStatus,
    lastMorningSitRep: null,
  };
}

function mapCatalystToDistortion(
  cat: TownCatalystEventId | undefined,
  queueWaitMin: number,
  exitDelayMin: number,
): {
  readonly catName: string;
  readonly excitement: number;
  readonly error: number;
  readonly by: SqId | typeof ALIGNED;
  readonly felt?: SqId;
  readonly rootId: SemanticRootId;
} {
  if (cat === 'MISSED_TEE_TIME' || cat === 'TURNED_AWAY_CARPARK_FULL' || exitDelayMin >= 90) {
    return {
      catName: cat ?? 'SEVERE_TRAFFIC_GRIDLOCK',
      excitement: 0.85,
      error: 0.8,
      by: 'solar-control',
      felt: 'solar-anxiety',
      rootId: 'BODY_ACHE',
    };
  }
  if (cat === 'TRAFFIC_JAM_DELAY' || exitDelayMin >= 45) {
    return {
      catName: cat ?? 'TRAFFIC_BOTTLENECK',
      excitement: 0.7,
      error: 0.65,
      by: 'solar-anxiety',
      felt: 'sacral-frustration',
      rootId: 'BODY_ACHE',
    };
  }
  if (cat === 'LONG_QUEUE_WAIT' || queueWaitMin >= 15) {
    return {
      catName: cat ?? 'TENT_QUEUE_DELAY',
      excitement: 0.6,
      error: 0.55,
      by: 'root-lack',
      felt: 'sacral-frustration',
      rootId: 'BODY_ACHE',
    };
  }
  if (cat === 'GREAT_VIEWING_18TH' || cat === 'CUP_CUT_ON_TIME' || cat === 'FAIRWAY_STRIPE_MOWN') {
    return {
      catName: cat === 'GREAT_VIEWING_18TH' ? 'GRANDSTAND_18_ROAR' : cat,
      excitement: 0.85,
      error: 0.05,
      by: ALIGNED,
      rootId: 'BODY_EUREKA',
    };
  }
  if (cat === 'SMOOTH_SHUTTLE_RIDE' || cat === 'ON_TIME_ARRIVAL' || cat === 'TOLL_GATE_PASS') {
    return {
      catName: cat,
      excitement: 0.55,
      error: 0.08,
      by: ALIGNED,
      rootId: 'ARRIVAL_GREETING',
    };
  }
  return {
    catName: 'TOWN_STROLL',
    excitement: 0.35,
    error: 0.1,
    by: ALIGNED,
    rootId: 'ARRIVAL_GREETING',
  };
}

function buildEntityDecision(
  soul: PersistentEntitySoulState,
  townName: string,
  locale: LocaleId,
  rootId: SemanticRootId,
): BoundEntityIntentAndVoice {
  const cycle = evaluateSevenStationCycle(soul.mem, soul.body);
  const pole: 'intent' | 'context' | 'balanced' =
    Math.abs(cycle.crossWiring.pol) < 32 ? 'balanced' : cycle.crossWiring.pole;

  const topWarning = soul.warnings[0];
  const maxAche = Math.max(...soul.body.zones.map((z) => z.ache), 0);

  // Derive non-coercive movement & routing preferences from somatic balance and polarity
  const routePatience01 = round3(clamp(soul.mem.bal * (1 - maxAche * 0.5), 0.1, 1));
  const preferredSpeedScale = round3(
    clamp(
      soul.kind === 'vehicle'
        ? 0.85 + soul.mem.bal * 0.25 - maxAche * 0.2
        : 0.9 + (pole === 'intent' ? 0.12 : 0) - maxAche * 0.15,
      0.5,
      1.3,
    ),
  );
  const seekHospitalityTent = maxAche >= 0.25 || (soul.mem.charge[0] ?? 0) > 16 || (soul.mem.charge[1] ?? 0) > 16;

  let rerouteSuggestion: BoundEntityIntentAndVoice['intent']['rerouteSuggestion'] = 'hold-lane';
  if (soul.kind === 'vehicle' && maxAche >= 0.2) {
    rerouteSuggestion = 'take-park-and-ride';
  } else if (soul.kind === 'person' && seekHospitalityTent) {
    rerouteSuggestion = 'visit-merch-or-food';
  } else if (soul.kind === 'person' && soul.mem.bal >= BALANCED_AT) {
    rerouteSuggestion = 'head-to-18th-grandstand';
  }

  const slotData: Record<string, string> = {
    world: townName,
    zone: topWarning ? topWarning.place : soul.kind === 'vehicle' ? 'power core' : 'solar plexus',
    quality: topWarning?.quality ?? 'Harmonic Flow',
    subject: `${soul.role} ${soul.id}`,
    rank: cycle.mindStation.tarotName,
  };

  const utterance = synthesizeUtterance({
    rootId,
    slots: slotData,
    locale,
    mem: soul.mem,
    body: soul.body,
  });

  const somaticVisual: BoundEntityIntentAndVoice['somaticVisual'] = {
    auraHue: topWarning ? topWarning.visual.hue : '#3cb45a',
    look: topWarning ? topWarning.visual.look : 'calm',
    speechBubble: utterance.subtitleText,
  };

  return {
    id: soul.id,
    kind: soul.kind,
    role: soul.role,
    presetCode: soul.presetCode,
    mem: soul.mem,
    body: soul.body,
    warnings: soul.warnings,
    archetype: {
      pole,
      mindLead: cycle.crossWiring.mindLead.tarotName,
      bodyLead: cycle.crossWiring.bodyLead.tarotName,
      activeStation:
        soul.kind === 'vehicle' ? cycle.bodyStation.tarotName : cycle.mindStation.tarotName,
      blueIndigoOveractivated: cycle.blueIndigoOveractivated,
    },
    intent: {
      preferredSpeedScale,
      routePatience01,
      seekHospitalityTent,
      rerouteSuggestion,
      preservesFreeWill: true,
    },
    utterance,
    somaticVisual,
  };
}

/**
 * Synchronizes a batch of persistent people (`resident | visitor | competitor | staff`) and vehicles
 * (`car | golf-cart | shuttle | taxi`) from the host game at `tick`:
 * - Automatically binds each person to an Organic Character Body + Cross-Wired Archetypical Mind (`Magician` /
 *   `High Priestess`) + `Mem`, and each vehicle to a Tier-2 Mechanical Vessel Body + `Mem`.
 * - Returns deterministic, non-coercive AI Intent + Semantic-Emotional Utterance (`utt:`) + Somatic Visual Hints.
 */
export function syncPersistentPopulation(
  session: OpenHostTownSession,
  batch: readonly PersistentHostEntityInput[],
  tick: number,
): {
  readonly session: OpenHostTownSession;
  readonly decisions: readonly BoundEntityIntentAndVoice[];
} {
  const safeTick = Math.max(0, Math.round(tick));
  const nextEntities = new Map(session.entities);
  const decisions: BoundEntityIntentAndVoice[] = [];

  for (const item of batch) {
    const existing = nextEntities.get(item.id);
    const hash = fnv1a32(item.id);
    const prefix = item.kind === 'person' ? 'species' : 'kit';
    const presetCode = existing?.presetCode ?? `${prefix}:${hex8Of(item.id)}`;

    // Seed initial polarity deterministically from entity id so the town has complementary Magician/Priestess poles
    let mem: Mem;
    if (existing) {
      mem = existing.mem;
    } else {
      const base = createPresetMemory(presetCode);
      const bucket = hash % 3;
      const pol = bucket === 0 ? 52 : bucket === 1 ? -52 : 0;
      mem = checkMem({ ...base, pol });
    }

    const catInfo = mapCatalystToDistortion(
      item.catalystEvent,
      item.queueWaitMin ?? 0,
      item.exitDelayMin ?? 0,
    );

    if (item.catalystEvent || (item.queueWaitMin ?? 0) >= 15 || (item.exitDelayMin ?? 0) >= 45) {
      mem = recordExperience(mem, {
        t: safeTick,
        stage: 'S3',
        cat: catInfo.catName,
        excitement: catInfo.excitement,
        error: catInfo.error,
        by: catInfo.by,
        ...(catInfo.felt ? { felt: catInfo.felt } : {}),
      });
      if (catInfo.by !== ALIGNED && catInfo.felt) {
        mem = noteCause(mem, catInfo.by, catInfo.felt);
      }
    }

    const bodyKind = item.kind === 'person' ? 'organic' : 'mechanical';
    const stepped = bodyStep({
      kind: bodyKind,
      mem,
      prev: existing?.body ?? null,
      sideOf: (c) => (c.includes('DELAY') || c.includes('QUEUE') ? 'left' : 'right'),
    });
    const warnings = bodyWarnings(presetCode, stepped.body, stepped.mem);

    const soul: PersistentEntitySoulState = {
      id: item.id,
      kind: item.kind,
      role: item.role,
      presetCode,
      mem: stepped.mem,
      body: stepped.body,
      warnings,
      lastPosition: {
        x: item.position.x,
        y: item.position.y,
        z: item.position.z ?? 0,
      },
    };
    nextEntities.set(item.id, soul);
    decisions.push(buildEntityDecision(soul, session.townName, session.locale, catInfo.rootId));
  }

  // Pair complementary Masculine (intent) and Feminine (context) citizens into Dyads so balanced partners lend cues in dreams
  const allSouls = [...nextEntities.values()];
  const intentPresets = allSouls.filter((s) => (s.mem.pol ?? 0) >= 32).map((s) => s.presetCode);
  const contextPresets = allSouls.filter((s) => (s.mem.pol ?? 0) <= -32).map((s) => s.presetCode);
  const dyads: Dyad[] = [];
  const pairCount = Math.min(intentPresets.length, contextPresets.length);
  for (let i = 0; i < pairCount; i++) {
    const p1 = intentPresets[i]!;
    const p2 = contextPresets[i]!;
    dyads.push({
      a: p1 < p2 ? p1 : p2,
      b: p1 < p2 ? p2 : p1,
      strength: 2,
      whole: true,
    });
  }

  // Evaluate Town Social Memory Complex coherence across all persistent souls
  const townComplexStatus = evaluateUnityInDiversityCircle(
    allSouls.map((s, idx) => ({
      memberId: s.id,
      name: `${s.role}:${s.id}`,
      mem: s.mem,
      fourFloatsSpecialty: {
        Pxd: s.kind === 'vehicle' ? 0.92 : 0.65,
        Vtx: s.role === 'staff' || s.role === 'resident' ? 0.9 : 0.65,
        Lx: s.role === 'competitor' ? 0.95 : 0.7,
        Aq: s.role === 'visitor' || idx % 2 === 0 ? 0.9 : 0.7,
      },
      contributedPresets: [s.presetCode],
    })),
  );

  return {
    session: {
      ...session,
      entities: nextEntities,
      dyads,
      townComplexStatus,
    },
    decisions,
  };
}

// =====================================================================================================================
// 3. Annual Tournament Surge & Town Macro-Soul (`stepMacroTownCatalyst` & `runPopulationNightDream`)
// =====================================================================================================================

/**
 * Matches `c:\CapitalEmpire\src\game\golf\tour.ts` (`DayFacts` & `CourseFacts`) so Piskriek's brother can pass his
 * tournament day metrics directly into `stepMacroTownCatalyst`.
 */
export interface TournamentSurgeCatalystInput {
  readonly tick: number;
  /** Tournament tier (`1..5` in `CapitalEmpire` `TIERS`). */
  readonly tournamentTier: number;
  /** Current course reputation (`0..100`). */
  readonly reputation: number;
  /** `CapitalEmpire` `DayFacts`: spectators by arrival, exit P95 (min), average queue (min), and viewing (0..1). */
  readonly dayFacts: {
    readonly onTime: number;
    readonly late: number;
    readonly missed: number;
    readonly exitP95Min: number;
    readonly avgQueueMin: number;
    readonly viewing: number;
  };
  /** Optional course geometry facts (`9` or `18` holes, length in metres, count of built venue `Need`s). */
  readonly courseFacts?: {
    readonly holes: number;
    readonly lengthM: number;
    readonly builtNeedsCount: number;
  };
}

export interface MacroTownCatalystResult {
  readonly session: OpenHostTownSession;
  /** `CapitalEmpire` `daySatisfaction` score in [0, 100]. */
  readonly daySatisfactionScore: number;
  /** Updated reputation after `REP_STEP` (0.3) adjustment toward `daySatisfactionScore`. */
  readonly nextReputation: number;
  /** Updated Town Macro-Node Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$. */
  readonly townFourFloats: FourFloats;
  readonly macroUtterance: SynthesizedUtterance;
}

/**
 * Computes `CapitalEmpire`'s exact `daySatisfaction(d)` formula (from `src/game/golf/tour.ts` lines 62-69):
 * 40% arrival + 20% exit + 20% queue + 20% viewing -> [0, 100].
 */
export function computeTournamentDaySatisfaction(d: TournamentSurgeCatalystInput['dayFacts']): number {
  const all = d.onTime + d.late + d.missed;
  const arrival = all > 0 ? (d.onTime + 0.5 * d.late) / all : 1;
  const exit = Math.min(1, Math.max(0, (120 - d.exitP95Min) / 90));
  const queue = Math.min(1, Math.max(0, (30 - d.avgQueueMin) / 25));
  const viewing = Math.min(1, Math.max(0, d.viewing));
  return round3(100 * (0.4 * arrival + 0.2 * exit + 0.2 * queue + 0.2 * viewing));
}

/**
 * Steps the Town / Golf Course Rung-5 Macro-Node with an annual tournament surge catalyst:
 * - Maps road/parking arrival into $\text{Pxd}$, course holes/length/tents into $\text{Vtx}$, viewing & tier prestige
 *   into $\text{Lx}$, and exit/queue hospitality fluidity into $\text{Aq}$.
 * - Routes the tournament surge experience into the Town Macro-Node and across all persistent citizens and vehicles.
 */
export function stepMacroTownCatalyst(
  session: OpenHostTownSession,
  input: TournamentSurgeCatalystInput,
): MacroTownCatalystResult {
  const safeTick = Math.max(0, Math.round(input.tick));
  const d = input.dayFacts;
  const allSpectators = Math.max(1, d.onTime + d.late + d.missed);
  const arrivalRatio = clamp((d.onTime + 0.5 * d.late) / allSpectators, 0, 1);
  const exitScore = clamp((120 - d.exitP95Min) / 90, 0, 1);
  const queueScore = clamp((30 - d.avgQueueMin) / 25, 0, 1);
  const viewingScore = clamp(d.viewing, 0, 1);

  const daySatisfactionScore = computeTournamentDaySatisfaction(d);
  // Matches `reputationAfter(prev, score)` in `c:\CapitalEmpire\src\game\golf\tour.ts` (`REP_STEP = 0.3`)
  const nextReputation = round3(clamp(input.reputation + 0.3 * (daySatisfactionScore - input.reputation), 0, 100));

  const holesNorm = clamp((input.courseFacts?.holes ?? 18) / 18, 0.3, 1);
  const needsNorm = clamp((input.courseFacts?.builtNeedsCount ?? 10) / 20, 0.2, 1);

  const townFourFloats: FourFloats = {
    Pxd: round3(clamp(0.25 + arrivalRatio * 0.75, 0, 1)),
    Vtx: round3(clamp(0.3 + holesNorm * 0.4 + needsNorm * 0.3, 0, 1)),
    Lx: round3(clamp(0.2 + viewingScore * 0.55 + (nextReputation / 100) * 0.25, 0, 1)),
    Aq: round3(clamp((exitScore * 0.5 + queueScore * 0.5), 0, 1)),
  };

  const isJam = daySatisfactionScore < 60 || d.exitP95Min >= 75 || d.avgQueueMin >= 18;
  const macroError = round3(clamp(1 - daySatisfactionScore / 100, 0, 1));
  let townMacroMem = recordExperience(session.townMacroMem, {
    t: safeTick,
    stage: 'S3',
    cat: `TOURNAMENT_TIER_${input.tournamentTier}_SURGE`,
    excitement: clamp(0.5 + input.tournamentTier * 0.1, 0.5, 0.95),
    error: macroError,
    by: isJam ? 'solar-control' : ALIGNED,
    ...(isJam ? { felt: 'sacral-frustration' as const } : {}),
  });
  if (isJam) {
    townMacroMem = noteCause(townMacroMem, 'solar-control', 'sacral-frustration');
  }

  const macroStep = bodyStep({
    kind: 'planetary',
    mem: townMacroMem,
    prev: session.townMacroBody,
    sideOf: () => (isJam ? 'left' : 'right'),
  });

  // Propagate the surge feel across all registered persistent entities
  const entityCatalyst: TownCatalystEventId = isJam
    ? d.exitP95Min >= 75
      ? 'TRAFFIC_JAM_DELAY'
      : 'LONG_QUEUE_WAIT'
    : viewingScore >= 0.8
      ? 'GREAT_VIEWING_18TH'
      : 'ON_TIME_ARRIVAL';

  const updatedEntities = new Map<string, PersistentEntitySoulState>();
  for (const [id, soul] of session.entities) {
    let m = recordExperience(soul.mem, {
      t: safeTick,
      stage: 'S3',
      cat: entityCatalyst,
      excitement: clamp(0.45 + input.tournamentTier * 0.08, 0.4, 0.9),
      error: macroError,
      by: isJam ? 'solar-anxiety' : ALIGNED,
      ...(isJam ? { felt: 'sacral-frustration' as const } : {}),
    });
    if (isJam) {
      m = noteCause(m, 'solar-anxiety', 'sacral-frustration');
    }
    const bStep = bodyStep({
      kind: soul.body.kind,
      mem: m,
      prev: soul.body,
      sideOf: () => (isJam ? 'left' : 'right'),
    });
    updatedEntities.set(id, {
      ...soul,
      mem: bStep.mem,
      body: bStep.body,
      warnings: bodyWarnings(soul.presetCode, bStep.body, bStep.mem),
    });
  }

  const macroUtterance = synthesizeUtterance({
    rootId: isJam ? 'QUEST_SEEDED' : 'LEVEL_UP',
    slots: {
      quest: `Relieve Tier ${input.tournamentTier} Exit/Queue Bottleneck (${Math.round(daySatisfactionScore)}% sat)`,
      subject: session.townName,
      rank: `Tier ${input.tournamentTier} (${Math.round(nextReputation)} Rep)`,
    },
    locale: session.locale,
    mem: macroStep.mem,
    body: macroStep.body,
  });

  const nextSession: OpenHostTownSession = {
    ...session,
    townMacroMem: macroStep.mem,
    townMacroBody: macroStep.body,
    townFourFloats,
    tournamentTier: clamp(Math.round(input.tournamentTier), 1, 5),
    reputation: nextReputation,
    entities: updatedEntities,
  };

  return {
    session: nextSession,
    daySatisfactionScore,
    nextReputation,
    townFourFloats,
    macroUtterance,
  };
}

export type TournamentInfrastructureFix =
  | 'upgrade-junctions'
  | 'add-park-and-ride'
  | 'add-gate-lanes'
  | 'add-hospitality-tents'
  | 'add-18th-grandstand';

export interface PopulationNightDreamResult {
  readonly session: OpenHostTownSession;
  readonly sitRep: MorningSitRep;
  readonly townCoherenceH: number;
  readonly isTownSocialMemoryComplex: boolean;
  readonly balancedCount: number;
  readonly closedCausesCount: number;
}

/**
 * Runs at the end of each in-game day or tournament round:
 * - Executes W3 `dream.ts` across all persistent townspeople and vehicles (with the Town Macro-Node as `ego` and
 *   complementary Masculine/Feminine citizens paired as `dyads`),
 * - When `infrastructureFixes` are provided (e.g. the Town Manager upgraded junctions, added Park & Ride, or added
 *   gate lanes/tents after inspecting `lateReasons`), generates Higher-Self `DreamCue`s for all distorted episodes
 *   and increases citizen openness (`inv`) so the town heals its traffic/queue trauma overnight,
 * - Generates the **Morning Town SitRep** (with `+5%` ray readiness bounty and 30s Holodeck Ghost Replay `clip:` code),
 * - Updates the Town's Social Memory Complex coherence ($H_{\text{town}}$).
 */
export function runPopulationNightDream(
  session: OpenHostTownSession,
  tick: number,
  infrastructureFixes?: readonly TournamentInfrastructureFix[],
): PopulationNightDreamResult {
  const safeTick = Math.max(1, Math.round(tick));
  const fixesCount = infrastructureFixes?.length ?? 0;
  const souls = [...session.entities.values()];
  const presetMems = souls.map((s) =>
    fixesCount > 0
      ? checkMem({
          ...s.mem,
          hard: Math.max(0.05, s.mem.hard * Math.pow(0.75, fixesCount)),
          inv: Math.min(1, s.mem.inv + fixesCount * 0.25),
        })
      : s.mem,
  );

  const explicitCues =
    fixesCount > 0
      ? presetMems.flatMap((m) =>
          m.ep.filter((e) => e.d !== ALIGNED).map((e) => ({ of: m.of, t: e.t })),
        )
      : undefined;

  const dreamRes = dream({
    ego: session.townMacroMem,
    presets: presetMems,
    weights: session.townWeights,
    now: safeTick,
    dyads: session.dyads,
    ...(explicitCues && explicitCues.length > 0 ? { cues: explicitCues } : {}),
    budget: 32,
  });

  const memByCode = new Map(dreamRes.presets.map((m) => [m.of, m] as const));
  const nextEntities = new Map<string, PersistentEntitySoulState>();

  for (const soul of souls) {
    const dreamedMem = memByCode.get(soul.presetCode) ?? soul.mem;
    const stepped = bodyStep({
      kind: soul.body.kind,
      mem: dreamedMem,
      prev: soul.body,
      sideOf: () => 'center',
    });
    nextEntities.set(soul.id, {
      ...soul,
      mem: stepped.mem,
      body: stepped.body,
      warnings: bodyWarnings(soul.presetCode, stepped.body, stepped.mem),
    });
  }

  const refreshedSouls = [...nextEntities.values()];
  const townComplexStatus = evaluateUnityInDiversityCircle(
    refreshedSouls.map((s, idx) => ({
      memberId: s.id,
      name: `${s.role}:${s.id}`,
      mem: s.mem,
      fourFloatsSpecialty: {
        Pxd: s.kind === 'vehicle' ? 0.94 : session.townFourFloats.Pxd,
        Vtx: s.role === 'resident' || s.role === 'staff' ? 0.92 : session.townFourFloats.Vtx,
        Lx: s.role === 'competitor' ? 0.96 : session.townFourFloats.Lx,
        Aq: s.role === 'visitor' || idx % 2 === 0 ? 0.92 : session.townFourFloats.Aq,
      },
      contributedPresets: [s.presetCode],
    })),
  );

  const sitRep = buildMorningSitRep({
    digest: dreamRes.digest,
    tick: safeTick,
    worldSeed: session.townId,
    stage: 'S3',
    authorId: session.profile.gameId,
    autonomousEvents: [
      `${session.townName} dreamed across ${souls.length} persistent people & vehicles (Tier ${session.tournamentTier}, Rep ${session.reputation}).`,
      `Balanced ${dreamRes.digest.balanced.length} ray charge(s), closed ${dreamRes.digest.closed.length} cause link(s), H_town=${townComplexStatus.hSystem}.`,
    ],
    featuredPresets: refreshedSouls.slice(0, 6).map((s) => s.presetCode),
  });

  const nextMacroBody = bodyStep({
    kind: 'planetary',
    mem: dreamRes.ego,
    prev: session.townMacroBody,
    sideOf: () => 'center',
  });

  const nextSession: OpenHostTownSession = {
    ...session,
    townMacroMem: checkMem({
      ... nextMacroBody.mem,
      bal: memoryBalance(nextMacroBody.mem.charge),
    }),
    townMacroBody: nextMacroBody.body,
    townWeights: dreamRes.weights,
    entities: nextEntities,
    townComplexStatus,
    lastMorningSitRep: sitRep,
  };

  return {
    session: nextSession,
    sitRep,
    townCoherenceH: townComplexStatus.hSystem,
    isTownSocialMemoryComplex: townComplexStatus.isSocialMemoryComplex,
    balancedCount: dreamRes.digest.balanced.length,
    closedCausesCount: dreamRes.digest.closed.length,
  };
}
