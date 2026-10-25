/**
 * The Studio's agent relay (plan 40 §4): the dev server's half of the bridge.
 *
 * A browser cannot host stdio and cannot accept a socket, so the pieces meet in the middle:
 *
 *   agent ──stdio──> scripts/studio-agent-bridge.mjs ──HTTP──> (this relay) <──long-poll── the Studio page's window.studioAgent
 *
 * The page polls with its pairing key and answers what it is given; the bridge posts a tool call and waits for that answer. A call that
 * nobody answers inside `ttlMs` fails with a plain reason ("the Studio page is not connected"), which is what an agent should see
 * rather than a hang. Positions in the queue are per key, and only one page can hold a key at a time: a second poll with the same key
 * replaces the first (a reloaded tab), and a key that has seen no poll for `pageTtlMs` is considered gone.
 *
 * Pure bookkeeping: no sockets, no timers of its own, no clock — `now` arrives from the caller, so the relay is testable and the dev
 * server supplies `Date.now`.
 */
export interface RelayCall {
  readonly id: string;
  readonly tool: string;
  readonly args: unknown;
  readonly at: number;
}

export interface RelayAnswer {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly why?: string;
}

interface Pending {
  readonly call: RelayCall;
  readonly resolve: (a: RelayAnswer) => void;
  readonly timer: ReturnType<typeof setTimeout> | undefined;
}

/** The relay's state for one pairing key. */
interface KeyState {
  readonly waiting: RelayCall[];
  readonly pending: Map<string, Pending>;
  lastPoll: number;
}

export interface RelayOptions {
  /** How long a call waits for the page before it fails (ms). */
  readonly ttlMs?: number;
  /** How long a key with no poll is considered gone (ms). */
  readonly pageTtlMs?: number;
  readonly now?: () => number;
}

export class AgentRelay {
  private readonly keys = new Map<string, KeyState>();
  private seq = 0;
  private readonly ttlMs: number;
  private readonly pageTtlMs: number;
  private readonly now: () => number;

  constructor(o: RelayOptions = {}) {
    this.ttlMs = o.ttlMs ?? 30_000;
    this.pageTtlMs = o.pageTtlMs ?? 15_000;
    this.now = o.now ?? (() => Date.now());
  }

  /** A page says it is listening: it becomes the holder of `key` and gets anything already waiting. */
  poll(key: string): readonly RelayCall[] {
    const state = this.state(key);
    state.lastPoll = this.now();
    const out = state.waiting.splice(0, state.waiting.length);
    return out;
  }

  /** The bridge's tool call: queued for the page, and settled by `answer` or by the TTL. */
  call(key: string, tool: string, args: unknown): Promise<RelayAnswer> {
    if (!key) return Promise.resolve({ ok: false, why: 'a pairing key is required' });
    this.seq += 1;
    const call: RelayCall = { id: `call-${this.seq}`, tool, args, at: this.now() };
    const state = this.state(key);
    return new Promise<RelayAnswer>((resolve) => {
      const timer = setTimeout(() => {
        const hit = state.pending.get(call.id);
        if (!hit) return;
        state.pending.delete(call.id);
        resolve({ ok: false, why: `the Studio page did not answer '${tool}' within ${Math.round(this.ttlMs / 1000)} s` });
      }, this.ttlMs);
      // the timer is deliberately kept referenced: a call in flight must be able to settle (it is cleared the moment it does), and a
      // dev server's event loop is alive anyway. An unref'd timer here leaves the promise pending with nothing to wake it.
      state.pending.set(call.id, { call, resolve, timer });
      state.waiting.push(call);
    });
  }

  /** The page's answer to one call. An unknown or already-settled call id is ignored (a duplicate post is not an error). */
  answer(key: string, id: string, answer: RelayAnswer): boolean {
    const state = this.keys.get(key);
    const pending = state?.pending.get(id);
    if (!state || !pending) return false;
    state.pending.delete(id);
    if (pending.timer) clearTimeout(pending.timer);
    pending.resolve(answer);
    return true;
  }

  /** The person disconnected (or the page unloaded): every waiting call fails, and the key is forgotten. */
  drop(key: string, why = 'the Studio page disconnected'): number {
    const state = this.keys.get(key);
    if (!state) return 0;
    const settled = state.pending.size;
    for (const pending of state.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.resolve({ ok: false, why });
    }
    this.keys.delete(key);
    return settled;
  }

  /** What the page and the bridge can ask about a key (the Command Center shows this). */
  status(key: string): { readonly connected: boolean; readonly waiting: number; readonly inFlight: number } {
    const state = this.keys.get(key);
    if (!state) return { connected: false, waiting: 0, inFlight: 0 };
    const connected = this.now() - state.lastPoll <= this.pageTtlMs;
    return { connected, waiting: state.waiting.length, inFlight: state.pending.size };
  }

  /** Forgets keys nobody has polled for `pageTtlMs` (a closed tab). Returns the keys dropped. */
  prune(): readonly string[] {
    const now = this.now();
    const gone: string[] = [];
    for (const [key, state] of [...this.keys]) {
      if (state.pending.size === 0 && state.waiting.length === 0 && now - state.lastPoll > this.pageTtlMs) {
        this.keys.delete(key);
        gone.push(key);
      }
    }
    return gone;
  }

  private state(key: string): KeyState {
    let state = this.keys.get(key);
    if (!state) {
      state = { waiting: [], pending: new Map(), lastPoll: 0 };
      this.keys.set(key, state);
    }
    return state;
  }
}

export const AGENT_ROUTE = '/__studio/agent';
