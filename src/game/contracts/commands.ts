/**
 * T01 — typed commands instead of UI mutation.
 *
 * Input never writes simulation fields directly. It produces a command, the command is
 * validated against the current gate (game status + heat phase + whether input is enabled),
 * and only then is it applied. Illegal commands are refused with a typed code and a
 * `command-rejected` event instead of silently corrupting a run.
 *
 * Validation is also where "repeated commands are harmless" lives: an identical command may
 * be re-sent any number of times and is either idempotent or refused, never double-applied.
 */

import type { GameStatus } from '../types';
import { ContractError, isFiniteNumber } from './core';
import type { ContractErrorCode } from './core';
import type { HeatPhase } from './heat';
import type { RacerId } from './identity';

export type GameCommand =
  | { readonly type: 'aim'; readonly power: number; readonly angle: number }
  | { readonly type: 'steer'; readonly direction: -1 | 1 }
  | { readonly type: 'hop' }
  | { readonly type: 'bounce' }
  | { readonly type: 'boost' }
  | { readonly type: 'launch' }
  | { readonly type: 'toggle-pause' }
  | { readonly type: 'restart' }
  | { readonly type: 'teleport'; readonly x: number }
  | { readonly type: 'set-option'; readonly key: string; readonly value: number | boolean | string }
  | { readonly type: 'reserve'; readonly resourceId: string; readonly racerId: RacerId }
  | { readonly type: 'release-reservation'; readonly resourceId: string; readonly racerId: RacerId }
  | { readonly type: 'noop' };

export type GameCommandType = GameCommand['type'];

export interface CommandGate {
  readonly status: GameStatus;
  readonly phase: HeatPhase;
  /** False while a modal/menu owns input, or while the renderer is paused for authoring. */
  readonly inputEnabled: boolean;
  /** The racer issuing the command, when the command is player-scoped. */
  readonly racerId: RacerId | null;
}

export type CommandVerdict =
  | { readonly ok: true; readonly command: GameCommand }
  | { readonly ok: false; readonly code: ContractErrorCode; readonly reason: string; readonly command: GameCommand };

const allow = (command: GameCommand): CommandVerdict => Object.freeze({ ok: true as const, command });
const deny = (command: GameCommand, code: ContractErrorCode, reason: string): CommandVerdict =>
  Object.freeze({ ok: false as const, code, reason, command });

/** Stable identity used to deduplicate a command burst; identical commands collapse. */
export function commandKey(command: GameCommand): string {
  switch (command.type) {
    case 'aim': return `aim:${command.power.toFixed(4)}:${command.angle.toFixed(4)}`;
    case 'steer': return `steer:${command.direction}`;
    case 'set-option': return `set-option:${command.key}:${String(command.value)}`;
    case 'teleport': return `teleport:${command.x.toFixed(2)}`;
    case 'reserve':
    case 'release-reservation': return `${command.type}:${command.resourceId}:${command.racerId}`;
    default: return command.type;
  }
}

export function validateCommand(command: GameCommand, gate: CommandGate): CommandVerdict {
  if (!gate.inputEnabled && command.type !== 'noop') {
    return deny(command, 'E_COMMAND', 'Input is disabled right now.');
  }

  switch (command.type) {
    case 'noop':
      return allow(command);

    case 'aim':
      if (!isFiniteNumber(command.power) || !isFiniteNumber(command.angle)) {
        return deny(command, 'E_COMMAND', 'Aim needs finite power and angle values.');
      }
      if (command.power < 0.18 || command.power > 1 || command.angle < 12 || command.angle > 68) {
        return deny(command, 'E_COMMAND', `Aim ${command.power.toFixed(2)} / ${command.angle.toFixed(1)}° is outside the launch envelope.`);
      }
      return gate.status === 'ready' ? allow(command) : deny(command, 'E_COMMAND', `Aim is only available on the grid, not while "${gate.status}".`);

    case 'launch':
      return gate.status === 'ready' ? allow(command) : deny(command, 'E_COMMAND', `The field cannot be launched while "${gate.status}".`);

    case 'steer':
      if (command.direction !== -1 && command.direction !== 1) return deny(command, 'E_COMMAND', 'Steering direction must be -1 or 1.');
      // Racing is the base case; the grid also accepts steering so a staged lane
      // change sticks (T02 adopted this gate — the original condition only allowed
      // "ready" while the message promised "grid or racing").
      if (gate.status === 'ready' || gate.status === 'flying' || gate.status === 'paused') return allow(command);
      return deny(command, 'E_COMMAND', 'Steering is only available on the grid or while racing.');

    case 'hop':
    case 'bounce':
    case 'boost':
      return gate.status === 'ready' || gate.status === 'flying'
        ? allow(command)
        : deny(command, 'E_COMMAND', `"${command.type}" is not available while "${gate.status}".`);

    case 'toggle-pause':
      // Pausing is meaningful only once the field is out of staging and not yet read.
      if (gate.phase === 'release' || gate.phase === 'racing' || gate.phase === 'settling') return allow(command);
      return deny(command, 'E_COMMAND', `Pause is not available in heat phase "${gate.phase}".`);

    case 'restart':
      if (gate.phase === 'racing' || gate.phase === 'settling' || gate.phase === 'results') return allow(command);
      return deny(command, 'E_COMMAND', `Restart needs a raced heat; the current phase is "${gate.phase}".`);

    case 'teleport':
      if (!isFiniteNumber(command.x) || command.x < 0) return deny(command, 'E_COMMAND', `Teleport target ${String(command.x)} is invalid.`);
      return gate.status === 'ready' || gate.status === 'flying' || gate.status === 'paused'
        ? allow(command)
        : deny(command, 'E_COMMAND', `Teleport is not available while "${gate.status}".`);

    case 'set-option':
      if (typeof command.key !== 'string' || command.key === '') return deny(command, 'E_COMMAND', 'An option needs a key.');
      if (command.value === undefined || command.value === null) return deny(command, 'E_COMMAND', `Option "${command.key}" needs a value.`);
      return allow(command);

    case 'reserve':
      if (command.resourceId === '' || !Number.isSafeInteger(command.racerId) || command.racerId < 0) {
        return deny(command, 'E_COMMAND', 'A reservation needs a resource ID and a valid holder.');
      }
      return allow(command);

    case 'release-reservation':
      if (command.resourceId === '' || !Number.isSafeInteger(command.racerId) || command.racerId < 0) {
        return deny(command, 'E_COMMAND', 'A release needs a resource ID and a valid holder.');
      }
      return allow(command);

    default: {
      const never: never = command;
      throw new ContractError('E_COMMAND', `Unknown command ${JSON.stringify(never)}`);
    }
  }
}

/**
 * Collapses a burst of commands: identical consecutive commands are dropped, and no-ops are
 * discarded entirely. Order is otherwise preserved.
 */
export function dedupeCommands(commands: readonly GameCommand[]): readonly GameCommand[] {
  const out: GameCommand[] = [];
  let previous = '';
  for (const command of commands) {
    if (command.type === 'noop') continue;
    const key = commandKey(command);
    if (key === previous) continue;
    previous = key;
    out.push(command);
  }
  return Object.freeze(out);
}

export function describeCommand(command: GameCommand): string {
  const parts = Object.entries(command as Record<string, unknown>)
    .filter(([key]) => key !== 'type')
    .map(([key, value]) => `${key}=${String(value)}`);
  return `${command.type}${parts.length ? ` ${parts.join(' ')}` : ''}`;
}

/** Queue used by the headless seam and by the UI bridge; dedupes on push. */
export class CommandQueue {
  private readonly pending: GameCommand[] = [];
  private lastKey = '';

  push(command: GameCommand): boolean {
    if (command.type === 'noop') return false;
    const key = commandKey(command);
    if (key === this.lastKey) return false;
    this.lastKey = key;
    this.pending.push(command);
    return true;
  }

  drain(): readonly GameCommand[] {
    const out = Object.freeze([...this.pending]);
    this.pending.length = 0;
    return out;
  }

  get size(): number { return this.pending.length; }
  clear(): void { this.pending.length = 0; this.lastKey = ''; }
}
