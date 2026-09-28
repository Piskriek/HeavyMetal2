/**
 * H10 — gamepad input.
 *
 * Two layers. `GamepadMapper` is pure: it turns one frame of pad state (axes and buttons, in the
 * browser's standard mapping) into the same `GameCommand`s the keyboard sends, so it can be tested
 * without a browser. `GamepadController` is the browser side: it listens for pads connecting,
 * polls `navigator.getGamepads()` once per engine frame, and plays rumble.
 *
 * Standard mapping: stick or d-pad left/right steers (one lane per push), A / Cross or the left
 * trigger bounces, X / Square, the right bumper or the right trigger boosts, Start / Options pauses.
 */
import type { GameCommand } from '../contracts/commands';
import { GAMEPAD_BINDINGS } from '../controls';

/** One frame of a pad, as the Gamepad API reports it (only what the mapper reads). */
export interface PadState {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** The stick steers once past this deflection… */
export const STICK_FIRE = 0.5;
/** …and must come back inside this before it can steer again (hysteresis). */
export const STICK_REARM = 0.25;
/** A trigger counts as pressed past this travel. */
export const TRIGGER_PRESS = 0.5;

const pressed = (pad: PadState, index: number): boolean => {
  const button = pad.buttons[index];
  return Boolean(button && (button.pressed || button.value > TRIGGER_PRESS));
};

export class GamepadMapper {
  /** The stick's side while it is held past STICK_FIRE (0 once it is back inside STICK_REARM). */
  private stickSide: -1 | 0 | 1 = 0;
  private readonly held = new Set<number>();

  /** Commands for this frame. Buttons fire on press, not while held; the stick once per push. */
  update(pad: PadState): GameCommand[] {
    const out: GameCommand[] = [];
    const x = pad.axes[0] ?? 0;
    if (this.stickSide === 0 && Math.abs(x) > STICK_FIRE) {
      this.stickSide = x < 0 ? -1 : 1;
      out.push({ type: 'steer', direction: this.stickSide });
    } else if (this.stickSide !== 0 && Math.abs(x) < STICK_REARM) {
      this.stickSide = 0;
    }
    const edge = (indices: readonly number[], command: GameCommand) => {
      let fire = false;
      for (const index of indices) {
        const down = pressed(pad, index);
        if (down && !this.held.has(index)) fire = true;
        if (down) this.held.add(index); else this.held.delete(index);
      }
      if (fire) out.push(command);
    };
    edge(GAMEPAD_BINDINGS.steerLeft, { type: 'steer', direction: -1 });
    edge(GAMEPAD_BINDINGS.steerRight, { type: 'steer', direction: 1 });
    edge(GAMEPAD_BINDINGS.bounce, { type: 'bounce' });
    edge(GAMEPAD_BINDINGS.boost, { type: 'boost' });
    edge(GAMEPAD_BINDINGS.pause, { type: 'toggle-pause' });
    return out;
  }

  reset(): void { this.stickSide = 0; this.held.clear(); }
}

export type RumbleKind = 'bump' | 'boost';

/** Rumble shapes: a hit is a low, strong thud; a boost a quick high buzz. */
export const RUMBLE: Readonly<Record<RumbleKind, { duration: number; strongMagnitude: number; weakMagnitude: number }>> = {
  bump: { duration: 150, strongMagnitude: 0.9, weakMagnitude: 0.3 },
  boost: { duration: 250, strongMagnitude: 0.15, weakMagnitude: 0.7 },
};

interface RumbleActuator { playEffect?(type: string, params: Record<string, number>): Promise<unknown> }
type BrowserPad = PadState & { readonly index: number; readonly id: string; readonly connected: boolean; readonly vibrationActuator?: RumbleActuator | null };

/** The browser side: connection events, polling and rumble. Inert where there is no Gamepad API. */
export class GamepadController {
  private readonly mapper = new GamepadMapper();
  private padIndex: number | null = null;
  private readonly onConnected = (event: Event) => {
    const pad = (event as Event & { gamepad?: BrowserPad }).gamepad;
    if (!pad) return;
    this.padIndex = pad.index;
    this.mapper.reset();
    this.onConnect?.(pad.id);
  };
  private readonly onDisconnected = (event: Event) => {
    const pad = (event as Event & { gamepad?: BrowserPad }).gamepad;
    if (pad && pad.index === this.padIndex) { this.padIndex = null; this.mapper.reset(); }
  };

  constructor(private readonly onConnect?: (name: string) => void) {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', this.onConnected);
    window.addEventListener('gamepaddisconnected', this.onDisconnected);
  }

  get connected(): boolean { return this.padIndex !== null; }

  private pad(): BrowserPad | null {
    if (this.padIndex === null || typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pad = navigator.getGamepads()[this.padIndex] as BrowserPad | null;
    return pad && pad.connected ? pad : null;
  }

  /** This frame's commands from the connected pad (none when there is none). */
  poll(): GameCommand[] {
    const pad = this.pad();
    return pad ? this.mapper.update(pad) : [];
  }

  /** Plays a rumble, scaled by `intensity` (0..1). Silently does nothing without an actuator. */
  rumble(kind: RumbleKind, intensity = 1): void {
    const actuator = this.pad()?.vibrationActuator;
    if (!actuator?.playEffect) return;
    const shape = RUMBLE[kind];
    const scale = Math.max(0, Math.min(1, intensity));
    void actuator.playEffect('dual-rumble', {
      startDelay: 0, duration: shape.duration,
      strongMagnitude: shape.strongMagnitude * scale, weakMagnitude: shape.weakMagnitude * scale,
    }).catch(() => undefined);
  }

  destroy(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('gamepadconnected', this.onConnected);
    window.removeEventListener('gamepaddisconnected', this.onDisconnected);
  }
}
