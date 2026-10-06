/* ============================================================================
 *  packages/setmix-dialogue/src/DialogueEngine.ts
 *  ---------------------------------------------------------------------------
 *  DIEGETIC 3D DIALOGUE + A PROCEDURAL ALIEN LARYNX.
 *
 *  No voice actors, no localisation budget, no 400 MB of .wav. Goblin speech
 *  is synthesised from the TEXT ITSELF: each character maps to a vowel
 *  formant pair and a consonant burst, so the same line always sounds the
 *  same, in every language, forever, from nine bytes of state.
 *
 *  THE PHYSICS
 *  A vowel is two resonant peaks in the vocal tract — F1 (tongue height) and
 *  F2 (tongue backness). Synthesise a buzzy glottal source, run it through
 *  two bandpass filters at those frequencies, and the brain hears a vowel.
 *  That is the entire trick, and it is why "procedural speech" sounds like
 *  Banjo-Kazooie rather than like a modem.
 *
 *  Pure except for the synth, which takes an AudioContext.
 * ==========================================================================*/

export type Vec3 = [number, number, number];

/* ─────────────────────────────── formant table (Hz) ─────────────────── */

/** Real measured formants, shifted up ~18% for a small goblin larynx. */
export const FORMANTS: Readonly<Record<string, [number, number, number]>> = Object.freeze({
  a: [860, 1480, 2740], e: [620, 2060, 2840], i: [370, 2500, 3200],
  o: [560, 1020, 2540], u: [380, 940, 2420],  y: [320, 1960, 2600],
});
const VOWELS = "aeiouy";

/* ─────────────────────────────────────────────────────── voice profiles */

export interface VoiceProfile {
  id: string;
  label: string;
  /** multiplies every formant — small goblins are bright, spires are deep */
  formantScale: number;
  /** glottal pulse rate, Hz */
  pitch: number;
  /** semitone range of the sentence melody */
  prosody: number;
  /** syllables per second */
  rate: number;
  /** 0 pure tone … 1 very buzzy */
  buzz: number;
  /** 0 smooth … 1 heavy consonant clicks */
  grit: number;
  /** 0 = no vibrato */
  warble: number;
}

export const VOICES: Readonly<Record<string, VoiceProfile>> = Object.freeze({
  GOBLIN_SCOUT:  { id: "GOBLIN_SCOUT",  label: "Goblin Scout",  formantScale: 1.34, pitch: 196, prosody: 7,  rate: 7.4, buzz: 0.62, grit: 0.55, warble: 0.18 },
  GOBLIN_ELDER:  { id: "GOBLIN_ELDER",  label: "Goblin Elder",  formantScale: 0.92, pitch: 104, prosody: 4,  rate: 5.1, buzz: 0.78, grit: 0.34, warble: 0.08 },
  TRADER:        { id: "TRADER",        label: "Cartridge Trader", formantScale: 1.18, pitch: 164, prosody: 11, rate: 8.6, buzz: 0.48, grit: 0.68, warble: 0.26 },
  ANCIENT_SPIRE: { id: "ANCIENT_SPIRE", label: "Ancient Spire", formantScale: 0.58, pitch: 61,  prosody: 2,  rate: 3.2, buzz: 0.9,  grit: 0.12, warble: 0.03 },
  LAB_AI:        { id: "LAB_AI",        label: "Lab Assistant", formantScale: 1.06, pitch: 142, prosody: 3,  rate: 9.2, buzz: 0.22, grit: 0.08, warble: 0.0 },
});

/* ═════════════════════════════ 1 · TEXT → PHONEME SCHEDULE ═══════════ */

export interface Phone {
  /** seconds from utterance start */
  at: number;
  dur: number;
  kind: "VOWEL" | "CONSONANT" | "PAUSE";
  f1: number; f2: number; f3: number;
  /** glottal pitch for this phone, including sentence melody */
  pitch: number;
  gain: number;
  /** index into the source string, so the balloon can reveal in sync */
  charIndex: number;
}

/**
 *  Deterministic: the same string always produces the same schedule, which
 *  means a remote player hears exactly what the speaker heard, and the
 *  balloon's letter reveal stays locked to the audio with zero sync data.
 */
export function phonemise(text: string, v: VoiceProfile): Phone[] {
  const out: Phone[] = [];
  const base = 1 / v.rate;
  let t = 0;
  // sentence melody: a gentle arc that falls on '.' and rises on '?'
  const ends = text.trim().slice(-1);
  const arcDir = ends === "?" ? 1 : ends === "!" ? 0.4 : -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toLowerCase();
    const frac = i / Math.max(1, text.length - 1);

    if (ch === " ") { t += base * 0.42; continue; }
    if (".,;:!?".includes(ch)) {
      out.push({ at: t, dur: base * 1.3, kind: "PAUSE", f1: 0, f2: 0, f3: 0, pitch: 0, gain: 0, charIndex: i });
      t += base * (ch === "," ? 0.9 : 1.8);
      continue;
    }
    if (!/[a-z0-9]/.test(ch)) continue;

    // melody in semitones → ratio
    const semi = arcDir * v.prosody * (frac - 0.35) + Math.sin(frac * 11.3) * v.prosody * 0.22;
    const pitch = v.pitch * Math.pow(2, semi / 12);

    if (VOWELS.includes(ch)) {
      const [f1, f2, f3] = FORMANTS[ch];
      out.push({
        at: t, dur: base * (0.72 + (ch === "a" || ch === "o" ? 0.3 : 0)),
        kind: "VOWEL",
        f1: f1 * v.formantScale, f2: f2 * v.formantScale, f3: f3 * v.formantScale,
        pitch, gain: 0.9, charIndex: i,
      });
      t += base * 0.82;
    } else {
      // consonants are short filtered bursts; the letter code picks the band
      const code = ch.charCodeAt(0);
      const bright = 900 + (code % 17) * 260;
      out.push({
        at: t, dur: base * 0.26, kind: "CONSONANT",
        f1: bright, f2: bright * 2.1, f3: bright * 3.4,
        pitch, gain: 0.5 + v.grit * 0.4, charIndex: i,
      });
      t += base * 0.34;
    }
  }
  return out;
}

export const utteranceDuration = (p: Phone[]) =>
  p.length ? p[p.length - 1].at + p[p.length - 1].dur : 0;

/* ═════════════════════════════ 2 · THE FORMANT SYNTHESISER ═══════════ */

export interface SynthHandle { stop(): void; duration: number }

/**
 *  Source-filter model:
 *
 *    sawtooth (glottal pulse)  ──┬── BPF @ F1 ──┐
 *                                ├── BPF @ F2 ──┼── gain env ── out
 *                                └── BPF @ F3 ──┘
 *    noise burst (consonants) ──── BPF @ bright ┘
 *
 *  Three biquads and one oscillator per utterance — not per phone. We
 *  automate the filter frequencies along the schedule, which is both far
 *  cheaper and more convincing, because real formants GLIDE between vowels
 *  rather than jumping. Those glides are what make it read as a language.
 */
export function speak(
  ctx: AudioContext, dest: AudioNode, phones: Phone[], v: VoiceProfile,
  opts: { gain?: number; startAt?: number } = {},
): SynthHandle {
  const t0 = (opts.startAt ?? ctx.currentTime) + 0.02;
  const dur = utteranceDuration(phones);
  const master = ctx.createGain();
  master.gain.value = opts.gain ?? 0.25;
  master.connect(dest);

  /* ── glottal source ─────────────────────────────────────────────── */
  const glottis = ctx.createOscillator();
  glottis.type = "sawtooth";
  glottis.frequency.setValueAtTime(v.pitch, t0);

  // warble: a slow LFO on pitch. Zero for the Lab AI, which is why it reads
  // as synthetic while the goblins read as alive.
  if (v.warble > 0.001) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = ctx.createGain();
    lg.gain.value = v.pitch * v.warble * 0.05;
    lfo.connect(lg).connect(glottis.frequency);
    lfo.start(t0); lfo.stop(t0 + dur + 0.3);
  }

  // buzz shaping: a mild waveshaper gives the source its throaty rasp
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * (1 + v.buzz * 5)) / Math.tanh(1 + v.buzz * 5);
  }
  shaper.curve = curve;
  glottis.connect(shaper);

  /* ── noise source for consonants ────────────────────────────────── */
  const noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  let s = 0x9e37 ^ phones.length;
  for (let i = 0; i < nd.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    nd[i] = (s / 2147483648) - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf; noise.loop = true;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noise.connect(noiseGain);

  /* ── three formant bandpasses ───────────────────────────────────── */
  const mkBand = (q: number, g: number) => {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = g;
    f.connect(gain).connect(master);
    shaper.connect(f);
    noiseGain.connect(f);
    return f;
  };
  const b1 = mkBand(9, 1.0);
  const b2 = mkBand(12, 0.62);
  const b3 = mkBand(16, 0.3);

  /* ── amplitude envelope ─────────────────────────────────────────── */
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  shaper.disconnect();
  shaper.connect(env);
  env.connect(b1); env.connect(b2); env.connect(b3);

  for (const p of phones) {
    const at = t0 + p.at;
    if (p.kind === "PAUSE") {
      env.gain.setTargetAtTime(0.0001, at, 0.02);
      continue;
    }
    // formant glide — setTargetAtTime, not setValueAtTime, is the whole
    // difference between speech and Morse code
    b1.frequency.setTargetAtTime(p.f1, at, 0.018);
    b2.frequency.setTargetAtTime(p.f2, at, 0.018);
    b3.frequency.setTargetAtTime(p.f3, at, 0.025);
    glottis.frequency.setTargetAtTime(p.pitch, at, 0.03);

    if (p.kind === "VOWEL") {
      noiseGain.gain.setTargetAtTime(0.02, at, 0.01);
      env.gain.setTargetAtTime(p.gain, at, 0.012);
      env.gain.setTargetAtTime(p.gain * 0.5, at + p.dur * 0.7, 0.03);
    } else {
      noiseGain.gain.setTargetAtTime(0.5 * p.gain, at, 0.004);
      noiseGain.gain.setTargetAtTime(0.0, at + p.dur * 0.8, 0.012);
      env.gain.setTargetAtTime(p.gain * 0.35, at, 0.006);
    }
  }
  env.gain.setTargetAtTime(0.0001, t0 + dur, 0.05);

  glottis.start(t0); noise.start(t0);
  glottis.stop(t0 + dur + 0.4); noise.stop(t0 + dur + 0.4);

  return {
    duration: dur,
    stop() {
      try { glottis.stop(); noise.stop(); } catch { /* already stopped */ }
      master.disconnect();
    },
  };
}

/* ═══════════════════════════ 3 · WORLD-SPACE BALLOONS ════════════════ */

export interface NPC {
  id: string;
  name: string;
  voice: string;
  pos: Vec3;
  /** head offset above pos */
  headHeight: number;
  kind: "SCOUT" | "ELDER" | "TRADER" | "SPIRE";
  tint: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  /** player replies; empty = auto-advance */
  choices?: { label: string; next: string | null; effect?: string }[];
  next?: string | null;
}

export interface BalloonState {
  npcId: string;
  nodeId: string;
  /** 0..1 — how much of the text has been revealed, locked to the synth */
  reveal: number;
  elapsed: number;
  duration: number;
  /** screen-projected anchor, filled by the renderer */
  screen: [number, number];
  /** 0 invisible … 1 full; distance + angle fade */
  opacity: number;
  scale: number;
  distance: number;
  done: boolean;
}

export const BALLOON = {
  /** beyond this the balloon is culled entirely */
  maxDistance: 46,
  /** below this it is full size */
  nearDistance: 9,
  minScale: 0.46,
  /** balloons behind the camera or at a grazing angle fade out */
  cullDot: 0.12,
};

/**
 *  Billboarding + distance fade. The balloon is NOT a screen-space UI panel
 *  anchored to a world position — it is drawn at a projected point with a
 *  projected scale, so it genuinely occupies the scene. The difference shows
 *  the moment two NPCs stand at different depths.
 */
export function projectBalloon(
  npc: NPC, viewProj: Float32Array, camPos: Vec3, camFwd: Vec3,
  viewport: [number, number],
): { screen: [number, number]; opacity: number; scale: number; distance: number; visible: boolean } {
  const wx = npc.pos[0], wy = npc.pos[1] + npc.headHeight, wz = npc.pos[2];
  const dx = wx - camPos[0], dy = wy - camPos[1], dz = wz - camPos[2];
  const distance = Math.hypot(dx, dy, dz);
  const facing = (dx * camFwd[0] + dy * camFwd[1] + dz * camFwd[2]) / (distance || 1);
  if (facing < BALLOON.cullDot || distance > BALLOON.maxDistance)
    return { screen: [0, 0], opacity: 0, scale: 0, distance, visible: false };

  const m = viewProj;
  const cx = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
  const cy = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
  const cw = m[3] * wx + m[7] * wy + m[11] * wz + m[15];
  if (cw <= 0) return { screen: [0, 0], opacity: 0, scale: 0, distance, visible: false };

  const sx = (cx / cw * 0.5 + 0.5) * viewport[0];
  const sy = (1 - (cy / cw * 0.5 + 0.5)) * viewport[1];

  const t = Math.min(1, Math.max(0, (distance - BALLOON.nearDistance) /
    (BALLOON.maxDistance - BALLOON.nearDistance)));
  const fade = 1 - t * t;                      // quadratic: readable, then gone
  const angleFade = Math.min(1, (facing - BALLOON.cullDot) / 0.2);
  return {
    screen: [sx, sy],
    opacity: fade * angleFade,
    scale: BALLOON.minScale + (1 - t) * (1 - BALLOON.minScale),
    distance,
    visible: true,
  };
}

export function stepBalloon(b: BalloonState, dt: number): BalloonState {
  const elapsed = b.elapsed + dt;
  const reveal = b.duration > 0 ? Math.min(1, elapsed / b.duration) : 1;
  return { ...b, elapsed, reveal, done: elapsed > b.duration + 0.9 };
}

/* ───────────────────────────────── authored dialogue ─────────────────── */

export const NPCS: NPC[] = [
  { id: "scout", name: "Pib", voice: "GOBLIN_SCOUT", pos: [-14, 0, -6], headHeight: 1.6, kind: "SCOUT", tint: "#7cff4d" },
  { id: "elder", name: "Vorbuk", voice: "GOBLIN_ELDER", pos: [8, 0, -18], headHeight: 1.7, kind: "ELDER", tint: "#ffc13d" },
  { id: "trader", name: "Skree", voice: "TRADER", pos: [18, 0, 4], headHeight: 1.6, kind: "TRADER", tint: "#b46bff" },
  { id: "spire", name: "Spire 7", voice: "ANCIENT_SPIRE", pos: [-4, 0, 22], headHeight: 9.4, kind: "SPIRE", tint: "#3dc8ff" },
];

export const DIALOGUE: Record<string, DialogueNode> = {
  scout_hello: {
    id: "scout_hello", speaker: "scout",
    text: "You came through the bright door! Nobody comes through the bright door.",
    choices: [
      { label: "What is this place?", next: "scout_place" },
      { label: "Are there others?", next: "scout_others" },
      { label: "(say nothing)", next: null },
    ],
  },
  scout_place: {
    id: "scout_place", speaker: "scout",
    text: "A moon that forgot how to be detailed. We have four colours. We used to have more.",
    next: null,
  },
  scout_others: {
    id: "scout_others", speaker: "scout",
    text: "Vorbuk, on the rim. Skree, who trades. And the spires, which only hum.",
    next: null,
  },
  elder_hello: {
    id: "elder_hello", speaker: "elder",
    text: "Pixels fall from your chimney like warm rain. I have waited a long time for warm rain.",
    choices: [
      { label: "How long?", next: "elder_long" },
      { label: "I can make more.", next: "elder_more" },
    ],
  },
  elder_long: {
    id: "elder_long", speaker: "elder",
    text: "Long enough to watch a mountain become a staircase. Long enough to forget which it was first.",
    next: null,
  },
  elder_more: {
    id: "elder_more", speaker: "elder",
    text: "Then make them well. A planet remembers the colours you chose, not the ore you dug.",
    next: null,
  },
  trader_hello: {
    id: "trader_hello", speaker: "trader",
    text: "Shards! Salts! Clathrates! I have cartridges your little lab will never grow.",
    choices: [
      { label: "Show me.", next: "trader_open", effect: "OPEN_MARKET" },
      { label: "Where do you get them?", next: "trader_where" },
    ],
  },
  trader_where: {
    id: "trader_where", speaker: "trader",
    text: "From moons that finished. I do not ask what finished them.",
    next: null,
  },
  trader_open: {
    id: "trader_open", speaker: "trader",
    text: "Look, look. Every one of them certified. Mostly.",
    next: null,
  },
  spire_hello: {
    id: "spire_hello", speaker: "spire",
    text: "RESOLUTION INSUFFICIENT. INSERT TEMPLATE. I HAVE BEEN EMPTY FOR NINE THOUSAND CYCLES.",
    next: null,
  },
};
