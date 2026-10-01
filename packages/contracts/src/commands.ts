import type { PresetId, Unsubscribe, Value } from './core';
import type { PresetDraft } from './preset';
import type { VarPath } from './variables';

/**
 * EVERY edit is a Command: tools, the inspector, the code panel and scripts-with-permission all go through the CommandBus.
 * That gives undo/redo, replay, and (later) multiplayer editing for free. Nothing edits a preset in place.
 */
export interface Command {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** Short human text for the undo list ("Paint basalt", "Move 3 props"). */
  readonly label: string;
}

/** The commands the kernel must understand. Packs may register more with `registerHandler`. */
export type StandardCommand =
  | { readonly type: 'set-param'; readonly payload: { readonly path: VarPath; readonly value: Value }; readonly label: string }
  | { readonly type: 'put-preset'; readonly payload: { readonly draft: PresetDraft }; readonly label: string }
  | { readonly type: 'fork-preset'; readonly payload: { readonly id: PresetId; readonly patch?: Partial<PresetDraft> }; readonly label: string }
  | { readonly type: 'add-child'; readonly payload: { readonly parent: PresetId; readonly slot: string; readonly child: PresetId; readonly index?: number }; readonly label: string }
  | { readonly type: 'remove-child'; readonly payload: { readonly parent: PresetId; readonly slot: string; readonly index: number }; readonly label: string }
  | { readonly type: 'set-script'; readonly payload: { readonly id: PresetId; readonly source: string }; readonly label: string }
  | { readonly type: 'batch'; readonly payload: { readonly commands: readonly Command[] }; readonly label: string };

export interface CommandResult {
  readonly ok: boolean;
  readonly error?: string;
  /** Presets created or revised by this command. */
  readonly touched: readonly PresetId[];
}

/** A handler does the work and returns how to undo it. */
export interface CommandHandler {
  apply(command: Command): { readonly result: CommandResult; readonly inverse: Command | null };
}

export interface CommandBus {
  execute(command: Command): CommandResult;
  /** Several commands that undo as one step (a drag, a paint stroke). The callback may call `execute` many times. */
  transaction<T>(label: string, run: () => T): T;
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Newest last. */
  history(): readonly { readonly label: string; readonly undone: boolean }[];
  registerHandler(type: string, handler: CommandHandler): void;
  subscribe(listener: (command: Command, result: CommandResult) => void): Unsubscribe;
  /** Drops history (e.g. after loading a different project). */
  clear(): void;
}

export const cmd = {
  setParam: (path: VarPath, value: Value, label = 'Change value'): StandardCommand => ({ type: 'set-param', payload: { path, value }, label }),
  put: (draft: PresetDraft, label = 'Save preset'): StandardCommand => ({ type: 'put-preset', payload: { draft }, label }),
  addChild: (parent: PresetId, slot: string, child: PresetId, index?: number, label = 'Add'): StandardCommand =>
    ({ type: 'add-child', payload: index === undefined ? { parent, slot, child } : { parent, slot, child, index }, label }),
  removeChild: (parent: PresetId, slot: string, index: number, label = 'Remove'): StandardCommand => ({ type: 'remove-child', payload: { parent, slot, index }, label }),
  setScript: (id: PresetId, source: string, label = 'Edit script'): StandardCommand => ({ type: 'set-script', payload: { id, source }, label }),
  batch: (commands: readonly Command[], label: string): StandardCommand => ({ type: 'batch', payload: { commands }, label }),
};

export interface EventBus<M extends Record<string, unknown> = Record<string, unknown>> {
  on<K extends keyof M & string>(name: K, listener: (payload: M[K]) => void): Unsubscribe;
  once<K extends keyof M & string>(name: K, listener: (payload: M[K]) => void): Unsubscribe;
  emit<K extends keyof M & string>(name: K, payload: M[K]): void;
  /** Receives every event (for the "event log" in the Pro tier and for replays). */
  onAny(listener: (name: string, payload: unknown) => void): Unsubscribe;
}
