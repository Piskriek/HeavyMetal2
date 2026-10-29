/**
 * Plan 57 §19 & Plan 56 W6e: The Rung-6 Wanderer Meta-Shell (owner & Argon, 29 Oct).
 *
 * Sits one layer ABOVE the Rung-5 diegetic "LitRPG System" layer, serving the player from the player's own POV:
 * 1. Player as Wanderer Anchor (Plan 56 W6e, Law of One 65.12, 66.8): the player's character is a Wanderer
 *    (`wan.from = 'player'`). Steady, intentional play keeps the player's anchor memory balanced (`bal >= 0.9`),
 *    lending `ANCHOR_CALM` (0.3) to the Overwatch Drone and party companions at each catalyst; panic-spraying or
 *    erratic thrashing charges `solar-anxiety` / `root-reactivity` and calms no one until steadied.
 * 2. Party (Dyad/Triad Working Group) & Guild (Social Memory Complex):
 *    - Party (2–6 members + companions): shares `anchorCalm` (up to 0.6) and `harmoniousDoubling` ($2^{N-1}$ working
 *      power when members are balanced with open Heart Ray >= 4).
 *    - Guild (Order / Social Memory Complex): when guild members reach collective coherence >= 0.95, their presets
 *      pool into a shared Guild Shelf where closed cause links (`open === false`) and eurekas ripple across the guild.
 * 3. Tiered Comms & Cartridge Messaging (`createCommsMessage`):
 *    - Enforces Plan 57 §9 Child Safety: unverified/child accounts communicate strictly via grounded preset cartridges
 *      and structured callouts (`preset-only`), never raw free text; verified party/guild accounts can include text
 *      alongside embedded preset share codes (`kit:`, `matc:`, `loc:`, `logic:`, `ui:`, `plot:`).
 * 4. Video Clip, Stream & Deterministic Shorthand Replay (`createClipManifest`, `encodeClipShareCode`):
 *    - Inspired by Noita's built-in GIF recorder and Content Warning's in-game camera: pairs a zero-bloat browser
 *      `canvas.captureStream` / `MediaRecorder` clip descriptor with a compact deterministic replay & preset manifest
 *      so anyone viewing a shared video or message can one-click preview or step into the exact contraption/moment.
 * 5. Harness & Bridge Meta-Settings (`validateHarnessSettings`):
 *    - Pure configuration for the Rung-6 Harness Control Deck (Bridge mode: `off | mirror-only | checked-relay`,
 *      Higher Self seat, child-safe filter, and auto-clip on Eureka / Contraption forged).
 *
 * 100% pure and deterministic: no Date.now, no Math.random, no I/O.
 */
import { ALIGNED, checkMem, type Mem, type StageId } from '@hm/shorthand';
import { BALANCED_AT, createPresetMemory, memoryBalance, recordExperience } from './preset-memory.js';
import { ANCHOR_CALM, anchorCalm, isAnchor } from './lifecycle.js';
import { compileSystemMemory, type SystemMemoryPack } from './system-memory.js';
import { harmoniousDoubling } from './science-cosmos.js';
import { evaluateUnityInDiversityCircle, type FourFloats, type UnityInDiversityStatus } from './logos-galaxy-chronos.js';

// ---------------------------------------------------------------------------------------------------------------------
// 1. Player as Wanderer Anchor (Plan 56 W6e)
// ---------------------------------------------------------------------------------------------------------------------

export const PLAYER_WANDERER_OF = 'species:00a1c405';
export const PLAYER_ORIGIN_OF = 'player';
export const GUILD_HARVEST_AT = 0.95;

export interface PlayerActionSample {
  readonly t: number;
  readonly stage: StageId;
  /** True when the player panic-sprayed, mashed inputs erratically, or forced an invalid action. */
  readonly panicSpray?: boolean;
  /** True when the player is in steady creative/tactical flow. */
  readonly creativeFlow?: boolean;
  /** 0..1: action execution error (<= 0.25 for steady play, >= 0.7 for panic thrashing). */
  readonly error?: number;
  readonly excitement?: number;
}

/**
 * Creates the player's Rung-6 Wanderer anchor memory (`wan.from = 'player'`, descended into the world).
 */
export function createPlayerWanderer(of = PLAYER_WANDERER_OF, limit = 0.85): Mem {
  if (!Number.isFinite(limit) || limit < 0 || limit > 1) throw new Error('limit must be 0..1');
  const base = createPresetMemory(of);
  return checkMem({
    ...base,
    hard: 0.8,
    wan: { from: PLAYER_ORIGIN_OF, done: 1, lim: limit },
  });
}

/**
 * Plan 56 W6e: Updates the player's Wanderer memory from their waking play cadence and returns the `calm` (0 or 0.3)
 * the player lends to the Drone and nearby companions.
 * - Steady play (`!panicSpray` and `error < 0.4`) eases any prior panic charge back toward rest and keeps `isAnchor(mem)` true.
 * - Panic-spraying records a `root-reactivity` / `solar-anxiety` spike, dropping `bal < 0.9` so the player calms no one (Ra 66.8).
 */
export function stepPlayerWanderer(
  playerMem: Mem,
  sample: PlayerActionSample,
): { readonly mem: Mem; readonly calm: number; readonly steady: boolean; readonly warning: string | null } {
  checkMem(playerMem);
  const panic = Boolean(sample.panicSpray) || (sample.error ?? 0) >= 0.65;
  const ex = Math.max(0, Math.min(1, sample.excitement ?? (panic ? 0.9 : sample.creativeFlow ? 0.65 : 0.4)));
  const err = Math.max(0, Math.min(1, sample.error ?? (panic ? 0.85 : 0.1)));

  if (panic) {
    // Panic-spraying charges Ray 1 (root-reactivity) and Ray 3 (solar-anxiety) so balance drops below BALANCED_AT (0.9)
    let next = recordExperience(playerMem, {
      t: sample.t,
      stage: sample.stage,
      cat: 'PLAYER_PANIC',
      excitement: Math.max(0.75, ex),
      error: err,
      by: 'solar-anxiety',
      felt: 'root-reactivity',
    });
    const r0 = Math.min(127, Math.max(24, next.charge[0] ?? 0));
    const charge = next.charge.map((c, i) => (i === 0 ? r0 : c));
    next = checkMem({ ...next, charge, bal: memoryBalance(charge) });
    return {
      mem: next,
      calm: anchorCalm([next]),
      steady: false,
      warning: 'Root-reactivity spike: steady your aim and breath to restore your Wanderer anchor.',
    };
  }

  // Steady, deliberate play eases any residual panic charge by up to 16 per steady window and records aligned flow
  const easedCharge = playerMem.charge.map((c) => (c > 0 ? Math.max(0, c - 16) : c < 0 ? Math.min(0, c + 16) : 0));
  const easedMem = checkMem({
    ...playerMem,
    bal: memoryBalance(easedCharge),
    charge: easedCharge,
  });
  const next = recordExperience(easedMem, {
    t: sample.t,
    stage: sample.stage,
    cat: 'PLAYER_STEADY',
    excitement: ex,
    error: err,
    by: ALIGNED,
  });
  const steady = next.bal >= BALANCED_AT && isAnchor(next);
  return {
    mem: next,
    calm: steady ? ANCHOR_CALM : 0,
    steady,
    warning: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Party (Working Group) & Guild (Social Memory Complex)
// ---------------------------------------------------------------------------------------------------------------------

export interface PartyMemberSummary {
  readonly id: string;
  readonly name: string;
  readonly mem: Mem;
  readonly stage: StageId;
  readonly worldGateCode: string;
  readonly fourFloatsSpecialty?: FourFloats;
  readonly contributedPresets?: readonly string[];
}

export interface PartyStatus {
  readonly members: readonly PartyMemberSummary[];
  /** Total calm (0..0.6) lent by balanced Wanderers in the party. */
  readonly sharedAnchorCalm: number;
  /** Harmonious minds count and Law of Doubling multiplier ($2^{N-1}$). */
  readonly harmoniousCount: number;
  readonly doublingMultiplier: number;
  readonly meanBalance: number;
  /** Plan 58 Wave 4: Complementary 7-Ray, Polarity & Four-Float Unity-in-Diversity resonance. */
  readonly unityInDiversity: UnityInDiversityStatus;
}

/**
 * Evaluates a co-op Party (2–6 Wanderers/companions), computing their shared `anchorCalm`, Law of Doubling
 * working multiplier, and Complementary Unity-in-Diversity resonance across $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$.
 */
export function evaluateParty(members: readonly PartyMemberSummary[]): PartyStatus {
  const mems = members.map((m) => checkMem(m.mem));
  const sharedAnchorCalm = anchorCalm(mems);
  const { harmoniousCount, multiplier } = harmoniousDoubling(mems);
  const meanBalance =
    mems.length > 0 ? Math.round((mems.reduce((s, m) => s + m.bal, 0) / mems.length) * 1000) / 1000 : 1;
  const unityInDiversity = evaluateUnityInDiversityCircle(
    members.map((m, idx) => ({
      memberId: m.id,
      name: m.name,
      mem: m.mem,
      fourFloatsSpecialty: m.fourFloatsSpecialty ?? {
        Pxd: idx % 4 === 0 ? 0.92 : 0.65,
        Vtx: idx % 4 === 1 ? 0.92 : 0.65,
        Lx: idx % 4 === 2 ? 0.92 : 0.65,
        Aq: idx % 4 === 3 ? 0.92 : 0.65,
      },
      ...(m.contributedPresets !== undefined ? { contributedPresets: m.contributedPresets } : {}),
    })),
  );
  return {
    members,
    sharedAnchorCalm,
    harmoniousCount,
    doublingMultiplier: multiplier,
    meanBalance,
    unityInDiversity,
  };
}

export interface GuildComplexStatus {
  readonly guildId: string;
  readonly guildName: string;
  readonly pack: SystemMemoryPack;
  readonly isSocialMemoryComplex: boolean;
  /** Shared preset cartridges (`<kind>:<hash8>`) available on the Guild Shelf. */
  readonly sharedShelfCodes: readonly string[];
  /** Closed cause links (`by>d`) pooled across the guild so every member benefits from each eureka. */
  readonly pooledClosedCauses: readonly string[];
  /** Plan 58 Wave 4: Complementary 7-Ray, Polarity & Four-Float Unity-in-Diversity resonance. */
  readonly unityInDiversity: UnityInDiversityStatus;
}

/**
 * Evaluates a Guild as a player-and-companion Social Memory Complex (Plan 57 §3 & §19).
 * When collective coherence >= 0.95 (or Unity-in-Diversity $H_{\text{system}} \ge 0.95$), the guild pools its memory
 * pack and shares closed cause links across all members.
 */
export function evaluateGuildComplex(input: {
  readonly guildId: string;
  readonly guildName: string;
  readonly memberPresets: readonly Mem[];
  readonly memberEgos: readonly { readonly ego: Mem; readonly presets: readonly string[]; readonly fourFloatsSpecialty?: FourFloats }[];
}): GuildComplexStatus {
  const egosWithWeights = input.memberEgos.map((e) => ({
    ego: checkMem(e.ego),
    presets: e.presets,
    weights: { prefer: {} },
  }));
  const pack = compileSystemMemory(input.memberPresets, egosWithWeights);
  const unityInDiversity = evaluateUnityInDiversityCircle(
    input.memberEgos.map((e, idx) => ({
      memberId: e.ego.of,
      name: `Member ${idx + 1}`,
      mem: e.ego,
      fourFloatsSpecialty: e.fourFloatsSpecialty ?? {
        Pxd: idx % 4 === 0 ? 0.95 : 0.7,
        Vtx: idx % 4 === 1 ? 0.95 : 0.7,
        Lx: idx % 4 === 2 ? 0.95 : 0.7,
        Aq: idx % 4 === 3 ? 0.95 : 0.7,
      },
      contributedPresets: e.presets,
    })),
  );
  const isSocialMemoryComplex = pack.pool !== null || unityInDiversity.isSocialMemoryComplex;
  const sharedShelfCodes = [...new Set(input.memberPresets.map((p) => p.of))].sort();
  const pooledClosedCauses = isSocialMemoryComplex
    ? [...new Set(input.memberPresets.flatMap((p) => p.cause.filter((c) => !c.open).map((c) => `${c.by}>${c.d}`)))].sort()
    : [];

  return {
    guildId: input.guildId,
    guildName: input.guildName,
    pack,
    isSocialMemoryComplex,
    sharedShelfCodes,
    pooledClosedCauses,
    unityInDiversity,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Tiered Comms & Cartridge Messaging (Plan 57 §9 Child Safety + Live Share Codes)
// ---------------------------------------------------------------------------------------------------------------------

export type CommsChannel = 'whisper' | 'party' | 'guild' | 'world-beacon';
export type AccountTrustTier = 'unverified-or-child' | 'verified';

export const CANNED_CALLOUTS: Readonly<Record<string, string>> = {
  'ping:gate': 'Meet at the Stargate plinth.',
  'ping:craft': 'Try this crafted preset on your bench!',
  'ping:eureka': 'Eureka! Something let go and flow returned.',
  'ping:help': 'Requesting a balanced Wanderer anchor here.',
  'ping:ready': 'Ready to dial the next world.',
};

const SHARE_CODE_REGEX = /\b(?:kit|part|mesh|matc|pxdc|sprite|skin|lx|sound|music|species|flora|loc|mot|logic|brain|anim|ui|uic|plot|world):[a-f0-9]{4,16}\b/g;

export interface CommsMessage {
  readonly id: string;
  readonly senderId: string;
  readonly channel: CommsChannel;
  readonly trustTier: AccountTrustTier;
  readonly calloutId: string | null;
  /** Sanitized display text (for unverified/child accounts, strictly derived from `calloutId` + attached share codes). */
  readonly displayText: string;
  /** Extracted preset share codes that the recipient's UI renders as live 3D turntable preview cards. */
  readonly attachedPresets: readonly string[];
  readonly tick: number;
}

/**
 * Builds and validates a Rung-6 Comms message.
 * - Under Plan 57 §9, `unverified-or-child` accounts cannot send raw free text: their message is assembled strictly
 *   from `CANNED_CALLOUTS[calloutId]` plus any valid preset share codes (`kit:...`, `loc:...`, etc.).
 * - `verified` accounts can send sanitized text plus embedded preset cartridges, which are automatically extracted into
 *   `attachedPresets` so recipients get live interactive preview cards (`previews-drive-play`).
 */
export function createCommsMessage(input: {
  readonly id: string;
  readonly senderId: string;
  readonly channel: CommsChannel;
  readonly trustTier: AccountTrustTier;
  readonly calloutId?: string | null;
  readonly rawText?: string;
  readonly attachedPresets?: readonly string[];
  readonly tick: number;
}): CommsMessage {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new Error('tick must be a non-negative integer');
  const callout = input.calloutId && CANNED_CALLOUTS[input.calloutId] ? input.calloutId : null;
  const fromText = (input.rawText ?? '').match(SHARE_CODE_REGEX) ?? [];
  const explicit = (input.attachedPresets ?? []).filter((c) => SHARE_CODE_REGEX.test(c));
  SHARE_CODE_REGEX.lastIndex = 0;
  const attachedPresets = [...new Set([...explicit, ...fromText])].sort();

  let displayText: string;
  if (input.trustTier === 'unverified-or-child') {
    const base = callout ? CANNED_CALLOUTS[callout]! : CANNED_CALLOUTS['ping:craft']!;
    displayText = attachedPresets.length > 0 ? `${base} [${attachedPresets.join(', ')}]` : base;
  } else {
    const clean = (input.rawText ?? '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
    displayText = clean || (callout ? CANNED_CALLOUTS[callout]! : attachedPresets.join(' '));
  }

  return {
    id: input.id,
    senderId: input.senderId,
    channel: input.channel,
    trustTier: input.trustTier,
    calloutId: callout,
    displayText,
    attachedPresets,
    tick: input.tick,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Video Clip, Stream & Deterministic Shorthand Replay (`hm2:clip:v1`)
// ---------------------------------------------------------------------------------------------------------------------

export type ClipTriggerKind = 'manual' | 'eureka' | 'contraption-forged' | 'stage-up' | 'stargate-dial';

export interface ClipManifest {
  readonly version: 'hm2:clip:v1';
  readonly clipId: string;
  readonly authorId: string;
  readonly worldSeed: string;
  readonly stage: StageId;
  readonly trigger: ClipTriggerKind;
  readonly durationSec: number;
  /** Video MIME type produced by the browser's `MediaRecorder` (`video/webm;codecs=vp9` or `video/mp4`). */
  readonly videoMime: 'video/webm;codecs=vp9' | 'video/webm' | 'video/mp4';
  /** Preset share codes featured in the clip so viewers can one-click inspect or import them. */
  readonly featuredPresets: readonly string[];
  /** Deterministic shorthand keyframe ticks (`t:action:val`) so another player can step into the 3D replay. */
  readonly replayFrames: readonly string[];
  readonly caption: string;
}

/**
 * Creates a validated Rung-6 Clip & Stream manifest pairing browser video capture metadata with deterministic
 * shorthand replay frames and featured preset codes.
 */
export function createClipManifest(input: Omit<ClipManifest, 'version' | 'durationSec'> & { readonly durationSec: number }): ClipManifest {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0 || input.durationSec > 120) {
    throw new Error('clip durationSec must be between 0 and 120 seconds');
  }
  return {
    version: 'hm2:clip:v1',
    clipId: input.clipId,
    authorId: input.authorId,
    worldSeed: input.worldSeed,
    stage: input.stage,
    trigger: input.trigger,
    durationSec: Math.round(input.durationSec * 10) / 10,
    videoMime: input.videoMime,
    featuredPresets: [...new Set(input.featuredPresets)].slice(0, 16),
    replayFrames: input.replayFrames.slice(0, 240),
    caption: input.caption.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 160),
  };
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const trip = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(trip >> 18) & 63]!;
    out += B64_ALPHABET[(trip >> 12) & 63]!;
    if (i + 1 < bytes.length) out += B64_ALPHABET[(trip >> 6) & 63]!;
    if (i + 2 < bytes.length) out += B64_ALPHABET[trip & 63]!;
  }
  return out;
}

function fromBase64Url(b64: string): string {
  const clean = b64.replace(/=+$/g, '');
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B64_ALPHABET.indexOf(clean[i]!);
    if (idx < 0) throw new Error('Invalid base64url char');
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Encodes a `ClipManifest` into a compact, URL/chat-safe `clip:` share string. */
export function encodeClipShareCode(manifest: ClipManifest): string {
  const json = JSON.stringify(manifest);
  return `clip:${toBase64Url(json)}`;
}

/** Decodes and validates a `clip:` share string back into a `ClipManifest`, or returns `null` if corrupted. */
export function decodeClipShareCode(code: string): ClipManifest | null {
  try {
    if (!code.startsWith('clip:')) return null;
    const raw = fromBase64Url(code.slice(5));
    const o = JSON.parse(raw) as Partial<ClipManifest>;
    if (
      o.version !== 'hm2:clip:v1' ||
      typeof o.clipId !== 'string' ||
      typeof o.authorId !== 'string' ||
      typeof o.worldSeed !== 'string' ||
      typeof o.stage !== 'string' ||
      typeof o.trigger !== 'string' ||
      typeof o.durationSec !== 'number' ||
      !Array.isArray(o.featuredPresets) ||
      !Array.isArray(o.replayFrames) ||
      typeof o.caption !== 'string'
    ) {
      return null;
    }
    return createClipManifest({
      clipId: o.clipId,
      authorId: o.authorId,
      worldSeed: o.worldSeed,
      stage: o.stage,
      trigger: o.trigger,
      durationSec: o.durationSec,
      videoMime: o.videoMime === 'video/mp4' || o.videoMime === 'video/webm' ? o.videoMime : 'video/webm;codecs=vp9',
      featuredPresets: o.featuredPresets.filter((x): x is string => typeof x === 'string'),
      replayFrames: o.replayFrames.filter((x): x is string => typeof x === 'string'),
      caption: o.caption,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Rung-6 Harness & Bridge Meta-Settings
// ---------------------------------------------------------------------------------------------------------------------

export type BridgeRelayMode = 'off' | 'mirror-only' | 'checked-profile-relay';

export interface HarnessMetaSettings {
  readonly bridgeMode: BridgeRelayMode;
  readonly higherSelfSeatEnabled: boolean;
  readonly childSafeFilter: boolean;
  readonly autoClipOnEureka: boolean;
  readonly streamMaxFps: 15 | 30 | 60;
}

export const DEFAULT_HARNESS_META_SETTINGS: HarnessMetaSettings = {
  bridgeMode: 'mirror-only',
  higherSelfSeatEnabled: true,
  childSafeFilter: true,
  autoClipOnEureka: true,
  streamMaxFps: 30,
};

/**
 * Enforces standing safety policies on the Rung-6 Harness Settings:
 * - If an external game has anti-cheat (`hasAntiCheat`), `checked-profile-relay` is automatically downgraded to
 *   `mirror-only` so outbound synthetic input is never sent to an anti-cheat host.
 * - For `unverified-or-child` accounts, `childSafeFilter` is locked to `true`.
 */
export function validateHarnessSettings(
  raw: Partial<HarnessMetaSettings>,
  context: { readonly hasAntiCheat?: boolean; readonly trustTier?: AccountTrustTier } = {},
): HarnessMetaSettings {
  let bridgeMode: BridgeRelayMode =
    raw.bridgeMode === 'off' || raw.bridgeMode === 'checked-profile-relay' ? raw.bridgeMode : 'mirror-only';
  if (context.hasAntiCheat && bridgeMode === 'checked-profile-relay') {
    bridgeMode = 'mirror-only';
  }
  const childSafeFilter =
    context.trustTier === 'unverified-or-child' ? true : (raw.childSafeFilter ?? DEFAULT_HARNESS_META_SETTINGS.childSafeFilter);
  const streamMaxFps: 15 | 30 | 60 = raw.streamMaxFps === 15 || raw.streamMaxFps === 60 ? raw.streamMaxFps : 30;

  return {
    bridgeMode,
    higherSelfSeatEnabled: raw.higherSelfSeatEnabled ?? DEFAULT_HARNESS_META_SETTINGS.higherSelfSeatEnabled,
    childSafeFilter,
    autoClipOnEureka: raw.autoClipOnEureka ?? DEFAULT_HARNESS_META_SETTINGS.autoClipOnEureka,
    streamMaxFps,
  };
}
