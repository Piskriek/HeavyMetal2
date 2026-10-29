/**
 * Plan 58 §18: Preset-Driven Semantic-Emotional Utterance, Full-Duplex Prosody & Localization (`@hm/harness`).
 *
 * Grounded in:
 * 1. Comparative Speech-to-Speech Voice AI Research (`docs/EXPRESSIVE_VOICE_AND_LANGUAGE_RESEARCH.md`):
 *    - Block's full-duplex *Dessa* model, Kyutai's *Moshi*, and NVIDIA's *PersonaPlex* demonstrate that converting
 *      speech/intent into flat text strips away ~90% of communicative bandwidth (prosody, paralinguistic breath cues
 *      like chuckles/sighs/gasps, somatic strain, and full-duplex backchannels).
 * 2. Universal Linguistic Typology:
 *    - All human languages derive from shared conceptual roots (`sem:`) modulated by speaker intent, somatic/emotional
 *      state (`emo:`), archetypical polarity, and regional/cultural grammar (`locale:`).
 * 3. Ra's Cross-Wired Archetypical Polarity (Law of One 78.11, 87.28, 91.37):
 *    - Masculine polarity (`intent`, `pol >= 32`): Mind = Matrix (I. The Magician / conscious will),
 *      Body = Potentiator (IX. The Hermit / kinetic discipline) -> direct, telegraphic, imperative cadence.
 *    - Feminine polarity (`context`, `pol <= -32`): Mind = Potentiator (II. The High Priestess / intuitive sea),
 *      Body = Matrix (VIII. Balanced Working / somatic homeostasis) -> relational, contextual, resonant cadence.
 *    - Balanced polarity (`|pol| < 32` or `bal >= 0.9`): Harmonic synthesis uniting Matrix and Potentiator.
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O).
 */
import type { Mem } from '@hm/shorthand';
import { crossWiredPolarity } from './archetypes.js';
import type { BodyState } from './body.js';
import { BALANCED_AT } from './preset-memory.js';

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const round2 = (x: number): number => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------------------------------------------------
// Rung 1: Semantic Roots (`sem:`)
// ---------------------------------------------------------------------------------------------------------------------

export type SemanticRootId =
  | 'LEVEL_UP'
  | 'SKILL_GAINED'
  | 'CONTRAPTION_FORGED'
  | 'BODY_ACHE'
  | 'BODY_EUREKA'
  | 'ARRIVAL_GREETING'
  | 'QUEST_SEEDED'
  | 'GATE_PING'
  | 'ANCHOR_CALM_SHARED';

export type UtteranceIntent = 'announce' | 'warn' | 'comfort' | 'celebrate' | 'reflect';

export interface SemanticRootSpec {
  readonly id: SemanticRootId;
  readonly defaultIntent: UtteranceIntent;
  readonly requiredSlots: readonly string[];
  readonly description: string;
}

export const SEMANTIC_ROOT_CATALOG: Readonly<Record<SemanticRootId, SemanticRootSpec>> = {
  LEVEL_UP: {
    id: 'LEVEL_UP',
    defaultIntent: 'celebrate',
    requiredSlots: ['subject', 'rank'],
    description: 'A preset, skill, or stage ascended to a higher fidelity rung.',
  },
  SKILL_GAINED: {
    id: 'SKILL_GAINED',
    defaultIntent: 'announce',
    requiredSlots: ['skill'],
    description: 'An emergent capability crystallized from repeated lived catalyst.',
  },
  CONTRAPTION_FORGED: {
    id: 'CONTRAPTION_FORGED',
    defaultIntent: 'celebrate',
    requiredSlots: ['item'],
    description: 'A new modular preset or contraption was assembled on the bench.',
  },
  BODY_ACHE: {
    id: 'BODY_ACHE',
    defaultIntent: 'warn',
    requiredSlots: ['zone'],
    description: 'Unbalanced catalyst charge manifested as somatic strain in a body zone.',
  },
  BODY_EUREKA: {
    id: 'BODY_EUREKA',
    defaultIntent: 'celebrate',
    requiredSlots: ['quality'],
    description: 'A long-held distortion released during dreaming or steady play, restoring flow.',
  },
  ARRIVAL_GREETING: {
    id: 'ARRIVAL_GREETING',
    defaultIntent: 'reflect',
    requiredSlots: ['world'],
    description: 'Stepping through the Stargate or waking into a plot.',
  },
  QUEST_SEEDED: {
    id: 'QUEST_SEEDED',
    defaultIntent: 'announce',
    requiredSlots: ['quest'],
    description: 'Player actions shifted world entropy and seeded an emergent science questline.',
  },
  GATE_PING: {
    id: 'GATE_PING',
    defaultIntent: 'announce',
    requiredSlots: ['world'],
    description: 'Tactical callout rallying the party to the Stargate plinth.',
  },
  ANCHOR_CALM_SHARED: {
    id: 'ANCHOR_CALM_SHARED',
    defaultIntent: 'comfort',
    requiredSlots: ['calm'],
    description: 'A balanced Wanderer lent anchor calm to steady nearby companions.',
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Rung 2: Intent, Emotional/Somatic State & Cross-Wired Archetypical Polarity (`emo:`)
// ---------------------------------------------------------------------------------------------------------------------

export type VoicePolarity = 'masculine' | 'feminine' | 'balanced';
export type BreathCue = 'sigh' | 'laugh' | 'gasp' | 'steady';
export type TimbreFilter = 'clear' | 'starved-throat' | 'resonant-eureka' | 'warm-anchor';

export interface EmotionalEnvelope {
  readonly intent: UtteranceIntent;
  readonly excitement: number;
  readonly balance: number;
  readonly acheStage: 0 | 1 | 2 | 3;
  readonly starvedRay: number | null;
  readonly polarity: VoicePolarity;
  readonly mindArchetype: string;
  readonly bodyArchetype: string;
  /** Prosodic pitch shift in semitones (-4..+4). */
  readonly pitchShiftSemitones: number;
  /** Prosodic speaking rate multiplier (0.75..1.35). */
  readonly tempoScale: number;
  /** Paralinguistic vocalization cue (inspired by Block's Dessa full-duplex speech model). */
  readonly breathCue: BreathCue;
  /** Spectral timbre filter reflecting somatic/chakra state. */
  readonly timbreFilter: TimbreFilter;
}

export interface DeriveEmotionalEnvelopeInput {
  readonly intent: UtteranceIntent;
  readonly mem?: Mem;
  readonly body?: BodyState;
  readonly excitementOverride?: number;
  readonly polarityOverride?: VoicePolarity;
}

/**
 * Derives a deterministic Rung-2 `EmotionalEnvelope` (`emo:`) from communicative intent, `Mem` charge/episodes,
 * `BodyState` somatic zones, and Ra's Cross-Wired Archetypical Polarity (Law of One 78.11, 87.28).
 */
export function deriveEmotionalEnvelope(input: DeriveEmotionalEnvelopeInput): EmotionalEnvelope {
  const mem = input.mem;
  const body = input.body;

  // 1. Balance & Excitement from Mem
  const balance = mem ? round2(clamp(mem.bal, 0, 1)) : 1;
  const lastEp = mem && mem.ep.length > 0 ? mem.ep[mem.ep.length - 1] : undefined;
  const rawExcitement =
    input.excitementOverride !== undefined
      ? input.excitementOverride
      : lastEp
        ? lastEp.x
        : input.intent === 'celebrate' || input.intent === 'warn'
          ? 0.75
          : 0.45;
  const excitement = round2(clamp(rawExcitement, 0, 1));

  // 2. Somatic Ache Stage & Starved Ray from BodyState / Mem charge
  let maxAche = 0;
  if (body) {
    for (const z of Object.values(body.zones)) {
      if (z.stage > maxAche) maxAche = z.stage;
    }
  } else if (mem && balance < 0.7) {
    maxAche = balance < 0.4 ? 2 : 1;
  }
  const acheStage = clamp(Math.round(maxAche), 0, 3) as 0 | 1 | 2 | 3;

  let starvedRay: number | null = null;
  if (mem) {
    let minCharge = 0;
    for (let i = 0; i < mem.charge.length; i++) {
      const c = mem.charge[i] ?? 0;
      if (c < minCharge && c <= -24) {
        minCharge = c;
        starvedRay = i + 1;
      }
    }
  }

  // 3. Cross-Wired Archetypical Polarity (Mind vs Body)
  let polarity: VoicePolarity = input.polarityOverride ?? 'balanced';
  let mindArchetype = 'The Magician + The High Priestess';
  let bodyArchetype = 'Balanced Working + The Hermit';

  if (mem) {
    const cw = crossWiredPolarity(mem);
    if (!input.polarityOverride) {
      polarity = cw.pole === 'intent' ? 'masculine' : cw.pole === 'context' ? 'feminine' : 'balanced';
    }
    mindArchetype = cw.mindLead.tarotName;
    bodyArchetype = cw.bodyLead.tarotName;
  } else if (polarity === 'masculine') {
    mindArchetype = 'The Magician';
    bodyArchetype = 'The Hermit (Wisdom)';
  } else if (polarity === 'feminine') {
    mindArchetype = 'The High Priestess';
    bodyArchetype = 'Balanced Working';
  }

  // 4. Paralinguistic Breath Cue & Timbre Filter
  let breathCue: BreathCue = 'steady';
  if (input.intent === 'celebrate' && excitement >= 0.65 && acheStage === 0) {
    breathCue = 'laugh';
  } else if (input.intent === 'warn' || (acheStage >= 2 && excitement >= 0.7)) {
    breathCue = 'gasp';
  } else if (input.intent === 'comfort' || input.intent === 'reflect' || acheStage >= 1) {
    breathCue = 'sigh';
  }

  let timbreFilter: TimbreFilter = 'clear';
  if (starvedRay === 5 || acheStage >= 2) {
    timbreFilter = 'starved-throat';
  } else if (input.intent === 'celebrate' && balance >= BALANCED_AT) {
    timbreFilter = 'resonant-eureka';
  } else if (input.intent === 'comfort' || (balance >= BALANCED_AT && polarity !== 'masculine')) {
    timbreFilter = 'warm-anchor';
  }

  // 5. Prosodic Pitch & Tempo Modulation
  const intentPitch =
    input.intent === 'celebrate'
      ? 1.5
      : input.intent === 'warn'
        ? 1.0
        : input.intent === 'comfort'
          ? -1.0
          : input.intent === 'reflect'
            ? -0.6
            : 0;
  const polarityPitch = polarity === 'masculine' ? -0.8 : polarity === 'feminine' ? 0.8 : 0;
  const pitchShiftSemitones = round2(clamp(intentPitch + polarityPitch + (excitement - 0.5) * 2.0, -4, 4));

  const baseTempo = 0.88 + excitement * 0.32 - acheStage * 0.05;
  const polarityTempo = polarity === 'masculine' ? 1.05 : polarity === 'feminine' ? 0.96 : 1.0;
  const tempoScale = round2(clamp(baseTempo * polarityTempo, 0.75, 1.35));

  return {
    intent: input.intent,
    excitement,
    balance,
    acheStage,
    starvedRay,
    polarity,
    mindArchetype,
    bodyArchetype,
    pitchShiftSemitones,
    tempoScale,
    breathCue,
    timbreFilter,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Rung 3–4: Locale & Dialect Presets (`locale:`)
// ---------------------------------------------------------------------------------------------------------------------

export type LocaleId = 'en' | 'af' | 'ja';

export interface LocalePreset {
  readonly id: LocaleId;
  readonly name: string;
  readonly register: string;
  readonly breathMarkers: Readonly<Record<BreathCue, string>>;
  readonly backchannels: Readonly<Record<BreathCue, string>>;
  readonly polarityFraming: Readonly<
    Record<VoicePolarity, { readonly prefix: string; readonly suffix: string }>
  >;
  readonly templates: Readonly<Record<SemanticRootId, string>>;
}

export const LOCALE_SHELF: Readonly<Record<LocaleId, LocalePreset>> = {
  en: {
    id: 'en',
    name: 'English (SetMix Tactile)',
    register: 'Industrial / Sovereign LitRPG',
    breathMarkers: {
      sigh: '[sigh]',
      laugh: '[chuckle]',
      gasp: '[sharp breath]',
      steady: '[steady]',
    },
    backchannels: {
      sigh: 'Yeah… I feel that.',
      laugh: 'Hah—nice one, got it!',
      gasp: 'Whoa—watch that spike!',
      steady: 'Mm-hm, tracking clean.',
    },
    polarityFraming: {
      masculine: { prefix: 'Will locked:', suffix: 'Execute.' },
      feminine: { prefix: 'Field resonating:', suffix: 'Flow holds.' },
      balanced: { prefix: 'Harmonic alignment:', suffix: 'Steady.' },
    },
    templates: {
      LEVEL_UP: '{subject} ascended to {rank}.',
      SKILL_GAINED: 'Emergent skill crystallized: {skill}.',
      CONTRAPTION_FORGED: 'Contraption forged on bench: {item}.',
      BODY_ACHE: 'Somatic strain building in {zone}.',
      BODY_EUREKA: 'Eureka—distortion released, {quality} restored!',
      ARRIVAL_GREETING: 'Threshold crossed into {world}.',
      QUEST_SEEDED: 'World equilibrium shifted—new inquiry: {quest}.',
      GATE_PING: 'Rally at the {world} Stargate plinth.',
      ANCHOR_CALM_SHARED: 'Wanderer anchor steadied the party ({calm}).',
    },
  },
  af: {
    id: 'af',
    name: 'Afrikaans (Taktiese Ateljee)',
    register: 'Warm Taktiese Ingenieurswese',
    breathMarkers: {
      sigh: '[sug]',
      laugh: '[lag sag]',
      gasp: '[skerp asem]',
      steady: '[rustig]',
    },
    backchannels: {
      sigh: 'Ja… ek voel dit ook.',
      laugh: 'Ha—mooi so, ek het hom!',
      gasp: 'Sjoe—kyk uit vir daardie piek!',
      steady: 'Mm-hm, sein loop skoon.',
    },
    polarityFraming: {
      masculine: { prefix: 'Wil gesluit:', suffix: 'Voer uit.' },
      feminine: { prefix: 'Veld in resonansie:', suffix: 'Die vloei hou.' },
      balanced: { prefix: 'Harmoniese balans:', suffix: 'Bestendig.' },
    },
    templates: {
      LEVEL_UP: '{subject} het opgegaan na {rank}.',
      SKILL_GAINED: 'Nuwe vaardigheid gekristalliseer: {skill}.',
      CONTRAPTION_FORGED: 'Toestel op die bank gesmee: {item}.',
      BODY_ACHE: 'Lighaamlike spanning bou op in {zone}.',
      BODY_EUREKA: 'Eureka—vervorming laat gaan, {quality} is herstel!',
      ARRIVAL_GREETING: 'Drumpel oorgesteek na {world}.',
      QUEST_SEEDED: 'Wêreldbalans het geskuif—nuwe ondersoek: {quest}.',
      GATE_PING: 'Kom bymekaar by die {world} Sterhek-plint.',
      ANCHOR_CALM_SHARED: 'Wandelaar-anker het die groep bedaar ({calm}).',
    },
  },
  ja: {
    id: 'ja',
    name: '日本語 (LitRPG System Register)',
    register: 'Sovereign System & Resonance',
    breathMarkers: {
      sigh: '[吐息]',
      laugh: '[微笑]',
      gasp: '[息を呑む]',
      steady: '[静謐]',
    },
    backchannels: {
      sigh: 'ああ…その負荷、伝わってくるよ。',
      laugh: 'ふふっ、見事な組み上げだ！',
      gasp: 'っ、待て！波形が跳ねている！',
      steady: 'うん、同調は安定している。',
    },
    polarityFraming: {
      masculine: { prefix: '《意志確定》', suffix: '直ちに遂行せよ。' },
      feminine: { prefix: '《共鳴展開》', suffix: '流れは調和しているわ。' },
      balanced: { prefix: '《統合均衡》', suffix: '位相、安定。' },
    },
    templates: {
      LEVEL_UP: '{subject} が {rank} へ昇華しました。',
      SKILL_GAINED: '創発スキル《{skill}》を獲得しました。',
      CONTRAPTION_FORGED: '作業台にて機構《{item}》を鍛造しました。',
      BODY_ACHE: '{zone} に身体負荷の歪みが蓄積しています。',
      BODY_EUREKA: 'ユーレカ！歪みが解放され、《{quality}》が回復しました！',
      ARRIVAL_GREETING: '境界を越え、{world} に到達しました。',
      QUEST_SEEDED: '世界の均衡が変動——新たな探究《{quest}》が発生。',
      GATE_PING: '{world} のスターゲイト基壇へ集結せよ。',
      ANCHOR_CALM_SHARED: 'ワンダラーの錨がパーティに静けさ（{calm}）を分け与えました。',
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Rung 5: Utterance Synthesis, WebAudio Prosody & Share Code (`utt:`)
// ---------------------------------------------------------------------------------------------------------------------

export interface SynthesizedUtterance {
  readonly code: string;
  readonly rootId: SemanticRootId;
  readonly locale: LocaleId;
  readonly slots: Readonly<Record<string, string>>;
  readonly envelope: EmotionalEnvelope;
  /** Full spoken line with paralinguistic breath marker and archetypical polarity framing. */
  readonly spokenText: string;
  /** Clean subtitle line for HUD readout panels. */
  readonly subtitleText: string;
  /** Full-duplex active-listening backchannel cue for overlapping conversational response. */
  readonly backchannelText: string;
  /** WebAudio synthesizer prosody parameters derived from the `emo:` envelope. */
  readonly webAudioProsody: {
    readonly baseFreqHz: number;
    readonly tempoScale: number;
    readonly filterQ: number;
    readonly shimmerGain: number;
  };
}

export interface SynthesizeUtteranceInput {
  readonly rootId: SemanticRootId;
  readonly slots?: Readonly<Record<string, string | number>>;
  readonly locale?: LocaleId;
  readonly intent?: UtteranceIntent;
  readonly mem?: Mem;
  readonly body?: BodyState;
  readonly excitementOverride?: number;
  readonly polarityOverride?: VoicePolarity;
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

function interpolateTemplate(template: string, slots: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k: string) => slots[k] ?? k);
}

/**
 * Synthesizes a 5-Rung Semantic-Emotional Utterance (`SynthesizedUtterance`) from a semantic root (`sem:`),
 * slot values, emotional/somatic state (`emo:`), Ra's cross-wired archetypical polarity, and target locale (`locale:`).
 */
export function synthesizeUtterance(input: SynthesizeUtteranceInput): SynthesizedUtterance {
  const rootSpec = SEMANTIC_ROOT_CATALOG[input.rootId];
  const localeId: LocaleId = input.locale && LOCALE_SHELF[input.locale] ? input.locale : 'en';
  const localePreset = LOCALE_SHELF[localeId];
  const intent = input.intent ?? rootSpec.defaultIntent;

  const envelope = deriveEmotionalEnvelope({
    intent,
    ...(input.mem !== undefined ? { mem: input.mem } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.excitementOverride !== undefined ? { excitementOverride: input.excitementOverride } : {}),
    ...(input.polarityOverride !== undefined ? { polarityOverride: input.polarityOverride } : {}),
  });

  const normalizedSlots: Record<string, string> = {};
  for (const req of rootSpec.requiredSlots) {
    const val = input.slots?.[req];
    normalizedSlots[req] = val !== undefined && val !== '' ? String(val) : req;
  }
  if (input.slots) {
    for (const [k, v] of Object.entries(input.slots)) {
      if (!(k in normalizedSlots)) normalizedSlots[k] = String(v);
    }
  }

  const coreText = interpolateTemplate(localePreset.templates[input.rootId], normalizedSlots);
  const framing = localePreset.polarityFraming[envelope.polarity];
  const breath = localePreset.breathMarkers[envelope.breathCue];

  const subtitleText = `${framing.prefix} ${coreText}`;
  const spokenText = `${breath} ${framing.prefix} ${coreText} ${framing.suffix}`;
  const backchannelText = localePreset.backchannels[envelope.breathCue];

  // Base pitch: 220 Hz modulated by semitone shift ($220 \times 2^{\Delta/12}$)
  const baseFreqHz = round2(220 * Math.pow(2, envelope.pitchShiftSemitones / 12));
  const filterQ =
    envelope.timbreFilter === 'starved-throat'
      ? 6.5
      : envelope.timbreFilter === 'resonant-eureka'
        ? 3.2
        : envelope.timbreFilter === 'warm-anchor'
          ? 1.4
          : 2.0;
  const shimmerGain =
    envelope.timbreFilter === 'resonant-eureka'
      ? 0.45
      : envelope.timbreFilter === 'warm-anchor'
        ? 0.25
        : 0.1;

  const compactPayload = JSON.stringify({
    v: 1,
    r: input.rootId,
    l: localeId,
    i: intent,
    s: normalizedSlots,
    x: envelope.excitement,
    p: envelope.polarity,
  });

  return {
    code: `utt:${toBase64Url(compactPayload)}`,
    rootId: input.rootId,
    locale: localeId,
    slots: normalizedSlots,
    envelope,
    spokenText,
    subtitleText,
    backchannelText,
    webAudioProsody: {
      baseFreqHz,
      tempoScale: envelope.tempoScale,
      filterQ,
      shimmerGain,
    },
  };
}

/** Decodes a `utt:` share code and re-synthesizes the utterance in the target locale (or its original locale). */
export function decodeUtteranceCode(code: string, overrideLocale?: LocaleId): SynthesizedUtterance | null {
  try {
    if (!code.startsWith('utt:')) return null;
    const raw = JSON.parse(fromBase64Url(code.slice(4))) as {
      v?: unknown;
      r?: unknown;
      l?: unknown;
      i?: unknown;
      s?: unknown;
      x?: unknown;
      p?: unknown;
    };
    if (raw.v !== 1 || typeof raw.r !== 'string' || !(raw.r in SEMANTIC_ROOT_CATALOG)) return null;
    const rootId = raw.r as SemanticRootId;
    const locale = overrideLocale ?? (typeof raw.l === 'string' && raw.l in LOCALE_SHELF ? (raw.l as LocaleId) : 'en');
    const intent =
      typeof raw.i === 'string' && ['announce', 'warn', 'comfort', 'celebrate', 'reflect'].includes(raw.i)
        ? (raw.i as UtteranceIntent)
        : undefined;
    const polarityOverride =
      typeof raw.p === 'string' && ['masculine', 'feminine', 'balanced'].includes(raw.p)
        ? (raw.p as VoicePolarity)
        : undefined;
    const excitementOverride = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : undefined;
    const slots: Record<string, string> = {};
    if (raw.s && typeof raw.s === 'object') {
      for (const [k, v] of Object.entries(raw.s as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number') slots[k] = String(v);
      }
    }
    return synthesizeUtterance({
      rootId,
      locale,
      slots,
      ...(intent ? { intent } : {}),
      ...(excitementOverride !== undefined ? { excitementOverride } : {}),
      ...(polarityOverride ? { polarityOverride } : {}),
    });
  } catch {
    return null;
  }
}
