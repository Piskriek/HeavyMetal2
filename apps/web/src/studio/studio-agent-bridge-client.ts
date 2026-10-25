/**
 * The Studio page's end of the agent bridge (plan 40 §4): a long poll of the dev server's relay, answered with `window.studioAgent`.
 *
 * The page cannot accept a socket, so it asks. Every `intervalMs` it asks `/__studio/agent/poll?key=...` whether an agent has called a
 * tool; when one is waiting it runs it on the installed agent API and posts the answer back. When the relay answers "nothing" the loop
 * simply asks again — a long poll, not a busy loop, because the dev server holds the request until there is something to say or until
 * it gives up.
 *
 * The client is transport-thin on purpose: it takes `fetch` and a sleep function so a node test drives it without a dev server, and it
 * reports what happened (`polls`, `answered`, `refused`) so the Studio's Changes panel can show a real connection state rather than a
 * hopeful one.
 */
import type { StudioAgentApi } from './studio-agent-page';

export interface BridgeClientOptions {
  /** The pairing key the person typed into their bridge. */
  readonly key: string;
  /** `window.studioAgent` (installed by `installStudioAgent`). */
  readonly api: () => StudioAgentApi | undefined;
  /** The dev route prefix (the relay's own constant, passed in so this file needs no dev-server import). */
  readonly route?: string;
  readonly fetchFn?: typeof fetch;
  readonly intervalMs?: number;
  /** Start asking immediately (the page's default). A test drives `tick()` itself instead. */
  readonly autoStart?: boolean;
  readonly onState?: (state: BridgeState) => void;
}

/** What the page has done for the agent so far. */
export interface BridgeState {
  readonly connecting: boolean;
  readonly polls: number;
  readonly answered: number;
  readonly refused: number;
  readonly lastWhy: string;
}

/** One tool call as the relay hands it over. */
interface RelayCall {
  readonly id: string;
  readonly tool: string;
  readonly args: unknown;
}

/** A running client: `stop()` ends the loop and tells the relay the page is gone. */
export interface BridgeClient {
  readonly state: () => BridgeState;
  readonly stop: () => Promise<void>;
  /** Runs one poll round by hand (the loop calls this; a test drives it directly). */
  readonly tick: () => Promise<BridgeState>;
}

const TOOL_ARITY: Readonly<Record<string, 'key' | 'key+args'>> = {
  'studio.doc.read': 'key+args',
  'studio.commands.list': 'key',
  'studio.changes.list': 'key',
  'studio.history.undo': 'key',
  'studio.history.redo': 'key',
  'studio.doc.propose': 'key+args',
  'studio.changes.accept': 'key+args',
  'studio.changes.reject': 'key+args',
  'studio.kit.validate': 'key+args',
  'studio.material.coverage': 'key+args',
  'studio.capture': 'key+args',
};

/** The API method a tool name maps to, or null when this build does not serve it. */
function methodFor(tool: string): keyof StudioAgentApi | null {
  switch (tool) {
    case 'studio.doc.read':
      return 'read';
    case 'studio.commands.list':
      return 'commands';
    case 'studio.changes.list':
      return 'changes';
    case 'studio.history.undo':
      return 'undo';
    case 'studio.history.redo':
      return 'redo';
    case 'studio.doc.propose':
      return 'propose';
    case 'studio.changes.accept':
      return 'accept';
    case 'studio.changes.reject':
      return 'reject';
    case 'studio.kit.validate':
      return 'validateKit';
    case 'studio.material.coverage':
      return 'materialCoverage';
    case 'studio.capture':
      return 'capture';
    default:
      return null;
  }
}

/** The arguments a tool takes, in the order the API wants them after the key. */
function argsFor(tool: string, args: unknown): unknown[] {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'studio.doc.read':
      return a.id === undefined ? [] : [a.id];
    case 'studio.doc.propose':
      return [a.calls ?? a.ops ?? []];
    case 'studio.changes.accept':
      return [a.id ?? ''];
    case 'studio.changes.reject':
      return [a.id ?? '', a.why ?? ''];
    case 'studio.kit.validate':
      return [a.kit ?? null, typeof a.preset === 'string' ? a.preset : 'main', a.options ?? a];
    case 'studio.material.coverage':
      return [a];
    case 'studio.capture':
      return [a];
    default:
      return [];
  }
}

/**
 * Starts answering an agent. The loop keeps itself alive until `stop()` (or until the page unloads, which calls it); a poll that fails
 * (the dev server restarted, the tab went to sleep) backs off and tries again rather than tearing the client down, because an agent
 * that reconnects should find the page still there.
 */
export function startBridgeClient(o: BridgeClientOptions): BridgeClient {
  const route = o.route ?? '/__studio/agent';
  const fetchFn = o.fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
  const interval = Math.max(50, o.intervalMs ?? 400);
  let state: BridgeState = { connecting: true, polls: 0, answered: 0, refused: 0, lastWhy: '' };
  let running = true;

  const publish = (next: Partial<BridgeState>): BridgeState => {
    state = { ...state, ...next };
    o.onState?.(state);
    return state;
  };

  const answer = async (call: RelayCall): Promise<{ ok: boolean; value?: unknown; why?: string }> => {
    const api = o.api();
    if (!api) return { ok: false, why: 'the Studio has no agent API installed (installStudioAgent has not run)' };
    const method = methodFor(call.tool);
    if (!method) return { ok: false, why: `this Studio does not serve '${call.tool}'` };
    if (!TOOL_ARITY[call.tool]) return { ok: false, why: `'${call.tool}' has no argument contract` };
    const fn = api[method] as (...args: unknown[]) => unknown;
    try {
      const value = await fn(o.key, ...argsFor(call.tool, call.args));
      return { ok: true, value };
    } catch (e) {
      return { ok: false, why: e instanceof Error ? e.message : String(e) };
    }
  };

  const tick = async (): Promise<BridgeState> => {
    if (!fetchFn) return publish({ connecting: false, lastWhy: 'this page cannot fetch (no fetch in this environment)' });
    let calls: RelayCall[] = [];
    try {
      const r = await fetchFn(`${route}/poll?key=${encodeURIComponent(o.key)}`, { cache: 'no-store' });
      const j = (await r.json()) as { ok?: boolean; calls?: RelayCall[]; why?: string };
      if (!r.ok || j.ok === false) return publish({ connecting: false, polls: state.polls + 1, lastWhy: j.why ?? `HTTP ${r.status}` });
      calls = j.calls ?? [];
    } catch (e) {
      return publish({ connecting: false, polls: state.polls + 1, lastWhy: e instanceof Error ? e.message : 'the dev server is not reachable' });
    }
    let answered = state.answered;
    let refused = state.refused;
    let lastWhy = state.lastWhy;
    for (const call of calls) {
      const result = await answer(call);
      if (result.ok) answered += 1;
      else {
        refused += 1;
        lastWhy = result.why ?? '';
      }
      try {
        await fetchFn(`${route}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: o.key, id: call.id, answer: result }),
        });
      } catch {
        lastWhy = 'the answer could not be posted back to the dev server';
      }
    }
    return publish({ connecting: true, polls: state.polls + 1, answered, refused, lastWhy });
  };

  const loop = async (): Promise<void> => {
    while (running) {
      await tick();
      if (!running) break;
      await new Promise<void>((resolve) => setTimeout(resolve, interval));
    }
  };
  if (o.autoStart !== false) void loop();

  return {
    state: () => state,
    tick,
    stop: async () => {
      running = false;
      if (!fetchFn) return;
      try {
        await fetchFn(`${route}/drop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: o.key, why: 'the Studio page closed' }),
        });
      } catch {
        // the dev server is gone too; nothing to tell it
      }
    },
  };
}

/** The tools this build serves through the bridge (the skill file lists the same set). */
export const SERVED_TOOLS: readonly string[] = Object.freeze(Object.keys(TOOL_ARITY));
