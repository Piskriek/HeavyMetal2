/**
 * Command bus for the kernel: executes preset-mutating commands, keeps undo/redo
 * history, and runs batches and transactions as single undo steps.
 *
 * Every command is applied through the PresetStore and VariableSystem interfaces
 * and returns its inverse so it can be undone. `execute` never throws: an unknown
 * command type or a handler that throws comes back as `{ ok: false, error, touched: [] }`
 * and changes nothing.
 */
import { cmd } from '@hm/contracts';
import type {
  Command,
  CommandBus,
  CommandHandler,
  CommandResult,
  Preset,
  PresetDraft,
  PresetId,
  PresetStore,
  ScriptSource,
  StandardCommand,
  Unsubscribe,
  VariableSystem,
} from '@hm/contracts';

/** A command on the undo/redo stacks: the command, its inverse, and what it changed. */
interface StackEntry {
  readonly command: Command;
  readonly inverse: Command | null;
  readonly label: string;
  readonly touched: readonly PresetId[];
}

/** What applying a command produced: the user-visible result and the inverse command. */
type Applied = { readonly result: CommandResult; readonly inverse: Command | null };

/** Default number of undo steps kept; the oldest are dropped beyond it. */
const DEFAULT_MAX_HISTORY = 200;

/** Builds a failure result: a failed command changes nothing and has no inverse. */
function fail(error: string): Applied {
  return { result: { ok: false, error, touched: [] }, inverse: null };
}

/** Extracts a human message from a thrown value. */
function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Deduplicates preset ids, keeping first-seen order. */
function dedupe(ids: readonly PresetId[]): PresetId[] {
  const seen = new Set<string>();
  const out: PresetId[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Full draft of a preset revision; the script key is omitted when there is no script. */
function draftFromPreset(preset: Preset): PresetDraft {
  const base: PresetDraft = {
    id: preset.id,
    kind: preset.kind,
    name: preset.name,
    forkOf: preset.forkOf,
    params: preset.params,
    children: preset.children,
    tags: preset.tags,
    tier: preset.tier,
    meta: { ...preset.meta },
  };
  return preset.script === undefined ? base : { ...base, script: preset.script };
}

/**
 * Creates a command bus over a preset store and a variable system.
 *
 * Handlers for the seven standard command types are registered up front; use
 * `registerHandler` for extra types. A handler may return `inverse: null` —
 * the command is still executed but cannot be undone.
 */
export function createCommandBus(opts: {
  store: PresetStore;
  vars: VariableSystem;
  maxHistory?: number;
}): CommandBus {
  const { store, vars } = opts;
  const maxHistory = opts.maxHistory ?? DEFAULT_MAX_HISTORY;

  const handlers = new Map<string, CommandHandler>();
  const undoStack: StackEntry[] = [];
  const redoStack: StackEntry[] = [];
  const listeners = new Set<(command: Command, result: CommandResult) => void>();
  const openTransactions: { label: string; startIndex: number }[] = [];

  /** Puts a new revision of `preset` built from its current fields plus `changes`. */
  function putPresetFrom(preset: Preset, changes: Partial<PresetDraft>): Preset {
    const draft: PresetDraft = { ...draftFromPreset(preset), ...changes, id: preset.id };
    return store.put(draft);
  }

  /** Applies any command through its handler; a throwing handler becomes a failure. */
  function applyCommand(command: Command): Applied {
    const handler = handlers.get(command.type);
    if (handler === undefined) {
      return { result: { ok: false, error: `unknown command type: "${command.type}"`, touched: [] }, inverse: null };
    }
    try {
      const applied = handler.apply(command);
      const result: CommandResult = applied.result.ok
        ? { ok: true, touched: applied.result.touched }
        : { ok: false, error: applied.result.error ?? `command "${command.type}" failed`, touched: [] };
      return { result, inverse: applied.result.ok ? applied.inverse : null };
    } catch (e) {
      return {
        result: { ok: false, error: `command "${command.type}" threw: ${errorMessage(e)}`, touched: [] },
        inverse: null,
      };
    }
  }

  // ---- standard handlers ----

  handlers.set('set-param', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'set-param' }>;
      const rawPath = c.payload.path;
      if (typeof rawPath !== 'string' || rawPath.indexOf('.') < 0) {
        return fail(`set-param: path "${String(rawPath)}" must be "<presetId>.<param key>"`);
      }
      const path = rawPath;
      const dot = path.indexOf('.');
      const presetId = path.slice(0, dot);
      const key = path.slice(dot + 1);
      const preset = store.get(presetId);
      if (preset === undefined) {
        return fail(`set-param: preset "${presetId}" does not exist`);
      }
      const previous = vars.read(path);
      const hadKey = Object.prototype.hasOwnProperty.call(preset.params, key);
      vars.write(path, c.payload.value);
      // Restore the previous value by writing it back; when the param was never
      // stored in the preset's own params, restore the whole previous revision
      // instead so the param is removed again.
      const inverse: Command = hadKey && previous !== undefined
        ? cmd.setParam(path, previous, command.label)
        : { type: 'put-preset', payload: { draft: draftFromPreset(preset) }, label: command.label };
      return { result: { ok: true, touched: [presetId] }, inverse };
    },
  });

  handlers.set('put-preset', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'put-preset' }>;
      const rawDraft = c.payload.draft;
      if (typeof rawDraft !== 'object' || rawDraft === null) {
        return fail('put-preset: payload.draft must be a preset draft with kind and name');
      }
      const draft = rawDraft as PresetDraft;
      if (typeof draft.name !== 'string' || typeof draft.kind !== 'string') {
        return fail('put-preset: payload.draft must be a preset draft with kind and name');
      }
      const previous = draft.id === undefined ? undefined : store.get(draft.id);
      const saved = store.put(draft);
      // Undo restores the previous revision, or removes the preset when it was new.
      const inverse: Command = previous === undefined
        ? { type: 'remove-preset', payload: { id: saved.id }, label: command.label }
        : { type: 'put-preset', payload: { draft: draftFromPreset(previous) }, label: command.label };
      return { result: { ok: true, touched: [saved.id] }, inverse };
    },
  });

  // Internal command registered by the bus itself: it backs the inverse of
  // put-preset for newly created presets. Its inverse is null on purpose —
  // the removed preset is gone, and replaying the original put-preset (redo)
  // is what recreates it. A remove-preset executed directly is therefore
  // executed but not undoable.
  handlers.set('remove-preset', {
    apply(command) {
      const id = command.payload.id;
      if (typeof id !== 'string' || id.length === 0) {
        return fail('remove-preset: payload.id must be a non-empty preset id');
      }
      if (store.get(id) === undefined) {
        return fail(`remove-preset: preset "${id}" does not exist`);
      }
      store.remove(id);
      return { result: { ok: true, touched: [id] }, inverse: null };
    },
  });

  handlers.set('fork-preset', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'fork-preset' }>;
      const id = c.payload.id;
      const patch = c.payload.patch;
      if (typeof id !== 'string' || id.length === 0) {
        return fail('fork-preset: payload.id must be a non-empty preset id');
      }
      if (store.get(id) === undefined) {
        return fail(`fork-preset: preset "${id}" does not exist`);
      }
      if (patch !== undefined && (typeof patch !== 'object' || patch === null)) {
        return fail('fork-preset: payload.patch must be an object');
      }
      const forked = patch === undefined ? store.fork(id) : store.fork(id, patch as Partial<PresetDraft>);
      // Undo removes the fork.
      const inverse: Command = { type: 'remove-preset', payload: { id: forked.id }, label: command.label };
      return { result: { ok: true, touched: [forked.id] }, inverse };
    },
  });

  handlers.set('add-child', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'add-child' }>;
      const parent = c.payload.parent;
      const slot = c.payload.slot;
      const child = c.payload.child;
      if (typeof parent !== 'string' || typeof slot !== 'string' || typeof child !== 'string') {
        return fail('add-child: payload.parent, payload.slot and payload.child must be strings');
      }
      const preset = store.get(parent);
      if (preset === undefined) {
        return fail(`add-child: parent preset "${parent}" does not exist`);
      }
      if (store.get(child) === undefined) {
        return fail(`add-child: child preset "${child}" does not exist`);
      }
      const list = preset.children[slot] ?? [];
      const at = c.payload.index === undefined ? list.length : c.payload.index;
      if (!Number.isFinite(at) || at < 0 || at > list.length) {
        return fail(`add-child: index ${String(at)} is out of range for slot "${slot}" of preset "${parent}"`);
      }
      const next = [...list.slice(0, at), { ref: child }, ...list.slice(at)];
      store.put(putPresetFrom(preset, { children: { ...preset.children, [slot]: next } }));
      // Undo removes the ref we just inserted.
      return {
        result: { ok: true, touched: [parent] },
        inverse: cmd.removeChild(parent, slot, at, command.label),
      };
    },
  });

  handlers.set('remove-child', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'remove-child' }>;
      const parent = c.payload.parent;
      const slot = c.payload.slot;
      const index = c.payload.index;
      if (typeof parent !== 'string' || typeof slot !== 'string' || typeof index !== 'number') {
        return fail('remove-child: payload.parent and payload.slot must be strings and payload.index a number');
      }
      const preset = store.get(parent);
      if (preset === undefined) {
        return fail(`remove-child: parent preset "${parent}" does not exist`);
      }
      const list = preset.children[slot] ?? [];
      if (!Number.isFinite(index) || index < 0 || index >= list.length) {
        return fail(`remove-child: index ${index} is out of range for slot "${slot}" of preset "${parent}"`);
      }
      const removed = list[index];
      if (removed === undefined) {
        return fail(`remove-child: no ref at index ${index} in slot "${slot}" of preset "${parent}"`);
      }
      const next = [...list.slice(0, index), ...list.slice(index + 1)];
      store.put(putPresetFrom(preset, { children: { ...preset.children, [slot]: next } }));
      // Undo puts the removed ref back at the same index.
      return {
        result: { ok: true, touched: [parent] },
        inverse: cmd.addChild(parent, slot, removed.ref, index, command.label),
      };
    },
  });

  handlers.set('set-script', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'set-script' }>;
      const id = c.payload.id;
      const source = c.payload.source;
      if (typeof id !== 'string' || typeof source !== 'string') {
        return fail('set-script: payload.id and payload.source must be strings');
      }
      const preset = store.get(id);
      if (preset === undefined) {
        return fail(`set-script: preset "${id}" does not exist`);
      }
      const script: ScriptSource = { language: 'ts', source, apiVersion: 1 };
      store.put(putPresetFrom(preset, { script }));
      // Undo restores the previous revision: the previous script when there was
      // one, or a revision without the script key (a put replaces the revision,
      // so the script is removed) when there was none.
      const inverse: Command = {
        type: 'put-preset',
        payload: { draft: draftFromPreset(preset) },
        label: command.label,
      };
      return { result: { ok: true, touched: [id] }, inverse };
    },
  });

  handlers.set('batch', {
    apply(command) {
      const c = command as Extract<StandardCommand, { type: 'batch' }>;
      const subs = c.payload.commands;
      const inverses: (Command | null)[] = [];
      const touched: PresetId[] = [];
      for (let i = 0; i < subs.length; i++) {
        const sub: Command | undefined = subs[i];
        if (sub === undefined) {
          return fail(`batch: step ${i} is not a command`);
        }
        const applied = applyCommand(sub);
        if (!applied.result.ok) {
          // Undo the steps already done, best effort, then report the failure.
          for (let j = inverses.length - 1; j >= 0; j--) {
            const inverse = inverses[j]!;
            if (inverse !== null) {
              applyCommand(inverse);
            }
          }
          const stepError = applied.result.error ?? 'unknown error';
          return fail(`batch: step ${i} failed: ${stepError}`);
        }
        inverses.push(applied.inverse);
        touched.push(...applied.result.touched);
      }
      // Undo as a batch of the inverses in reverse order; when any step is not
      // undoable the whole batch stays not undoable.
      const nonNull = inverses.filter((v): v is Command => v !== null);
      let inverse: Command | null = null;
      if (nonNull.length === inverses.length) {
        inverse = cmd.batch([...nonNull].reverse(), command.label);
      }
      return { result: { ok: true, touched: dedupe(touched) }, inverse };
    },
  });

  // ---- bus API ----

  /** Executes one command and records it for undo; never throws. */
  function execute(command: Command): CommandResult {
    const applied = applyCommand(command);
    if (!applied.result.ok) {
      notify(command, applied.result);
      return applied.result;
    }
    redoStack.length = 0;
    undoStack.push({
      command,
      inverse: applied.inverse,
      label: command.label,
      touched: applied.result.touched,
    });
    trimHistory();
    notify(command, applied.result);
    return applied.result;
  }

  /** Drops the oldest undo steps beyond `maxHistory`. */
  function trimHistory(): void {
    const over = undoStack.length - maxHistory;
    if (over > 0) {
      undoStack.splice(0, over);
    }
  }

  /** Undoes the latest step by applying its inverse; false when impossible. */
  function undo(): boolean {
    const entry = undoStack[undoStack.length - 1];
    if (entry === undefined || entry.inverse === null) {
      return false;
    }
    const applied = applyCommand(entry.inverse);
    if (!applied.result.ok) {
      return false;
    }
    undoStack.pop();
    redoStack.push(entry);
    return true;
  }

  /** Redoes the latest undone step by replaying its original command. */
  function redo(): boolean {
    const entry = redoStack[redoStack.length - 1];
    if (entry === undefined) {
      return false;
    }
    const applied = applyCommand(entry.command);
    if (!applied.result.ok) {
      return false;
    }
    redoStack.pop();
    undoStack.push(entry);
    trimHistory();
    return true;
  }

  /** Undo steps still available, oldest first, including undone ones. */
  function history(): readonly { readonly label: string; readonly undone: boolean }[] {
    const out: { label: string; undone: boolean }[] = [];
    for (const entry of undoStack) {
      out.push({ label: entry.label, undone: false });
    }
    for (const entry of redoStack) {
      out.push({ label: entry.label, undone: true });
    }
    return out;
  }

  /** Registers or replaces a handler for a command type. */
  function registerHandler(type: string, handler: CommandHandler): void {
    handlers.set(type, handler);
  }

  /** Subscribes to every executed command with its result. */
  function subscribe(listener: (command: Command, result: CommandResult) => void): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Empties the undo and redo stacks. */
  function clear(): void {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  /** Notifies subscribers; a broken subscriber must not break execute. */
  function notify(command: Command, result: CommandResult): void {
    for (const listener of listeners) {
      try {
        listener(command, result);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  /** Everything executed inside `run()` becomes one undo step labelled `label`. */
  function transaction<T>(label: string, run: () => T): T {
    const frame = { label, startIndex: undoStack.length };
    openTransactions.push(frame);
    try {
      const out = run();
      collapseTransaction(frame);
      return out;
    } catch (error) {
      rollbackTransaction(frame);
      throw error;
    } finally {
      openTransactions.pop();
    }
  }

  /** Folds the entries added since `frame.startIndex` into one undo step. */
  function collapseTransaction(frame: { label: string; startIndex: number }): void {
    const entries = undoStack.slice(frame.startIndex);
    if (undoStack.length > frame.startIndex) {
      undoStack.length = frame.startIndex;
    }
    if (entries.length === 0) {
      return;
    }
    // Redo replays all sub-commands in order; undo replays their inverses in reverse.
    const commands = entries.map((entry) => entry.command);
    const nonNull = entries.map((entry) => entry.inverse).filter((v): v is Command => v !== null);
    let inverse: Command | null = null;
    if (nonNull.length === entries.length) {
      inverse = cmd.batch([...nonNull].reverse(), frame.label);
    }
    const allTouched: PresetId[] = [];
    for (const entry of entries) {
      allTouched.push(...entry.touched);
    }
    undoStack.push({
      command: cmd.batch(commands, frame.label),
      inverse,
      label: frame.label,
      touched: dedupe(allTouched),
    });
    trimHistory();
  }

  /** Undoes the entries added since `frame.startIndex` and discards them from redo. */
  function rollbackTransaction(frame: { label: string; startIndex: number }): void {
    const redoMark = redoStack.length;
    while (undoStack.length > frame.startIndex) {
      const entry = undoStack.pop();
      if (entry === undefined) {
        break;
      }
      if (entry.inverse !== null) {
        applyCommand(entry.inverse);
      }
      redoStack.push(entry);
    }
    redoStack.length = redoMark;
  }

  const bus: CommandBus = {
    execute,
    transaction,
    undo,
    redo,
    get canUndo(): boolean {
      const entry = undoStack[undoStack.length - 1];
      return entry !== undefined && entry.inverse !== null;
    },
    get canRedo(): boolean {
      return redoStack.length > 0;
    },
    history,
    registerHandler,
    subscribe,
    clear,
  };

  return bus;
}
