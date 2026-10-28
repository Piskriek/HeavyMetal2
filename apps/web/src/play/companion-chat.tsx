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
import type { DreamCue } from '@hm/harness';
import { checkCues, higherSelfWords, type DronePerspective } from './drone-memory';
import {
  antiCheatAdvice, bridgeManifest, bridgePresetFor, checkBridgeProfile, createCadenceAnalyzer, RELAY_CONFIRM_WORD, relayAllowed, relayCommand, relayConsentOk, manifestLine, PRESET_SIGNATURES, readRaw, createEventAnonymizer, createTelemetryAccumulator, parseCadenceLine, gameIdOf, profileLine, rankRunningGames, uncheckedProfile,
  type BridgePermissionProfile, type CadenceAnalyzer, type DocumentedMechanics, type InputRelaySpec, type RelayAction, type EventClass, type TelemetryAccumulator,
} from '@hm/gamebridge';

/** Plan 51 wave 2: this many telemetry samples (about 10 s of a 30 Hz feed) make one observation for the harness... */
const TELEMETRY_BATCH = 300;
/** ...or this many seconds of the game's time with a few samples in it, for a slow or sparse feed (a game that posts on change). */
const TELEMETRY_SPAN_S = 10;
/** A trajectory from a slow feed closes after this long once it holds enough samples for a gravity fit. */
const TRAJECTORY_SPAN_S = 20;
const TRAJECTORY_MIN = 150;
/** Plan 51 wave 3: this many cadence-sampler samples (about 8 s at 200 Hz) make one input-audio observation. */
const CADENCE_WINDOW = 1600;
/** A live bridge's refinements speak at most this often (the bridge still gets every result). */
const LIVE_SAY_GAP_MS = 20000;
import './companion-chat.css';

/** What the screen can do through the comms (plan 49): the ping's callout and its bridge event. */
export interface CompanionChatHandle {
  /** The companion says `text` on the radio (log, bubble, the bridge); `spoken` is what the voice reads, when shorter. */
  say(text: string, spoken?: string): void;
  /** Sends an event to the bridge when it is linked (a ping). */
  post(event: Readonly<Record<string, unknown>>): void;
  /** Plan 53: the player's own press, relayed into the bridged game only if they turned the relay on. */
  relay(action: RelayAction, phase: 'down' | 'up'): void;
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
  /** Plan 51 wave 3: opens the Mimic Reflex Slot for a live bridge (event classes from the game's mapping). */
  reflexStart(classes?: Readonly<Record<string, EventClass>>): void;
  /** Feeds the bridged game's events to the slot as they happen; returns the reflexes that ran. */
  reflex(events: readonly string[]): readonly string[];
  /** Plan 53: the bridge stage (a bare "bridge"): the pad on an empty stretch of the Moon, the stand-ins, and back again. */
  enterBridgeStage(): string;
  exitBridgeStage(): string;
  /** The FIDELITY stand-ins for what the game says: its weapon class picks the gun; its documented constants the movement. */
  bridgeStandIns(info: { readonly weaponClass?: string | null; readonly documented?: DocumentedMechanics }): void;
  /** The game's live state on FIDELITY's HUD (null takes it down). */
  bridgeHud(title: string, state: Readonly<Record<string, string | number>> | null): void;
  stageStatus(): {
    readonly onStage: boolean; readonly weaponClass: string | null; readonly pictureLinked: boolean;
    readonly measured: { readonly movement: boolean; readonly fire: boolean; readonly rules: number };
    readonly standIns: { readonly movement: string; readonly enemies: string; readonly world: string };
  };
  /** Plan 51: puts the last mimic in force (the player's words only). */
  applyMimic(): string;
  /**
   * Plan 53 §2.6: the mirror. `mask` is the bridged game's held keys (@hm/gamebridge MIRROR_KEYS bits) that the character
   * here presses too; 0 keeps the mirror on with nothing held; null turns it off and lets every mirrored key go.
   */
  mirror(mask: number | null): void;
  /** Plan 56 W6b: what the drone shows a Higher Self (its digest, its kundalini levels, the episodes worth a cue). */
  perspective(): DronePerspective;
  /** Plan 56 W6b: a Higher Self's cues, held for the next dream (they only bias what it replays); what to report. */
  higherSelfCue(cues: readonly DreamCue[]): string;
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
  /** Plan 53 §2.6: the linked window's picture small in a corner of the HUD (picture in picture), or not; what to say. */
  pip(on: boolean): string;
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
/** Events still go to a bridge that answered within this long (a stall must not drop a session's bridge-active). */
const BRIDGE_EVENT_GRACE_MS = 120000;

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

  /** Plan 51 wave 3: this comms instance on the bridge (two FIDELITY tabs can share one bridge: the self-bridge). */
  const clientIdRef = useRef(`c${Math.floor(performance.now() * 1000).toString(36)}${Math.floor(performance.timeOrigin % 1e9).toString(36)}`);
  const postBridgeEvent = (event: Readonly<Record<string, unknown>>): void => {
    // posted whenever the bridge answered a poll in the last two minutes: a long frame (the world loading far away on the
    // min-spec laptop) can outlast the link's 15 s grace, and an event dropped then (a bridge-active) loses a whole session
    if (!bridgeUrl.current || Date.now() - lastPollOkRef.current > BRIDGE_EVENT_GRACE_MS) return;
    void fetch(`${bridgeUrl.current}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, client: clientIdRef.current, at: Date.now() }),
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
      relay: (action, phase) => relayPressRef.current(action, phase),
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
    /** The session's event anonymizer when the game's names may not cross (labels stay stable across batches and live). */
    rename: ((name: string) => string) | null;
    /** The input-audio rung (the cadence sampler), a floor rung every bridged game gets. */
    cadence: CadenceAnalyzer;
    lastSaidAt: number;
    /** Plan 53: the game's live state for FIDELITY's HUD (its mapping's `hud` paths). */
    hudState: Record<string, string | number>;
  } | null>(null);
  /** Plan 53: the process list the last bridge order saw (anti-cheat detection), and the anti-cheat line said for it. */
  const lastProcessesRef = useRef<readonly string[]>([]);
  const antiCheatSaidRef = useRef('');

  // ---- Plan 53: the input relay, the player's own choice (owner: "we don't judge... click a box and write a word") ----
  const [relayDialog, setRelayDialog] = useState<{ readonly gameId: string; readonly title: string; readonly warning: string; readonly limits: readonly string[]; readonly spec: InputRelaySpec; readonly process: string | null } | null>(null);
  const [relayTicked, setRelayTicked] = useState(false);
  const [relayTyped, setRelayTyped] = useState('');
  /** The relay while it is on: the token only this tab holds (never posted to the bridge's events). */
  const relayRef = useRef<{ readonly gameId: string; readonly token: string; readonly spec: InputRelaySpec } | null>(null);
  const closeRelayDialog = (line?: string): void => {
    setRelayDialog(null);
    setRelayTicked(false);
    setRelayTyped('');
    if (line) companionSays(line);
  };
  /**
   * "Relay my input": opens the consent for the bridged game (it never turns on by itself), and only for a game that allows
   * input from outside (relayAllowed: a checked profile that declares a relay, no anti-cheat). Anywhere else nothing is sent
   * in, and the player is told how to play both at once instead.
   */
  const openRelayDialog = (): void => {
    const s = bridgeSessionRef.current;
    if (!s) { companionSays('Bridge a game first, then say "relay my input".'); return; }
    const allowed = relayAllowed(s.profile, lastProcessesRef.current);
    if (!allowed.ok) { companionSays(allowed.why); return; }
    const spec = allowed.spec;
    const warning = `${s.title} allows input from outside: ${spec.basis} No anti-cheat is known for it; if it has one after all, pressing into it from outside can get your account banned.`;
    const limits = [
      ...(spec.transport === 'console-tcp' ? [`Your presses go to its console on port ${spec.port}${spec.launchOption ? ` (start it with ${spec.launchOption})` : ''}.`] : ['Your presses go in as keys and mouse buttons, and only while its own window is in front; with any other window in front they are dropped.']),
      ...spec.notes,
    ];
    setRelayTicked(false);
    setRelayTyped('');
    setRelayDialog({ gameId: s.gameId, title: s.title, warning, limits, spec, process: s.process });
    companionSays(`Before I relay anything into ${s.title}: read the box, tick it, and type ${RELAY_CONFIRM_WORD}.`);
  };
  const armRelay = async (): Promise<void> => {
    const d = relayDialog;
    const base = bridgeUrl.current;
    if (!d || !base || !relayConsentOk({ ticked: relayTicked, typed: relayTyped })) return;
    try {
      const res = await fetch(`${base}/input-relay/arm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: d.gameId, ticked: relayTicked, typed: relayTyped, transport: d.spec.transport, port: d.spec.port, process: d.process, launchOption: d.spec.launchOption }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (!data.ok || !data.token) throw new Error(data.error ?? `the bridge answered ${res.status}`);
      relayRef.current = { gameId: d.gameId, token: data.token, spec: d.spec };
      postBridgeEvent({ type: 'relay-on', gameId: d.gameId, transport: d.spec.transport });
      closeRelayDialog(`Input relay on for ${d.title}, by your choice: your fire, use, jump and reload presses go across. "Stop the relay" turns it off.`);
    } catch (err) {
      closeRelayDialog(`The relay did not turn on: ${err instanceof Error ? err.message : String(err)}.`);
    }
  };
  const disarmRelay = (say: boolean): void => {
    const r = relayRef.current;
    relayRef.current = null;
    if (r && bridgeUrl.current) {
      void fetch(`${bridgeUrl.current}/input-relay/disarm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: r.gameId, token: r.token }) }).catch(() => {});
      postBridgeEvent({ type: 'relay-off', gameId: r.gameId });
    }
    if (say) companionSays(r ? 'Input relay off.' : 'The input relay was not on.');
  };
  /** One of the player's own presses, relayed only while the relay they chose is on. */
  const relayPress = (action: RelayAction, phase: 'down' | 'up'): void => {
    const r = relayRef.current;
    const base = bridgeUrl.current;
    if (!r || !base) return;
    const line = relayCommand(r.spec, action, phase);
    if (!line) return;
    void fetch(`${base}/input-relay/press`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: r.gameId, token: r.token, line }) }).catch(() => {});
  };
  const relayPressRef = useRef(relayPress);
  relayPressRef.current = relayPress;
  /** Plan 53: on the bridge stage, what crossed and what FIDELITY stands in for: to the bridge always, aloud when asked. */
  const postManifest = (say: boolean): void => {
    const s = bridgeSessionRef.current;
    const o = droneOpsRef.current;
    if (!s || !o) return;
    const st = o.stageStatus();
    if (!st.onStage) return;
    const aspects = bridgeManifest({ profile: s.profile, measured: st.measured, state: s.hudState, weaponClass: st.weaponClass, pictureLinked: st.pictureLinked, standIns: st.standIns });
    postBridgeEvent({ type: 'bridge-manifest', gameId: s.gameId, aspects });
    if (say) companionSays(manifestLine(aspects), 'What crosses, and what FIDELITY stands in for, is on the bridge.');
  };
  /** Puts a profile in force for the session (a checked one replaces the unchecked one) and says what may cross. */
  const applyBridgeProfile = (p: BridgePermissionProfile, process: string | null): void => {
    // the game's own telemetry is a floor rung: it streams whenever there is a mapping that says which fields are which
    const prev = bridgeSessionRef.current?.gameId === p.gameId ? bridgeSessionRef.current : null;
    const rename = p.streams.includes('entity-kinds') ? null : prev?.rename ?? createEventAnonymizer();
    const acc = p.telemetry ? createTelemetryAccumulator(p.telemetry, rename ? { rename } : {}) : null;
    bridgeSessionRef.current = { gameId: p.gameId, title: p.title, process, profile: p, acc, unmappedSaid: false, rename, cadence: prev?.cadence ?? createCadenceAnalyzer(), lastSaidAt: 0, hudState: prev?.hudState ?? {} };
    // the reflex slot opens with the bridge: the game's events drive the suit and the drone as they happen
    droneOpsRef.current?.reflexStart(p.telemetry?.eventClasses);
    companionSays(`${profileLine(p)} Whatever I read of it goes straight onto you; "stop the bridge" puts everything back.`, `${p.title} is bridged. Its mechanics come across, never its art.`);
    postBridgeEvent({ type: 'bridge-active', gameId: p.gameId, title: p.title, process, verdict: p.verdict, channels: p.channels, streams: p.streams, mapped: acc !== null });
    startMirror(p.gameId, p.title);
    // plan 53: an anti-cheat guarding the game (its profile, or its process running here) is said before anything else
    // crosses: the ban risk of what this bridge uses, and the modes where going deeper is safe
    const ac = antiCheatAdvice(p, lastProcessesRef.current);
    if (ac && antiCheatSaidRef.current !== `${p.gameId}:${ac.systems.join(',')}`) {
      antiCheatSaidRef.current = `${p.gameId}:${ac.systems.join(',')}`;
      companionSays(ac.line, `${p.title} runs ${ac.systems.join(' and ')}. What I use is safe; anything deeper only offline or on your own server.`);
      postBridgeEvent({ type: 'anti-cheat', gameId: p.gameId, systems: ac.systems, risks: ac.risks });
    }
    // plan 53: on the stage, its published constants and FIDELITY's stand-ins go in now, and the drone says which is which
    if (droneOpsRef.current?.stageStatus().onStage) {
      droneOpsRef.current.bridgeStandIns({ weaponClass: null, ...(p.documented ? { documented: p.documented } : {}) });
      postManifest(true);
    }
  };
  /** The player's order: finds the game on this PC (the name said, or the likeliest running game) and asks for a verdict. */
  const bridgeGame = async (name: string | null, stage = false): Promise<void> => {
    const base = bridgeUrl.current;
    if (!bridgeLinkedRef.current || !base) {
      companionSays('Bridging another game needs the Neural Bridge running on this PC (node scripts/companion-bridge.mjs).');
      return;
    }
    // plan 53: a bare "bridge" (nothing named) goes to the bridge stage first: an empty stretch of the Moon
    if (stage) {
      const line = droneOpsRef.current?.enterBridgeStage();
      if (line) companionSays(line);
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
    const known = [...PRESET_SIGNATURES, ...KNOWN_BRIDGE_GAMES.map((g) => ({ tokens: g.processTokens, title: g.displayName }))];
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
    endBridgeSession(false, stage);
    // a shipped preset (CS2, any FIDELITY game) is a checked profile with its telemetry mapping: no AI needed for it
    const preset = bridgePresetFor(gameId);
    lastProcessesRef.current = processes;
    applyBridgeProfile(preset ?? uncheckedProfile(title, gameId), process);
    if (preset) return;
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
  /** A live bridge's mimic result: always to the bridge, aloud at most every LIVE_SAY_GAP_MS (the first one always). */
  const liveMimic = (s: { lastSaidAt: number }, r: { readonly said: string; readonly event: Readonly<Record<string, unknown>> | null }): void => {
    if (r.event) postBridgeEvent(r.event);
    const now = Date.now();
    if (now - s.lastSaidAt >= LIVE_SAY_GAP_MS || r.event?.type !== 'mimic-result') {
      s.lastSaidAt = now;
      companionSays(r.said);
    }
  };
  /** A live mimic that fails says why on the bridge instead of vanishing in the poll loop. */
  const liveMimicSafe = (s: { lastSaidAt: number }, run: () => { readonly said: string; readonly event: Readonly<Record<string, unknown>> | null }): void => {
    try { liveMimic(s, run()); }
    catch (err) { postBridgeEvent({ type: 'mimic-error', message: err instanceof Error ? `${err.message} @ ${(err.stack ?? '').split(/\r?\n/)[1]?.trim() ?? ''}` : String(err) }); }
  };
  /** Plan 51 wave 3: the bridged game's events into the reflex slot; what ran is reported to the bridge (and said once). */
  const reflexSaidRef = useRef(new Set<string>());
  const feedReflexes = (gameId: string, names: readonly string[]): void => {
    const done = droneOpsRef.current?.reflex(names) ?? [];
    if (done.length === 0) return;
    postBridgeEvent({ type: 'reflex', gameId, events: names, done });
    const first = done.filter((d) => !reflexSaidRef.current.has(d.split(' ')[0]!));
    if (first.length) {
      for (const d of first) reflexSaidRef.current.add(d.split(' ')[0]!);
      companionSays(`Reflex from the bridge: ${first.join(', ')} (on ${names[0]}).`, 'Reflex.');
    }
  };
  /**
   * Ends the session; `say` false when a new bridge replaces it. Whatever its mimics changed goes back, and the bridge stage
   * with it (plan 53) unless `keepStage` (a new bare "bridge" on the stage).
   */
  // ---- Plan 53 §2.6: the mirror (owner, 28 Oct). The player plays the bridged game with their own hands, its window in
  // front; the bridge streams the keys they press there (read from Windows, never pressed into the game) and the character
  // here does the same, so they control both at once and look here for the output.
  const mirrorRef = useRef<{ readonly gameId: string; readonly es: EventSource; said: boolean } | null>(null);
  const stopMirror = (): void => {
    const m = mirrorRef.current;
    mirrorRef.current = null;
    if (!m) return;
    m.es.close();
    droneOpsRef.current?.mirror(null);
  };
  const startMirror = (gameId: string, title: string): void => {
    const base = bridgeUrl.current;
    if (!base || typeof EventSource === 'undefined' || mirrorRef.current?.gameId === gameId) return;
    stopMirror();
    const m = { gameId, es: new EventSource(`${base}/mirror?client=${clientIdRef.current}`), said: false };
    mirrorRef.current = m;
    // the mirror is on from the bridge's start: losing the mouse to the game's window must not pause FIDELITY
    droneOpsRef.current?.mirror(0);
    m.es.onmessage = (ev: MessageEvent): void => {
      let d: { gameId?: unknown; mask?: unknown };
      try { d = JSON.parse(String(ev.data)) as typeof d; } catch { return; }
      if (mirrorRef.current !== m || d.gameId !== gameId || typeof d.mask !== 'number') return;
      droneOpsRef.current?.mirror(d.mask);
      if (d.mask !== 0 && !m.said) {
        m.said = true;
        companionSays(
          `I see your presses in ${title}, and your character here does the same: read only, nothing is pressed into ${title}. Look here for the output. Keep ${title} small and beside FIDELITY, or on another screen, never over it: a covered window runs slow.`,
          `I mirror your ${title} presses here.`,
        );
        postBridgeEvent({ type: 'mirror-on', gameId });
      }
    };
  };
  /** "How do I play both at once": the game in front with the player's hands on it, FIDELITY beside it as the output. */
  const playBesideLine = (): string => {
    const t = bridgeSessionRef.current?.title ?? 'the other game';
    return `To play both at once: run ${t} in a window (windowed in its video settings, 1280 by 720 or smaller) on a second screen or beside FIDELITY, never over it: Chrome slows a window that is covered. Bridge it, click into ${t} and play it with your own hands. I read your presses there, read only, and your character here does the same; looking around stays separate, so the view here holds steady. Say "picture in picture" and pick ${t}'s window, and its picture sits in a corner here, so you only need to watch FIDELITY.`;
  };
  /** "Picture in picture": shares the game's window if it is not shared yet (the browser's picker), then puts it in a corner. */
  const showPicture = async (): Promise<void> => {
    const so = screenOpsRef.current;
    if (!so) { companionSays('The picture needs the play screen.'); return; }
    if (!so.linked()) {
      const r = await so.link();
      if (!so.linked()) { companionSays(r); return; }
    }
    companionSays(so.pip(true));
  };
  const endBridgeSession = (say = true, keepStage = false): void => {
    const s = bridgeSessionRef.current;
    bridgeSessionRef.current = null;
    stopMirror();
    const undone = droneOpsRef.current?.endLiveMimic() ?? '';
    const back = keepStage ? '' : droneOpsRef.current?.exitBridgeStage() ?? '';
    // the relay ends with the bridge it was chosen for (the bridge disarms it too, on bridge-closed)
    if (relayRef.current) disarmRelay(false);
    if (s) postBridgeEvent({ type: 'bridge-closed', gameId: s.gameId });
    if (say) companionSays(s ? `Unbridged from ${s.title}. ${undone}${back ? ` ${back}` : ''}` : back || 'No game is bridged.');
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
        // plan 53: nothing named ("bridge", "bridge this game") goes to the bridge stage; a named game bridges in place
        case 'bridge-game': void bridgeGame(intent.name, intent.name === null); return;
        case 'bridge-stop': endBridgeSession(); return;
        case 'relay-on': openRelayDialog(); return;
        case 'relay-off': disarmRelay(true); return;
        // plan 53 §2.6: the bridged game's picture in a corner here (a shared window: read only), and how to play both at once
        case 'pip-on': void showPicture(); return;
        case 'pip-off': companionSays(screenOpsRef.current?.pip(false) ?? 'The picture needs the play screen.'); return;
        case 'play-beside': companionSays(playBesideLine()); return;
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
      // plan 51 wave 3: an edge from the cadence sampler (input or audio) or another observer, live, for the reflex slot
      if (cmd.action === 'game-event') {
        const g = cmd as unknown as { gameId?: string; names?: unknown };
        const s = bridgeSessionRef.current;
        if (!s || s.gameId !== g.gameId || !Array.isArray(g.names)) return;
        const names = g.names.filter((n): n is string => typeof n === 'string' && n.length <= 64).slice(0, 16);
        feedReflexes(s.gameId, s.rename ? names.map(s.rename) : names);
        return;
      }
      // plan 56 W6b: the Higher Self seat. An AI on the bridge reads the drone's perspective, cues its next dream and speaks
      // through it; it never writes the drone's memory (a cue only biases what the dream replays)
      if (cmd.action === 'higher-self-ask') {
        const o = droneOpsRef.current;
        if (o) postBridgeEvent({ type: 'ego-perspective', ...o.perspective() });
        return;
      }
      if (cmd.action === 'higher-self-cue') {
        const o = droneOpsRef.current;
        const cues = checkCues((cmd as unknown as { cues?: unknown }).cues);
        if (!o || !cues) { postBridgeEvent({ type: 'higher-self-cue-refused', why: o ? 'cues are 1 to 12 of the drone\'s own episodes: { of, t }' : 'the drone is not here' }); return; }
        postBridgeEvent({ type: 'higher-self-cue-taken', count: cues.length, said: o.higherSelfCue(cues) });
        return;
      }
      if (cmd.action === 'higher-self-say') {
        const words = higherSelfWords((cmd as unknown as { words?: unknown }).words);
        // the ego is the one voice: it says its Higher Self's reading, marked as such
        if (words) companionSays(`From my Higher Self: ${words}`, words);
        return;
      }
      // plan 51 wave 3: the cadence sampler's lines (the input-audio rung): edges go live to the reflex slot, and every
      // CADENCE_WINDOW samples with shots in them become a live mimic of the game's fire cadence
      if (cmd.action === 'cadence') {
        const c = cmd as unknown as { gameId?: string; lines?: unknown };
        const s = bridgeSessionRef.current;
        if (!s || s.gameId !== c.gameId || !Array.isArray(c.lines)) return;
        const edges: string[] = [];
        for (const line of c.lines.slice(0, 200)) {
          const smp = typeof line === 'string' ? parseCadenceLine(line) : null;
          if (smp) edges.push(...s.cadence.push(smp));
        }
        if (edges.length) feedReflexes(s.gameId, s.rename ? edges.map(s.rename) : edges);
        if (s.cadence.size() >= CADENCE_WINDOW) {
          const samples = s.cadence.size();
          const obs = s.cadence.take(s.title);
          // the window's counts, so an AI on the bridge can see the sampler working even when no shots were heard
          postBridgeEvent({ type: 'cadence-window', gameId: s.gameId, samples, shots: obs?.shots?.t.length ?? 0, edges: obs?.events?.length ?? 0 });
          const o = droneOpsRef.current;
          if (obs?.shots && o) { liveMimicSafe(s, () => o.mimic(obs, s.profile, true)); postManifest(false); }
        }
        return;
      }
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
        const made = s.acc.push(t.payload, typeof t.at === 'number' ? t.at : 0);
        if (made.length) feedReflexes(s.gameId, made.map((e) => e.name));
        // plan 53: the held weapon's class picks FIDELITY's stand-in gun; the game's state goes on FIDELITY's HUD
        const tm = s.profile.telemetry;
        if (tm?.weaponClass) {
          const c = readRaw(t.payload, tm.weaponClass);
          if (typeof c === 'string') droneOpsRef.current?.bridgeStandIns({ weaponClass: c });
        }
        if (tm?.hud) {
          const next: Record<string, string | number> = {};
          for (const [label, path] of Object.entries(tm.hud)) {
            const v = readRaw(t.payload, path);
            if (typeof v === 'number' || typeof v === 'string') next[label] = v;
            else if (typeof v === 'boolean') next[label] = v ? 'yes' : 'no';
          }
          if (JSON.stringify(next) !== JSON.stringify(s.hudState)) {
            const first = Object.keys(s.hudState).length === 0 && Object.keys(next).length > 0;
            s.hudState = next;
            droneOpsRef.current?.bridgeHud(s.title, Object.keys(next).length ? next : null);
            if (first) postManifest(false);
          }
        }
        // a trajectory wants a full batch (a gravity fit needs its jumps); shots and events alone close after a span of time
        const held = s.acc.counts();
        if (s.acc.size() >= TELEMETRY_BATCH || (s.acc.span() >= TELEMETRY_SPAN_S && s.acc.size() >= 12 && held.trajectory === 0)
          || (s.acc.span() >= TRAJECTORY_SPAN_S && held.trajectory >= TRAJECTORY_MIN)) {
          const obs = s.acc.take(s.title, 'telemetry');
          postBridgeEvent({ type: 'telemetry-batch', gameId: s.gameId, trajectory: obs?.trajectory?.t.length ?? 0, shots: obs?.shots?.t.length ?? 0, events: obs?.events?.length ?? 0 });
          const o = droneOpsRef.current;
          if (obs && o) { liveMimicSafe(s, () => o.mimic(obs, s.profile, true)); postManifest(false); }
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
        const res = await fetch(`${base}/poll?client=${clientIdRef.current}`, { signal: AbortSignal.timeout(4000) });
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

          {relayDialog ? (
            <section className="companion-relay-consent" aria-label={`Relay your presses into ${relayDialog.title}`} data-testid="relay-consent">
              <h3>Relay your presses into {relayDialog.title}</h3>
              <p className="relay-risk">{relayDialog.warning}</p>
              <p>Only your own fire, use, jump and reload presses cross, while you press them here. The drone never presses anything in another game.</p>
              {relayDialog.limits.map((l) => <p key={l} className="relay-limit">{l}</p>)}
              <label>
                <input type="checkbox" checked={relayTicked} onChange={(e) => setRelayTicked(e.target.checked)} data-testid="relay-tick" />
                <span>I understand this can get my account banned in {relayDialog.title}.</span>
              </label>
              <span className="relay-word">Type {RELAY_CONFIRM_WORD} to turn it on</span>
              <input type="text" value={relayTyped} onChange={(e) => setRelayTyped(e.target.value)} aria-label={`Type ${RELAY_CONFIRM_WORD} to turn the relay on`} data-testid="relay-word" />
              <div className="companion-relay-actions">
                <button type="button" disabled={!relayConsentOk({ ticked: relayTicked, typed: relayTyped })} onClick={() => void armRelay()} data-testid="relay-on">Turn on relay</button>
                <button type="button" className="relay-cancel" onClick={() => closeRelayDialog('Relay left off.')}>Cancel</button>
              </div>
            </section>
          ) : (
            <div className="companion-chat-log" ref={logRef}>
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.sender}`}>
                  {m.text}
                </div>
              ))}
            </div>
          )}

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
