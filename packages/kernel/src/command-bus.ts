/**
 * Command bus: every edit to the preset graph goes through a command that knows its own inverse.
 *
 * The bus owns three things - the handler registry, the undo/redo history (a cursor into a list of
 * steps) and the subscriber list. It never mutates presets itself: handlers do that through the
 * `PresetStore` and `VariableSystem` interfaces they were given.
 */
import { cmd } from '../../contracts/src/commands';
import type { Command, CommandBus, CommandHandler, CommandResult } from '../../contracts/src/commands';
import type { Params, PresetId, Ref, Unsubscribe, Value } from '../../contracts/src/core';
import type { Preset, PresetDraft, PresetStore } from '../../contracts/src/preset';
import type { VariableSystem } from '../../contracts/src/variables';

/** How many undo steps are kept when the caller does not say. */
const DEFAULT_MAX_HISTORY = 200;

/** Internal command type the bus registers itself: it deletes a preset that a command created. */
const REMOVE_PRESET = 'remove-preset';

/** What a handler produced: the outcome plus the command that reverses it (null = not undoable). */
type Applied = { readonly result: CommandResult; readonly inverse: Command | null };

/** One undo step: replaying `forward` redoes it, replaying `backward` (already reversed) undoes it. */
type Step = { readonly label: string; readonly forward: readonly Command[]; readonly backward: readonly Command[] };

/** Commands collected while a transaction is open. */
type OpenTransaction = { readonly label: string; readonly forward: Command[]; readonly inverses: Command[]; undoable: boolean };

/** Notifies a listener about one executed command. */
type Listener = (command: Command, result: CommandResult) => void;

/** Narrows unknown data to a plain object when it is one. */
function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

/** Narrows unknown data to a string when it is one. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Narrows unknown data to a list index when it is one. */
function asIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Reports whether unknown data can be stored as a value (checked recursively). */
function isValue(value: unknown): value is Value {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean' || typeof value === 'string') return true;
  if (Array.isArray(value)) return (value as readonly unknown[]).every((item) => isValue(item));
  const record = asRecord(value);
  if (record === undefined) return false;
  return Object.values(record).every((item) => isValue(item));
}

/** Reports whether a stored value is a plain param group (not a ref, an expression or a list). */
function isParamGroup(value: Value | undefined): value is Readonly<Record<string, Value>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return !('ref' in value) && !('expr' in value);
}

/** Reads a possibly dotted param key from a preset's own params; undefined when it is not stored there. */
function readOwnParam(params: Params, key: string): Value | undefined {
  let current: Value | undefined = params;
  for (const part of key.split('.')) {
    if (!isParamGroup(current)) return undefined;
    current = current[part];
  }
  return current;
}

/** Rebuilds a draft that reproduces every field of one preset revision, so a put can restore it exactly. */
function draftOf(preset: Preset): PresetDraft {
  return {
    id: preset.id,
    kind: preset.kind,
    name: preset.name,
    forkOf: preset.forkOf,
    params: preset.params,
    children: preset.children,
    script: preset.script,
    tags: preset.tags,
    tier: preset.tier,
    meta: preset.meta,
  };
}

/** Copies a slot list with one child ref inserted at index (clamped to the list bounds). */
function insertAt(refs: readonly Ref[], child: Ref, index: number): readonly Ref[] {
  const copy = refs.slice();
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, child);
  return copy;
}

/** Copies a slot list without the entry at index. */
function withoutIndex(refs: readonly Ref[], index: number): readonly Ref[] {
  const copy = refs.slice();
  copy.splice(index, 1);
  return copy;
}

/** Renders an unknown thrown value as a readable message. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Renders unknown data for an error message. */
function describe(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return String(value);
  return Array.isArray(value) ? 'an array' : typeof value;
}

/** Validates and normalizes anything handed to the bus as a command; undefined when it is not one. */
function toCommand(value: unknown): Command | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const type = asString(record['type']);
  if (type === undefined || type.length === 0) return undefined;
  return { type, payload: asRecord(record['payload']) ?? {}, label: asString(record['label']) ?? type };
}

/** Validates a preset draft: it must at least say what kind of preset it is and what it is called. */
function asDraft(value: unknown): PresetDraft | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  if (asString(record['kind']) === undefined || asString(record['name']) === undefined) return undefined;
  return record as unknown as PresetDraft;
}

/** Wraps a successful outcome with the ids the command created, revised or removed. */
function done(touched: readonly PresetId[], inverse: Command | null): Applied {
  return { result: { ok: true, touched }, inverse };
}

/** Wraps a failure: nothing was changed, so nothing is touched and nothing can be undone. */
function fail(error: string): Applied {
  return { result: { ok: false, error, touched: [] }, inverse: null };
}

/** Checks the store the bus was given, so handlers can rely on every method they call. */
function storeOf(value: unknown): PresetStore {
  const record = asRecord(value);
  if (record === undefined) throw new Error(`createCommandBus: opts.store must be a PresetStore, got ${describe(value)}`);
  for (const method of ['get', 'put', 'fork', 'remove'] as const) {
    if (typeof record[method] !== 'function') throw new Error(`createCommandBus: opts.store.${method}() must be a function`);
  }
  return record as unknown as PresetStore;
}

/** Checks the variable system the bus was given, so handlers can rely on read and write. */
function varsOf(value: unknown): VariableSystem {
  const record = asRecord(value);
  if (record === undefined) throw new Error(`createCommandBus: opts.vars must be a VariableSystem, got ${describe(value)}`);
  for (const method of ['read', 'write'] as const) {
    if (typeof record[method] !== 'function') throw new Error(`createCommandBus: opts.vars.${method}() must be a function`);
  }
  return record as unknown as VariableSystem;
}

/** Checks the history limit, so the rest of the bus can treat it as a positive integer. */
function limitOf(value: unknown): number {
  if (value === undefined) return DEFAULT_MAX_HISTORY;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`createCommandBus: opts.maxHistory must be a positive integer, got ${describe(value)}`);
  }
  return value;
}

/** Creates a command bus whose handlers edit presets through the given store and variable system. */
export function createCommandBus(opts: { store: PresetStore; vars: VariableSystem; maxHistory?: number }): CommandBus {
  const given = asRecord(opts) ?? {};
  const store = storeOf(given['store']);
  const vars = varsOf(given['vars']);
  const maxHistory = limitOf(given['maxHistory']);

  const handlers = new Map<string, CommandHandler>();
  const listeners = new Set<Listener>();
  const steps: Step[] = [];
  /** How many steps are currently applied; the ones at or beyond this index can still be redone. */
  let cursor = 0;
  let open: OpenTransaction | null = null;

  /** Builds the draft for a preset revision with one child slot replaced. */
  function withSlot(preset: Preset, slot: string, refs: readonly Ref[]): PresetDraft {
    return { ...draftOf(preset), children: { ...preset.children, [slot]: refs } };
  }

  /** Applies "set-param": writes one param through the variable system, keeping every other field. */
  function setParamHandler(command: Command): Applied {
    const path = asString(command.payload['path']);
    if (path === undefined) {
      return fail(`set-param: payload.path must be a string like "<presetId>.<param key>", got ${describe(command.payload['path'])}`);
    }
    const dot = path.indexOf('.');
    if (dot < 1) return fail(`set-param: path "${path}" must look like "<presetId>.<param key>"`);
    const presetId = path.slice(0, dot);
    const key = path.slice(dot + 1);
    if (key.length === 0) return fail(`set-param: path "${path}" has no param key after the preset id`);
    const value = command.payload['value'];
    if (!isValue(value)) return fail(`set-param: payload.value for "${path}" is not a storable value (got ${describe(value)})`);
    const before = store.get(presetId);
    if (before === undefined) return fail(`set-param: preset "${presetId}" does not exist`);

    const stored = readOwnParam(before.params, key);
    const previous = vars.read(path);
    vars.write(path, value);
    // A param this preset did not store itself has to be removed again on undo, and only putting the
    // previous revision back does that; a stored param is simply written back to its old value.
    const inverse = stored === undefined
      ? cmd.put(draftOf(before), `Revert ${key}`)
      : cmd.setParam(path, previous === undefined ? stored : previous, `Revert ${key}`);
    return done([presetId], inverse);
  }

  /** Applies "put-preset": creates a preset or revises one, undoable by restoring what was there. */
  function putPresetHandler(command: Command): Applied {
    const draft = asDraft(command.payload['draft']);
    if (draft === undefined) return fail('put-preset: payload.draft must be an object with a "kind" and a "name"');
    const previous = draft.id === undefined ? undefined : store.get(draft.id);
    const saved = store.put(draft);
    const inverse = previous === undefined
      ? { type: REMOVE_PRESET, payload: { id: saved.id }, label: `Delete ${saved.name}` }
      : cmd.put(draftOf(previous), `Restore ${previous.name}`);
    return done([saved.id], inverse);
  }

  /** Applies "fork-preset": copies a preset through the store; undo deletes the fork. */
  function forkPresetHandler(command: Command): Applied {
    const id = asString(command.payload['id']);
    if (id === undefined) return fail(`fork-preset: payload.id must be a preset id string, got ${describe(command.payload['id'])}`);
    if (store.get(id) === undefined) return fail(`fork-preset: preset "${id}" does not exist`);
    const rawPatch = command.payload['patch'];
    let patch: Partial<PresetDraft> | undefined;
    if (rawPatch !== undefined) {
      const record = asRecord(rawPatch);
      if (record === undefined) return fail(`fork-preset: payload.patch must be an object, got ${describe(rawPatch)}`);
      patch = record as unknown as Partial<PresetDraft>;
    }
    const fork = store.fork(id, patch);
    return done([fork.id], { type: REMOVE_PRESET, payload: { id: fork.id }, label: `Delete fork ${fork.name}` });
  }

  /** Applies "add-child": revises the parent with the child ref inserted at index (default: the end). */
  function addChildHandler(command: Command): Applied {
    const parent = asString(command.payload['parent']);
    const slot = asString(command.payload['slot']);
    const child = asString(command.payload['child']);
    if (parent === undefined || slot === undefined || child === undefined) {
      return fail('add-child: payload needs the strings "parent", "slot" and "child"');
    }
    const target = store.get(parent);
    if (target === undefined) return fail(`add-child: parent preset "${parent}" does not exist`);
    if (store.get(child) === undefined) return fail(`add-child: child preset "${child}" does not exist`);
    const current = target.children[slot] ?? [];
    const rawIndex = command.payload['index'];
    let index = current.length;
    if (rawIndex !== undefined) {
      const parsed = asIndex(rawIndex);
      if (parsed === undefined) return fail(`add-child: payload.index must be a non-negative integer, got ${describe(rawIndex)}`);
      index = Math.min(parsed, current.length);
    }
    const saved = store.put(withSlot(target, slot, insertAt(current, { ref: child }, index)));
    return done([saved.id], cmd.removeChild(saved.id, slot, index, `Remove ${child}`));
  }

  /** Applies "remove-child": revises the parent without the ref at index; undo puts that ref back. */
  function removeChildHandler(command: Command): Applied {
    const parent = asString(command.payload['parent']);
    const slot = asString(command.payload['slot']);
    const index = asIndex(command.payload['index']);
    if (parent === undefined || slot === undefined) return fail('remove-child: payload needs the strings "parent" and "slot"');
    if (index === undefined) {
      return fail(`remove-child: payload.index must be a non-negative integer, got ${describe(command.payload['index'])}`);
    }
    const target = store.get(parent);
    if (target === undefined) return fail(`remove-child: parent preset "${parent}" does not exist`);
    const current = target.children[slot] ?? [];
    const removed = current[index];
    if (removed === undefined) {
      return fail(`remove-child: slot "${slot}" of "${parent}" has no child at index ${index} (it holds ${current.length})`);
    }
    const saved = store.put(withSlot(target, slot, withoutIndex(current, index)));
    // A plain ref can be re-added with add-child; a ref pinned to a revision needs the whole draft back.
    const inverse = removed.rev === undefined
      ? cmd.addChild(saved.id, slot, removed.ref, index, `Re-add ${removed.ref}`)
      : cmd.put(draftOf(target), `Restore ${slot}`);
    return done([saved.id], inverse);
  }

  /** Applies "set-script": revises the preset with a TypeScript script; undo restores the old one. */
  function setScriptHandler(command: Command): Applied {
    const id = asString(command.payload['id']);
    const source = asString(command.payload['source']);
    if (id === undefined || source === undefined) return fail('set-script: payload needs the strings "id" and "source"');
    const target = store.get(id);
    if (target === undefined) return fail(`set-script: preset "${id}" does not exist`);
    const saved = store.put({ ...draftOf(target), script: { language: 'ts', source, apiVersion: 1 } });
    return done([saved.id], cmd.put(draftOf(target), `Restore script of ${target.name}`));
  }

  /** Applies "batch": runs its commands in order as one unit, rolling back when one of them fails. */
  function batchHandler(command: Command): Applied {
    const rawList = command.payload['commands'];
    if (!Array.isArray(rawList)) return fail(`batch: payload.commands must be an array of commands, got ${describe(rawList)}`);
    const items = rawList as readonly unknown[];
    const touched: PresetId[] = [];
    const inverses: Command[] = [];
    let undoable = true;
    for (const [position, item] of items.entries()) {
      const inner = toCommand(item);
      if (inner === undefined) return fail(`batch: commands[${position}] must be an object with a string "type"`);
      const applied = apply(inner);
      if (!applied.result.ok) {
        rollback(inverses);
        return fail(`batch "${command.label}" stopped at command ${position + 1} of ${items.length} (${inner.type}): ${applied.result.error ?? 'no reason given'}`);
      }
      for (const id of applied.result.touched) {
        if (!touched.includes(id)) touched.push(id);
      }
      if (applied.inverse === null) undoable = false;
      else inverses.push(applied.inverse);
    }
    // Undoing a batch means replaying the collected inverses in reverse order, as one batch again.
    return done(touched, undoable ? cmd.batch(inverses.slice().reverse(), `Undo ${command.label}`) : null);
  }

  /** Deletes a preset; used as the inverse of a command that created one. */
  function removePresetHandler(command: Command): Applied {
    const id = asString(command.payload['id']);
    if (id === undefined) return fail(`${REMOVE_PRESET}: payload.id must be a preset id string, got ${describe(command.payload['id'])}`);
    if (store.get(id) === undefined) return fail(`${REMOVE_PRESET}: preset "${id}" does not exist`);
    store.remove(id);
    // No inverse here: putting a deleted preset back needs its draft, which this command does not carry.
    return done([id], null);
  }

  /** Runs one command through its handler and turns every failure, including a throw, into a result. */
  function apply(command: Command): Applied {
    const handler = handlers.get(command.type);
    if (handler === undefined) return fail(`no handler is registered for command type "${command.type}"`);
    try {
      const applied = handler.apply(command);
      const result = applied.result;
      if (typeof result?.ok !== 'boolean') return fail(`the handler for "${command.type}" returned a result without an "ok" flag`);
      const touched = Array.isArray(result.touched) ? (result.touched as readonly PresetId[]) : [];
      if (!result.ok) return fail(result.error ?? `the handler for "${command.type}" reported a failure without a reason`);
      return done(touched, applied.inverse ?? null);
    } catch (error) {
      return fail(`the handler for "${command.type}" threw: ${messageOf(error)}`);
    }
  }

  /** Applies inverse commands newest-first, to roll back a batch or a failed transaction. */
  function rollback(inverses: readonly Command[]): void {
    for (let index = inverses.length - 1; index >= 0; index -= 1) {
      const inverse = inverses[index];
      if (inverse !== undefined) apply(inverse);
    }
  }

  /** Tells every subscriber about one executed command; a throwing subscriber cannot break the bus. */
  function notify(command: Command, result: CommandResult): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(command, result);
      } catch {
        // A broken listener is the listener's problem, not the caller's.
      }
    }
  }

  /** Forgets the redo branch: it can only be replayed while nothing new has happened. */
  function dropRedoBranch(): void {
    steps.splice(cursor);
  }

  /** Appends one undo step and trims the history down to maxHistory, oldest step first. */
  function pushStep(step: Step): void {
    dropRedoBranch();
    steps.push(step);
    cursor = steps.length;
    while (steps.length > maxHistory) {
      steps.shift();
      cursor = Math.max(0, cursor - 1);
    }
  }

  /** Records a successful command: inside a transaction it joins that step, otherwise it becomes one. */
  function record(command: Command, inverse: Command | null): void {
    if (open !== null) {
      open.forward.push(command);
      if (inverse === null) open.undoable = false;
      else open.inverses.push(inverse);
      return;
    }
    dropRedoBranch();
    // A command without an inverse is still executed, but it cannot be undone, so it gets no step.
    if (inverse === null) return;
    pushStep({ label: command.label, forward: [command], backward: [inverse] });
  }

  /** Applies one command, keeps the history up to date and reports it to subscribers. */
  function execute(command: Command): CommandResult {
    const checked = toCommand(command);
    if (checked === undefined) {
      return { ok: false, error: `execute: a command must be an object with a string "type", got ${describe(command)}`, touched: [] };
    }
    const applied = apply(checked);
    if (applied.result.ok) record(checked, applied.inverse);
    notify(checked, applied.result);
    return applied.result;
  }

  /** Groups everything run() executes into one undo step; a nested transaction joins the outer one. */
  function transaction<T>(label: string, run: () => T): T {
    if (open !== null) return run();
    const tx: OpenTransaction = {
      label: typeof label === 'string' && label.length > 0 ? label : 'Transaction',
      forward: [],
      inverses: [],
      undoable: true,
    };
    open = tx;
    let value: T;
    try {
      value = run();
    } catch (error) {
      open = null;
      rollback(tx.inverses);
      throw error;
    }
    open = null;
    if (tx.forward.length === 0) return value;
    if (tx.undoable) pushStep({ label: tx.label, forward: tx.forward, backward: tx.inverses.slice().reverse() });
    else dropRedoBranch();
    return value;
  }

  /** Undoes the newest applied step; false when there is nothing left to undo. */
  function undo(): boolean {
    if (cursor === 0) return false;
    const step = steps[cursor - 1];
    if (step === undefined) return false;
    cursor -= 1;
    for (const command of step.backward) apply(command);
    return true;
  }

  /** Redoes the oldest undone step by replaying its original commands; false when there is nothing to redo. */
  function redo(): boolean {
    if (cursor >= steps.length) return false;
    const step = steps[cursor];
    if (step === undefined) return false;
    cursor += 1;
    for (const command of step.forward) apply(command);
    return true;
  }

  /** Lists every step oldest first, flagging the ones that are currently undone. */
  function history(): readonly { readonly label: string; readonly undone: boolean }[] {
    return steps.map((step, index) => ({ label: step.label, undone: index >= cursor }));
  }

  /** Adds or replaces the handler for a command type. */
  function registerHandler(type: string, handler: CommandHandler): void {
    if (typeof type !== 'string' || type.length === 0) throw new Error(`registerHandler: type must be a non-empty string, got ${describe(type)}`);
    if (typeof handler?.apply !== 'function') throw new Error(`registerHandler: the handler for "${type}" must have an apply(command) method`);
    handlers.set(type, handler);
  }

  /** Subscribes to every command handed to execute() - undo/redo replay inverses, they are not new commands. */
  function subscribe(listener: Listener): Unsubscribe {
    if (typeof listener !== 'function') throw new Error(`subscribe: listener must be a function, got ${describe(listener)}`);
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
    };
  }

  /** Forgets the whole undo/redo history; handlers and subscribers stay registered. */
  function clear(): void {
    steps.length = 0;
    cursor = 0;
    open = null;
  }

  handlers.set('set-param', { apply: setParamHandler });
  handlers.set('put-preset', { apply: putPresetHandler });
  handlers.set('fork-preset', { apply: forkPresetHandler });
  handlers.set('add-child', { apply: addChildHandler });
  handlers.set('remove-child', { apply: removeChildHandler });
  handlers.set('set-script', { apply: setScriptHandler });
  handlers.set('batch', { apply: batchHandler });
  handlers.set(REMOVE_PRESET, { apply: removePresetHandler });

  return {
    execute,
    transaction,
    undo,
    redo,
    get canUndo(): boolean {
      return cursor > 0;
    },
    get canRedo(): boolean {
      return cursor < steps.length;
    },
    history,
    registerHandler,
    subscribe,
    clear,
  };
}
