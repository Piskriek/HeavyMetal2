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
import './companion-chat.css';

export interface CompanionChatProps {
  readonly companion: CompanionEntity | null;
  readonly onBroadcastRadio?: (text: string) => void;
  /** The player's live pose and the landmarks the game can currently locate. */
  readonly getContext?: () => { readonly player: CompanionPlayerPose; readonly landmarks: CompanionLandmarks };
}

interface Message {
  readonly id: string;
  readonly sender: 'player' | 'companion';
  readonly text: string;
}

const BRIDGE_URL = 'http://localhost:8220';

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

export const CompanionChat: React.FC<CompanionChatProps> = ({ companion, onBroadcastRadio, getContext }) => {
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
  const bridgeLinkedRef = useRef(false);
  bridgeLinkedRef.current = bridgeLinked;

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isOpen]);

  const postBridgeEvent = (event: Record<string, unknown>): void => {
    if (!bridgeLinkedRef.current) return;
    void fetch(`${BRIDGE_URL}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, at: Date.now() }),
    }).catch(() => {});
  };

  const companionSays = (reply: string): void => {
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-c-${prev.length}`, sender: 'companion', text: reply }]);
    companionRef.current?.say(reply, 5.0);
    onBroadcastRadio?.(reply);
    speakCompanionVoice(reply);
    postBridgeEvent({ type: 'companion-say', text: reply });
  };

  const sendRef = useRef<(text: string) => void>(() => {});
  sendRef.current = (userText: string): void => {
    const trimmed = userText.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-u-${prev.length}`, sender: 'player', text: trimmed }]);
    setInput('');
    postBridgeEvent({ type: 'player-say', text: trimmed });

    const comp = companionRef.current;
    const ctx = getContext?.() ?? { player: { x: 0, z: 0, yaw: 0 }, landmarks: {} };
    const intent = parseCompanionIntent(trimmed);

    window.setTimeout(() => {
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
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    let alive = true;
    let failures = 0;
    let timer = 0;
    const applyCommand = (cmd: { action?: string; text?: string; target?: { x: number; z: number }; gesture?: string }): void => {
      const comp = companionRef.current;
      if (!comp || !cmd.action) return;
      if (cmd.action === 'say' && cmd.text) {
        companionSays(cmd.text);
        return;
      }
      comp.executeCommand(cmd as Parameters<CompanionEntity['executeCommand']>[0]);
      if (cmd.text) companionSays(cmd.text);
    };
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`${BRIDGE_URL}/poll`, { signal: AbortSignal.timeout(1200) });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { commands?: unknown[] };
        failures = 0;
        if (!bridgeLinkedRef.current) setBridgeLinked(true);
        for (const cmd of data.commands ?? []) applyCommand(cmd as Parameters<typeof applyCommand>[0]);
        const ctx = getContext?.();
        const s = companionRef.current?.getState();
        if (ctx && s) postBridgeEvent({ type: 'telemetry', player: ctx.player, companion: { x: s.x, y: s.y, z: s.z, state: s.state, hover: s.hover } });
      } catch {
        failures++;
        if (failures >= 3 && bridgeLinkedRef.current) setBridgeLinked(false);
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
