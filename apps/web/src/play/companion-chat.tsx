/**
 * Companion Comms (Plan 48, reworked on the owner's 27 Oct live-test feedback):
 *
 * - HOLD `T` is a true push-to-talk radio: keydown plays the mic-open chirp, starts speech
 *   recognition, and shows ONLY the minimal `[TX · TRANSMITTING]` HUD pill — never the panel.
 *   Keyup plays the squelch click and sends the transcript. `Enter` is the ONLY key that opens
 *   the typed comms panel; `Esc` closes it.
 * - Commands route through the pure spatial intent parser (companion-intent.ts) against the
 *   player's LIVE pose and landmarks — "float in front of me" hovers 2.2 m ahead at eye level.
 * - The Neural Bridge (scripts/companion-bridge.mjs) lets ANY outside AI drive the companion:
 *   the game polls GET /poll for commands and posts the player's words + telemetry as events;
 *   unmatched chat is forwarded there when the bridge is linked, else answered locally.
 * - Audio runs on ONE shared AudioContext; speech synthesis cancels stale utterances.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { CompanionEntity } from './companion';
import {
  parseCompanionIntent,
  resolveCompanionOrder,
  type CompanionLandmarks,
  type CompanionPlayerPose,
} from './companion-intent';
import type { ScoutCategory } from './companion-scout';
import { KNOWN_BRIDGE_GAMES } from '@hm/bridgekit';
import {
  checkBridgeProfile, createTelemetryAccumulator, gameIdOf, profileLine, rankRunningGames, uncheckedProfile,
  type BridgePermissionProfile, type TelemetryAccumulator,
} from '@hm/gamebridge';

/** Plan 51 wave 2: this many telemetry samples (about 10 s of a 30 Hz feed) make one observation for the harness. */
const TELEMETRY_BATCH = 300;
import './companion-chat.css';

/** What the screen can do through the comms (plan 49): the ping's callout and its bridge event. */
export interface CompanionChatHandle {
  /** The companion says `text` on the radio (log, bubble, the bridge); `spoken` is what the voice reads, when shorter. */
  say(text: string, spoken?: string): void;
  /** Sends an event to the bridge when it is linked (a ping). */
  post(event: Readonly<Record<string, unknown>>): void;
}

/** A kit order from a voice order or from an AI on the bridge (plan 49 Mission 2). No kit id: the last ping's. */
export type CompanionKitOrder =
  | { readonly kind: 'strip-hazard'; readonly kitId?: string; readonly partId?: string }
  | { readonly kind: 'restore-hazard'; readonly kitId?: string }
  | { readonly kind: 'reset'; readonly kitId?: string; readonly paths?: readonly string[] }
  | { readonly kind: 'set-material'; readonly kitId?: string; readonly paths: readonly string[]; readonly material: string };

/** The screen's kit edits, which the comms run on voice orders and bridge commands. */
export interface CompanionKitOps {
  /** Runs an order on the live scene; returns what the companion says. Staged (an AI's edit): shown, saved only on 'keep it'. */
  run(order: CompanionKitOrder, staged?: boolean): string;
  /** The companion's answer to "what is this?": the last ping, named. */
  describePing(): string;
  /** A kit's effective overrides to write as its shipped default, or why there is nothing to save. */
  defaultsFor(kitId?: string): { readonly key: string; readonly name: string; readonly overrides: Readonly<Record<string, unknown>> } | { readonly error: string };
  /** The bridge wrote the defaults: the page reads them from now on. */
  defaultsSaved(all: unknown): void;
}

/** The screen's drone controls (plan 50): standing orders, finds, and the edit history the comms drive. */
export interface CompanionDroneOps {
  /** Sets standing combat orders; `focus: 'ping'` means the monster last pinged. Returns what the drone says. */
  orders(patch: { readonly mode?: 'defend' | 'weapons-free' | 'hold-fire'; readonly cover?: 'left' | 'right' | 'rear'; readonly focus?: number | 'ping' | 'nearest' | 'biggest' | null }): string;
  /** Finds and marks the nearest thing of a category, and sends the drone to it. */
  scout(category: ScoutCategory): string;
  /** Cancels everything: back to formation, defend mode, no focus. */
  recall(): string;
  /** Undoes the last kit edit (one step), or rejects a staged proposal. */
  undo(): string;
  /** Commits a staged proposal from the bridge. */
  keep(): string;
  /** The fight as the bridge's telemetry carries it, or null. */
  snapshot(): Readonly<Record<string, unknown>> | null;
  /** Plan 51: decompiles an observed mechanic into presets (a proposal): what to say, and the result for the bridge. */
  /**
   * Plan 51: decompiles an observation of another game into presets, cut to what its profile lets cross. `live` (the player's
   * "bridge this game" order) puts it in force at once; otherwise it waits for "apply the mimic".
   */
  mimic(observation: unknown, profile?: BridgePermissionProfile | null, live?: boolean): { readonly said: string; readonly event: Readonly<Record<string, unknown>> | null };
  /** Plan 51 wave 2: the bridge closed: puts back everything its live mimics changed. */
  endLiveMimic(): string;
  /** Plan 51: puts the last mimic in force (the player's words only). */
  applyMimic(): string;
}

/**
 * The AI's eyes and the linked game window (plan 50 §6, docs/GAME_IN_GAME_STREAMING_RESEARCH.md Stage 0): another game's
 * window mirrored on a screen in the world, and frames of what the player sees sent to the bridge for the AI to look at.
 */
export interface CompanionScreenOps {
  /** Asks the browser for a window to mirror (needs the player's click: the picker is the browser's). */
  link(): Promise<string>;
  unlink(): string;
  linked(): boolean;
  /** JPEG frames of the player's view and of the linked window, if any. */
  frames(): Promise<readonly { readonly source: 'game' | 'external'; readonly blob: Blob }[]>;
}

export interface CompanionChatProps {
  readonly companion: CompanionEntity | null;
  readonly onBroadcastRadio?: (text: string) => void;
  /** The player's live pose and the landmarks the game can currently locate. */
  readonly getContext?: () => { readonly player: CompanionPlayerPose; readonly landmarks: CompanionLandmarks };
  /** Filled with the comms' handle once mounted (the screen's ping speaks and posts through it). */
  readonly handleRef?: React.MutableRefObject<CompanionChatHandle | null>;
  /** The screen's kit edits (plan 49); without them kit orders are answered, not run. */
  readonly kitOps?: CompanionKitOps;
  /** The screen's drone controls (plan 50). */
  readonly droneOps?: CompanionDroneOps;
  /** The AI's eyes and the linked game window (plan 50 §6). */
  readonly screenOps?: CompanionScreenOps;
}

/** How often the eyes send a frame while the bridge is linked. */
const EYES_EVERY_MS = 3000;

interface Message {
  readonly id: string;
  readonly sender: 'player' | 'companion';
  readonly text: string;
}

/** How long the comms count the bridge as linked after its last answer to a poll. */
const BRIDGE_GRACE_MS = 15000;

/**
 * The Neural Bridge's address: localhost:8220, or `?bridge=<port>` (the e2e runs its own bridge beside a live one). Only
 * while the game itself is on localhost, so a link to the hosted game can never send the player's words anywhere.
 */
export function companionBridgeUrl(location: { readonly hostname: string; readonly search: string }): string | null {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return null;
  const port = new URLSearchParams(location.search).get('bridge');
  if (port !== null) return /^\d{2,5}$/.test(port) ? `http://localhost:${port}` : null;
  return 'http://localhost:8220';
}

// ---- Radio audio: one shared context, a rising mic-open chirp and a falling squelch click ----
let sharedAudioCtx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedAudioCtx ??= new Ctor();
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function tone(freqA: number, freqB: number, seconds: number, gainPeak: number): void {
  const ctx = audioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqA, ctx.currentTime);
  osc.frequency.setValueAtTime(freqB, ctx.currentTime + seconds * 0.45);
  gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds + 0.01);
}

/** Mic keyed open: the rising two-tone astronaut-helmet chirp. */
export const playMicOpenChirp = (): void => tone(820, 1240, 0.09, 0.09);
/** Transmission closed: the falling squelch click. */
export const playSquelchClick = (): void => tone(1150, 480, 0.07, 0.07);
/** A ping went down (plan 49): a short high blip, above the radio's chirps so the two never read as one. */
export const playPingBlip = (): void => tone(1480, 1980, 0.12, 0.08);

/** Synthesizes the companion's voice; stale utterances are cancelled so speech never piles up. */
export function speakCompanionVoice(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  playMicOpenChirp();
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/\[.*?\]/g, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('David') || v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Guy'))
      ) ?? voices.find((v) => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
  }
}

/** Local small talk when no outside AI is on the bridge. Deterministic, keyword-flavored. */
function localChatReply(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('mine') || lower.includes('ore')) return 'I read copper and quartz deposits nearby. Point the rifle and I will assist.';
  if (lower.includes('build')) return 'The lattice is stable. Say where, and I will hold the line while you build.';
  if (lower.includes('thank')) return 'Always, Lead Architect.';
  return 'Copy that, Piskriek. Say "follow me", "float in front of me", "hold position", or send me to the gate, the rover or the bench.';
}

export const CompanionChat: React.FC<CompanionChatProps> = ({ companion, onBroadcastRadio, getContext, handleRef, kitOps, droneOps, screenOps }) => {
  const screenOpsRef = useRef(screenOps);
  screenOpsRef.current = screenOps;
  /** The AI's eyes: on by default while a bridge is linked (the owner wants the AI to see what he points at). */
  const [eyesOn, setEyesOn] = useState(true);
  const eyesOnRef = useRef(true);
  eyesOnRef.current = eyesOn;
  const [screenLinked, setScreenLinked] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setScreenLinked(screenOpsRef.current?.linked() ?? false), 1000);
    return () => window.clearInterval(t);
  }, []);
  const lastFrameAtRef = useRef(0);
  const droneOpsRef = useRef(droneOps);
  droneOpsRef.current = droneOps;
  const bridgeUrl = useRef<string | null>(null);
  if (bridgeUrl.current === null && typeof window !== 'undefined') bridgeUrl.current = companionBridgeUrl(window.location) ?? '';
  const kitOpsRef = useRef(kitOps);
  kitOpsRef.current = kitOps;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [txHold, setTxHold] = useState(false);
  const [bridgeLinked, setBridgeLinked] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'companion',
      text: 'Overwatch link established. Hold T to talk, Enter to type. Where shall we build?',
    },
  ]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const companionRef = useRef(companion);
  companionRef.current = companion;
  /**
   * Linked = the bridge answered a poll in the last 15 s, read from the poll itself (not React state), so a few slow frames
   * on the min-spec laptop never drop a ping or a spoken order on the floor.
   */
  const lastPollOkRef = useRef(0);
  const bridgeLinkedRef = useRef({ get current(): boolean { return Date.now() - lastPollOkRef.current < BRIDGE_GRACE_MS; } }).current;

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isOpen]);

  const postBridgeEvent = (event: Readonly<Record<string, unknown>>): void => {
    if (!bridgeLinkedRef.current || !bridgeUrl.current) return;
    void fetch(`${bridgeUrl.current}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, at: Date.now() }),
    }).catch(() => {});
  };

  const companionSays = (reply: string, spoken: string = reply): void => {
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-c-${prev.length}`, sender: 'companion', text: reply }]);
    companionRef.current?.say(reply, 5.0);
    onBroadcastRadio?.(reply);
    speakCompanionVoice(spoken);
    postBridgeEvent({ type: 'companion-say', text: reply });
  };

  // the screen's ping speaks and posts through the comms (plan 49)
  const companionSaysRef = useRef(companionSays);
  companionSaysRef.current = companionSays;
  const postBridgeEventRef = useRef(postBridgeEvent);
  postBridgeEventRef.current = postBridgeEvent;
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      say: (text, spoken) => companionSaysRef.current(text, spoken),
      post: (event) => postBridgeEventRef.current(event),
    };
    return () => { handleRef.current = null; };
  }, [handleRef]);

  /** Runs a kit order through the screen, or says why it cannot (plan 49). An order from the bridge is staged (plan 50 §5). */
  const runKitOrder = (order: CompanionKitOrder, staged = false): string =>
    kitOpsRef.current ? kitOpsRef.current.run(order, staged) : 'Kit edits need the play screen; I cannot reach the machine from here.';
  /** Runs a drone order through the screen, or says why it cannot (plan 50). */
  const drone = (f: (ops: CompanionDroneOps) => string): string =>
    droneOpsRef.current ? f(droneOpsRef.current) : 'The drone controls need the play screen.';

  // ---- Plan 51 wave 2: "bridge this game": find it, check its terms, stream what may cross, mimic it live ----
  /** The game being bridged: its profile (what may cross), and the telemetry mapping's accumulator when it has one. */
  const bridgeSessionRef = useRef<{
    gameId: string; title: string; process: string | null; profile: BridgePermissionProfile;
    acc: TelemetryAccumulator | null; unmappedSaid: boolean;
  } | null>(null);
  /** Puts a profile in force for the session (a checked one replaces the unchecked one) and says what may cross. */
  const applyBridgeProfile = (p: BridgePermissionProfile, process: string | null): void => {
    // the game's own telemetry is a floor rung: it streams whenever there is a mapping that says which fields are which
    const acc = p.telemetry ? createTelemetryAccumulator(p.telemetry) : null;
    bridgeSessionRef.current = { gameId: p.gameId, title: p.title, process, profile: p, acc, unmappedSaid: false };
    companionSays(`${profileLine(p)} Whatever I read of it goes straight onto you; "stop the bridge" puts everything back.`, `${p.title} is bridged. Its mechanics come across, never its art.`);
    postBridgeEvent({ type: 'bridge-active', gameId: p.gameId, title: p.title, verdict: p.verdict, channels: p.channels, streams: p.streams, mapped: acc !== null });
  };
  /** The player's order: finds the game on this PC (the name said, or the likeliest running game) and asks for a verdict. */
  const bridgeGame = async (name: string | null): Promise<void> => {
    const base = bridgeUrl.current;
    if (!bridgeLinkedRef.current || !base) {
      companionSays('Bridging another game needs the Neural Bridge running on this PC (node scripts/companion-bridge.mjs).');
      return;
    }
    let processes: string[] = [];
    try {
      const res = await fetch(`${base}/running-games`);
      const data = (await res.json()) as { processes?: unknown };
      processes = Array.isArray(data.processes) ? data.processes.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      companionSays('The bridge could not list what is running on this PC.');
      return;
    }
    const known = KNOWN_BRIDGE_GAMES.map((g) => ({ tokens: g.processTokens, title: g.displayName }));
    const ranked = rankRunningGames(processes, name, known);
    // with no name said, only a known engine or the one candidate is a safe guess; otherwise the drone asks which
    if (!name && ranked.length > 1 && ranked[0]!.score < 6) {
      companionSays(`I see ${ranked.slice(0, 4).map((c) => c.title).join(', ')} running. Which one? Say "bridge <name>".`);
      return;
    }
    // a name the player said that no running process matches is still bridged by that name (its telemetry may come in)
    const pick = ranked[0] && (!name || ranked[0].score >= 20) ? ranked[0] : null;
    const title = pick?.title ?? name;
    if (!title) {
      companionSays('I do not see a game running. Start it, or tell me its name: "bridge <name>".');
      return;
    }
    const gameId = pick?.gameId ?? gameIdOf(title);
    const process = pick?.process ?? null;
    // the session starts at once on the unchecked profile (mechanics through the floor), so the bridge works out of the box;
    // an AI's checked verdict, when it comes, widens or narrows the rest
    endBridgeSession(false);
    applyBridgeProfile(uncheckedProfile(title, gameId), process);
    let checked = false;
    try {
      const res = await fetch(`${base}/bridge-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, title, process }),
      });
      checked = ((await res.json()) as { known?: boolean }).known === true;
    } catch { /* the session already runs on the unchecked profile */ }
    if (!checked && bridgeSessionRef.current?.gameId === gameId) companionSays(`Asking the AI on the bridge to check ${title}'s terms for anything beyond mechanics.`);
  };
  /** Ends the session; `say` false when a new bridge replaces it. Whatever its mimics changed goes back. */
  const endBridgeSession = (say = true): void => {
    const s = bridgeSessionRef.current;
    bridgeSessionRef.current = null;
    const undone = droneOpsRef.current?.endLiveMimic() ?? '';
    if (s) postBridgeEvent({ type: 'bridge-closed', gameId: s.gameId });
    if (say) companionSays(s ? `Unbridged from ${s.title}. ${undone}` : 'No game is bridged.');
  };

  /** "Save as default": the bridge writes the kit's overrides into the shipped defaults file (plan 49). */
  const saveKitDefault = async (kitId?: string): Promise<void> => {
    const ops = kitOpsRef.current;
    if (!ops) {
      companionSays('Kit edits need the play screen; nothing to save from here.');
      return;
    }
    const d = ops.defaultsFor(kitId);
    if ('error' in d) {
      companionSays(d.error);
      return;
    }
    if (!bridgeLinkedRef.current || !bridgeUrl.current) {
      companionSays(`The ${d.name} keeps the change on your save. Start the Neural Bridge to write it as the shipped default.`);
      return;
    }
    try {
      const res = await fetch(`${bridgeUrl.current}/kit-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: d.key, overrides: d.overrides }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; defaults?: unknown; file?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `bridge answered ${res.status}`);
      ops.defaultsSaved(data.defaults);
      companionSays(`Saved as the default for the ${d.name}. It ships with the next build once kit-defaults.json is committed.`, `Saved as the default for the ${d.name}.`);
      postBridgeEvent({ type: 'kit-default-saved', key: d.key, file: data.file ?? null });
    } catch (err) {
      companionSays(`The bridge did not take the default: ${err instanceof Error ? err.message : String(err)}.`);
    }
  };

  const sendRef = useRef<(text: string) => void>(() => {});
  sendRef.current = (userText: string): void => {
    const trimmed = userText.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-u-${prev.length}`, sender: 'player', text: trimmed }]);
    setInput('');
    const intent = parseCompanionIntent(trimmed);
    // the intent rides along, so an agent on the bridge leaves the orders the game ran itself alone
    postBridgeEvent({ type: 'player-say', text: trimmed, intent: intent.kind });

    const comp = companionRef.current;
    const ctx = getContext?.() ?? { player: { x: 0, z: 0, yaw: 0 }, landmarks: {} };

    window.setTimeout(() => {
      switch (intent.kind) {
        case 'kit-strip-hazard': companionSays(runKitOrder({ kind: 'strip-hazard' })); return;
        case 'kit-restore-hazard': companionSays(runKitOrder({ kind: 'restore-hazard' })); return;
        case 'kit-reset': companionSays(runKitOrder({ kind: 'reset' })); return;
        case 'kit-save-default': void saveKitDefault(); return;
        case 'ping-what': companionSays(kitOpsRef.current?.describePing() ?? 'Ping something first: middle mouse, or Q.'); return;
        case 'combat-mode': companionSays(drone((o) => o.orders({ mode: intent.mode }))); return;
        case 'focus': companionSays(drone((o) => o.orders({ focus: intent.target }))); return;
        case 'cover': companionSays(drone((o) => o.orders({ cover: intent.side }))); return;
        case 'scout': companionSays(drone((o) => o.scout(intent.category))); return;
        case 'recall': companionSays(drone((o) => o.recall())); return;
        case 'undo': companionSays(drone((o) => o.undo())); return;
        case 'keep': companionSays(drone((o) => o.keep())); return;
        case 'mimic-apply': companionSays(drone((o) => o.applyMimic())); return;
        case 'bridge-game': void bridgeGame(intent.name); return;
        case 'bridge-stop': endBridgeSession(); return;
        default: break;
      }
      if (intent.kind === 'status') {
        const s = comp?.getState();
        companionSays(
          s
            ? `Status: ${s.state.toUpperCase()}${s.hover ? ' · AIRBORNE' : ''}. Position X=${s.x.toFixed(1)}, Z=${s.z.toFixed(1)}, altitude ${(s.y).toFixed(1)} m. Bridge ${bridgeLinkedRef.current ? 'LINKED' : 'local'}.`
            : 'Companion body still materializing — telemetry in a moment.'
        );
        return;
      }
      if (intent.kind === 'chat') {
        if (bridgeLinkedRef.current) {
          // an outside AI is on the bridge: it reads the player-say event and answers via /command
          companionSays('Relaying to the overwatch intelligence on the bridge…');
        } else {
          companionSays(localChatReply(trimmed));
        }
        return;
      }
      const order = resolveCompanionOrder(intent, ctx.player, ctx.landmarks);
      if (intent.kind === 'gesture') comp?.playGesture(intent.gesture);
      else if (order.follow) comp?.followPlayer();
      else if (intent.kind === 'ground') comp?.ground();
      else if (order.hover && order.target) comp?.hoverAt(order.target.x, order.target.z);
      else if (order.hover) comp?.hoverHold();
      else if (order.hold) comp?.holdPosition();
      else if (order.target) comp?.goto(order.target.x, order.target.z);
      companionSays(order.reply);
    }, 300);
  };

  // ---- Push-to-talk: HOLD T keys the mic, release sends. Never opens the panel. ----
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef('');
  const txHoldRef = useRef(false);

  const startPtt = (): void => {
    if (txHoldRef.current) return;
    txHoldRef.current = true;
    transcriptRef.current = '';
    setTxHold(true);
    playMicOpenChirp();

    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!Ctor) return; // the TX pill still shows the hold; there is just no mic on this browser
    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: { results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }> }) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) text += event.results[i]?.[0]?.transcript ?? '';
        transcriptRef.current = text.trim();
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        const said = transcriptRef.current;
        transcriptRef.current = '';
        if (said) sendRef.current(said);
      };
      recognition.onerror = () => {};
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  };

  const stopPtt = (): void => {
    if (!txHoldRef.current) return;
    txHoldRef.current = false;
    setTxHold(false);
    playSquelchClick();
    try {
      recognitionRef.current?.stop(); // onend fires and sends the transcript
    } catch {
      recognitionRef.current = null;
    }
  };

  // ---- Keys: hold T = radio, Enter opens the panel, Esc closes. Nothing else. ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (e.code === 'Escape' && isOpenRef.current) {
        setIsOpen(false);
        return;
      }
      if (isInputActive) return;
      if (e.code === 'KeyT' && !e.repeat) {
        e.preventDefault();
        startPtt();
        return;
      }
      if (e.code === 'Enter' && !isOpenRef.current) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'KeyT') stopPtt();
    };
    const onBlur = (): void => stopPtt();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      try { recognitionRef.current?.stop(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Neural Bridge link: lets any outside AI read the conversation and drive the companion ----
  useEffect(() => {
    const base = bridgeUrl.current;
    if (!base) return;
    let alive = true;
    let failures = 0;
    let timer = 0;
    type BridgeCommand = {
      action?: string; text?: string; target?: { x: number; z: number }; gesture?: string;
      // plan 49 kit commands
      kitId?: string; partId?: string; paths?: string[]; material?: string; mutation?: string;
      /** plan 50: ignored: an AI's kit edit is always staged for the player's 'keep it' */
      stage?: boolean;
    };
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
    /** A bridge kit command as a kit order, or null when it is not one (or is malformed). */
    const kitOrderOf = (cmd: BridgeCommand): CompanionKitOrder | null => {
      const kitId = str(cmd.kitId);
      const paths = Array.isArray(cmd.paths) ? cmd.paths.filter((p): p is string => typeof p === 'string') : str(cmd.partId) ? [cmd.partId as string] : undefined;
      if (cmd.action === 'override-kit-part') {
        const material = str(cmd.material);
        if (!material || !paths || paths.length === 0) return null;
        return { kind: 'set-material', paths, material, ...(kitId ? { kitId } : {}) };
      }
      if (cmd.action === 'mutate-kit-preset') {
        if (cmd.mutation === 'strip-hazard') return { kind: 'strip-hazard', ...(kitId ? { kitId } : {}), ...(str(cmd.partId) ? { partId: cmd.partId as string } : {}) };
        if (cmd.mutation === 'restore-hazard') return { kind: 'restore-hazard', ...(kitId ? { kitId } : {}) };
        if (cmd.mutation === 'reset') return { kind: 'reset', ...(kitId ? { kitId } : {}), ...(paths ? { paths } : {}) };
      }
      return null;
    };
    const applyCommand = (cmd: BridgeCommand): void => {
      if (!cmd.action) return;
      if (cmd.action === 'say' && cmd.text) {
        companionSays(cmd.text);
        return;
      }
      // plan 49: kit edits on what Piskriek pinged (or the kit named), and "save as default"
      // plan 51: a mechanic observed in another game on the PC, decompiled by the harness. Applying it is the player's word:
      // "apply the mimic", or the "bridge this game" order, which makes every observation of that game go straight in
      if (cmd.action === 'mimic') {
        const o = droneOpsRef.current;
        if (!o) return;
        const observation = (cmd as unknown as { observation?: unknown }).observation;
        // the bridged game's profile gates it (another game's observation is gated by the unchecked profile)
        const s = bridgeSessionRef.current;
        const game = typeof (observation as { game?: unknown })?.game === 'string' ? (observation as { game: string }).game : '';
        const ours = s !== null && (gameIdOf(game) === s.gameId || game === s.title);
        const r = o.mimic(observation, ours ? s.profile : null, ours);
        companionSays(r.said);
        if (r.event) postBridgeEvent(r.event);
        return;
      }
      // plan 51 wave 2: an AI's verdict on a game's terms (or the scripted agent's honest "not checked")
      if (cmd.action === 'bridge-profile') {
        const p = checkBridgeProfile((cmd as unknown as { profile?: unknown }).profile);
        if (!p) {
          companionSays('A bridge profile came in that I could not read, so nothing crosses.');
          return;
        }
        // only for the game the player ordered bridged: an AI cannot open a bridge (and its live mimic) by itself
        const s = bridgeSessionRef.current;
        if (!s || s.gameId !== p.gameId) return;
        // a second "not checked" adds nothing unless it brings a telemetry mapping (it would only reset the samples)
        if (p.verdict === 'unchecked' && s.profile.verdict === 'unchecked' && !p.telemetry) return;
        applyBridgeProfile(p, s.process);
        return;
      }
      // plan 51 wave 2: the bridged game's own telemetry (a floor rung: every game allows it), mapped through its preset
      // into samples; each full batch becomes an observation the harness mimics live
      if (cmd.action === 'telemetry') {
        const t = cmd as unknown as { gameId?: string; payload?: unknown; at?: number };
        const s = bridgeSessionRef.current;
        if (!s || s.gameId !== t.gameId) return;
        if (!s.acc) {
          if (!s.unmappedSaid) {
            s.unmappedSaid = true;
            companionSays(`Telemetry is arriving from ${s.title}, but nobody has told me which of its fields are position, shots or events yet. An AI on the bridge can send a mapping with its profile.`);
          }
          return;
        }
        s.acc.push(t.payload, typeof t.at === 'number' ? t.at : 0);
        if (s.acc.size() >= TELEMETRY_BATCH) {
          const obs = s.acc.take(s.title, 'telemetry');
          const o = droneOpsRef.current;
          if (obs && o) {
            const r = o.mimic(obs, s.profile, true);
            companionSays(r.said);
            if (r.event) postBridgeEvent(r.event);
          }
        }
        return;
      }
      // plan 50 review: shipping a default changes the game for everyone, so only the player's own words do it; the AI asks
      if (cmd.action === 'save-kit-default') {
        companionSays(`${cmd.text ? `${cmd.text} ` : ''}The AI on the bridge suggests saving this kit as the shipped default. Say "save as default" if you want that.`);
        return;
      }
      // plan 50: the drone's orders from an AI on the bridge
      const o = droneOpsRef.current;
      // ("keep" is the player's word alone: the bridge cannot approve its own proposal)
      if (o && (cmd.action === 'engage' || cmd.action === 'focus' || cmd.action === 'cover' || cmd.action === 'scout' || cmd.action === 'find' || cmd.action === 'recall' || cmd.action === 'undo')) {
        const c = cmd as unknown as { mode?: string; target?: unknown; side?: string; category?: string };
        const said =
          cmd.action === 'engage' ? o.orders({ mode: c.mode === 'hold-fire' || c.mode === 'defend' ? c.mode : 'weapons-free' })
          : cmd.action === 'focus' ? o.orders({ focus: typeof c.target === 'number' || c.target === 'nearest' || c.target === 'biggest' || c.target === null ? (c.target as number | 'nearest' | 'biggest' | null) : 'ping' })
          : cmd.action === 'cover' ? o.orders({ cover: c.side === 'left' || c.side === 'rear' ? c.side : 'right' })
          : cmd.action === 'scout' || cmd.action === 'find' ? o.scout((c.category ?? 'enemies') as ScoutCategory)
          : cmd.action === 'recall' ? o.recall()
          : o.undo();
        if (said) companionSays(cmd.text ? `${cmd.text} ${said}` : said);
        return;
      }
      if (cmd.action === 'override-kit-part' || cmd.action === 'mutate-kit-preset') {
        const order = kitOrderOf(cmd);
        // an edit from the bridge is always staged for the player's yes
        const said = order ? runKitOrder(order, true) : `I could not read that kit command (${cmd.action}): it needs a kit part and a material, or a mutation.`;
        companionSays(cmd.text ? `${cmd.text} ${said}` : said);
        postBridgeEvent({ type: 'kit-result', action: cmd.action, result: said });
        return;
      }
      const comp = companionRef.current;
      if (!comp) return;
      comp.executeCommand(cmd as Parameters<CompanionEntity['executeCommand']>[0]);
      if (cmd.text) companionSays(cmd.text);
    };
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`${base}/poll`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { commands?: unknown[] };
        failures = 0;
        lastPollOkRef.current = Date.now();
        setBridgeLinked(true);
        for (const cmd of data.commands ?? []) applyCommand(cmd as Parameters<typeof applyCommand>[0]);
        const ctx = getContext?.();
        const s = companionRef.current?.getState();
        if (ctx && s) postBridgeEvent({ type: 'telemetry', player: ctx.player, companion: { x: s.x, y: s.y, z: s.z, state: s.state, hover: s.hover }, combat: droneOpsRef.current?.snapshot() ?? null });
        // the eyes: a frame of the view (and of a linked window) every few seconds, for the AI to look at
        const so = screenOpsRef.current;
        if (so && eyesOnRef.current && Date.now() - lastFrameAtRef.current >= EYES_EVERY_MS) {
          lastFrameAtRef.current = Date.now();
          void so.frames().then((frames) => {
            for (const f of frames) {
              void fetch(`${base}/frame?source=${f.source}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: f.blob }).catch(() => {});
            }
          });
        }
      } catch {
        failures++;
        if (failures >= 3 && !bridgeLinkedRef.current) setBridgeLinked(false);
      }
      if (alive) timer = window.setTimeout(() => void poll(), bridgeLinkedRef.current ? 1500 : 10000);
    };
    void poll();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {txHold && (
        <div className="companion-tx-pill" data-testid="companion-tx-indicator" role="status" aria-label="Transmitting">
          <span className="companion-tx-mic" aria-hidden="true" />
          TX · TRANSMITTING…
        </div>
      )}

      <button
        className="companion-chat-toggle"
        data-testid="companion-comms-toggle"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle Companion Comms (Enter to type, hold T to talk)"
      >
        <span className="companion-chat-orb" />
        <span>COMMS · OVERWATCH [Enter]</span>
      </button>

      {isOpen && (
        <div className="companion-chat-panel" data-testid="companion-comms-panel">
          <div className="companion-chat-header">
            <div className="companion-chat-title">
              <span className="companion-chat-orb" />
              Overwatch <span>Co-Builder</span>
              <em className={`companion-bridge-badge${bridgeLinked ? ' linked' : ''}`} data-testid="companion-bridge-badge">
                {bridgeLinked ? 'BRIDGE LINKED' : 'LOCAL'}
              </em>
            </div>
            <button className="companion-chat-close" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="companion-chat-log" ref={logRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.sender}`}>
                {m.text}
              </div>
            ))}
          </div>

          <div className="companion-chat-chips">
            <button className="companion-chip" onClick={() => sendRef.current('Follow me')}>
              🚶 Follow
            </button>
            <button className="companion-chip" onClick={() => sendRef.current('Float in front of me')}>
              🛸 Float ahead
            </button>
            <button className="companion-chip" onClick={() => sendRef.current('Hold position')}>
              🛡 Hold
            </button>
            <button className="companion-chip" onClick={() => sendRef.current('Status report')}>
              📊 Status
            </button>
            {screenOps && (
              <button
                className={`companion-chip${screenLinked ? ' on' : ''}`}
                data-testid="companion-link-screen"
                title="Mirror another window (a game running on this PC) on a screen in the world"
                onClick={() => {
                  if (screenLinked) companionSays(screenOps.unlink());
                  else void screenOps.link().then((said) => companionSays(said));
                }}
              >
                📺 {screenLinked ? 'Unlink window' : 'Link window'}
              </button>
            )}
            {screenOps && (
              <button
                className={`companion-chip${eyesOn ? ' on' : ''}`}
                data-testid="companion-eyes"
                title="Send what you see to the AI on the bridge every few seconds"
                onClick={() => setEyesOn((on) => !on)}
              >
                👁 Eyes {eyesOn ? 'on' : 'off'}
              </button>
            )}
          </div>

          <div className="companion-chat-input-row">
            <input
              type="text"
              className="companion-chat-input"
              placeholder="Type an order… (hold T anywhere to speak)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendRef.current(input);
              }}
              autoFocus
            />
            <button
              className={`companion-mic-btn ${txHold ? 'active' : ''}`}
              title="Hold to talk (or hold T)"
              onPointerDown={startPtt}
              onPointerUp={stopPtt}
              onPointerLeave={stopPtt}
            >
              🎙️ {txHold ? 'TX…' : 'Hold'}
            </button>
            <button className="companion-send-btn" onClick={() => sendRef.current(input)}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};
