export interface Bindings {
  steerLeft: readonly string[];
  steerRight: readonly string[];
  throttle: readonly string[];
  brake: readonly string[];
  item: readonly string[];
  reset: readonly string[];
}

export const DEFAULT_BINDINGS: Bindings = {
  steerLeft: ['ArrowLeft', 'KeyA'],
  steerRight: ['ArrowRight', 'KeyD'],
  throttle: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  item: ['Space', 'ShiftLeft'],
  reset: ['KeyR'],
};

export interface DriverInput {
  steer: number;
  throttle: number;
  brake: number;
  item: boolean;
  reset: boolean;
}

export interface TouchInput {
  steer?: number;
  throttle?: number;
  brake?: number;
  item?: boolean;
}

export interface PadState {
  axes: readonly number[];
  buttons: readonly (boolean | { pressed: boolean; value: number })[];
}

export interface InputOptions {
  bindings?: Bindings;
  steerRate?: number;
  steerReturn?: number;
  deadzone?: number;
}

export interface InputState {
  keyDown(code: string): void;
  keyUp(code: string): void;
  blur(): void;
  setTouch(t: TouchInput | null): void;
  setGamepad(p: PadState | null): void;
  update(dtMs: number): void;
  sample(): DriverInput;
  reset(): void;
}

const finiteOrZero = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const strongest = (values: readonly number[]): number => {
  let result = values[0] ?? 0;
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    if (Math.abs(value) > Math.abs(result)) result = value;
  }
  return result;
};

const isPressed = (button: PadState['buttons'][number] | undefined): boolean =>
  typeof button === 'boolean' ? button : button?.pressed ?? false;

const buttonValue = (button: PadState['buttons'][number] | undefined): number => {
  if (typeof button === 'boolean') return button ? 1 : 0;
  return finiteOrZero(button?.value);
};

const anyBoundKeyHeld = (held: ReadonlySet<string>, codes: readonly string[]): boolean =>
  codes.some((code) => held.has(code));

const rateOption = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback;

export function createInputState(options: InputOptions = {}): InputState {
  const sourceBindings = options.bindings ?? DEFAULT_BINDINGS;
  const bindings: Bindings = {
    steerLeft: [...sourceBindings.steerLeft],
    steerRight: [...sourceBindings.steerRight],
    throttle: [...sourceBindings.throttle],
    brake: [...sourceBindings.brake],
    item: [...sourceBindings.item],
    reset: [...sourceBindings.reset],
  };
  const knownCodes = new Set<string>([
    ...bindings.steerLeft,
    ...bindings.steerRight,
    ...bindings.throttle,
    ...bindings.brake,
    ...bindings.item,
    ...bindings.reset,
  ]);
  const steerRate = rateOption(options.steerRate, 6);
  const steerReturn = rateOption(options.steerReturn, 9);
  const requestedDeadzone = options.deadzone;
  const deadzone = requestedDeadzone !== undefined && Number.isFinite(requestedDeadzone)
    ? clamp(requestedDeadzone, 0, 0.999999)
    : 0.12;

  const heldKeys = new Set<string>();
  let keyboardSteer = 0;
  let touch: TouchInput | null = null;
  let gamepad: PadState | null = null;

  const keyboardThrottle = (): number => anyBoundKeyHeld(heldKeys, bindings.throttle) ? 1 : 0;
  const keyboardBrake = (): number => anyBoundKeyHeld(heldKeys, bindings.brake) ? 1 : 0;
  const keyboardItem = (): boolean => anyBoundKeyHeld(heldKeys, bindings.item);
  const keyboardReset = (): boolean => anyBoundKeyHeld(heldKeys, bindings.reset);

  const gamepadSteer = (): number => {
    if (gamepad === null) return 0;
    const axis = finiteOrZero(gamepad.axes[0]);
    const magnitude = Math.abs(axis);
    if (magnitude < deadzone) return 0;
    return Math.sign(axis) * ((magnitude - deadzone) / (1 - deadzone));
  };

  const gamepadThrottle = (): number => {
    if (gamepad === null) return 0;
    return Math.max(buttonValue(gamepad.buttons[7]), isPressed(gamepad.buttons[0]) ? 1 : 0);
  };

  const gamepadBrake = (): number => {
    if (gamepad === null) return 0;
    return Math.max(buttonValue(gamepad.buttons[6]), isPressed(gamepad.buttons[1]) ? 1 : 0);
  };

  const gamepadItem = (): boolean => gamepad !== null && isPressed(gamepad.buttons[2]);
  const gamepadReset = (): boolean => gamepad !== null && isPressed(gamepad.buttons[3]);

  return {
    keyDown(code) {
      if (knownCodes.has(code)) heldKeys.add(code);
    },
    keyUp(code) {
      if (knownCodes.has(code)) heldKeys.delete(code);
    },
    blur() {
      heldKeys.clear();
      keyboardSteer = 0;
    },
    setTouch(value) {
      touch = value === null ? null : { ...value };
    },
    setGamepad(value) {
      gamepad = value === null
        ? null
        : {
            axes: value.axes.map((axis) => finiteOrZero(axis)),
            buttons: value.buttons.map((button) => typeof button === 'boolean'
              ? button
              : { pressed: button.pressed, value: finiteOrZero(button.value) }),
          };
    },
    update(dtMs) {
      if (!Number.isFinite(dtMs) || dtMs < 0) return;

      const target = Number(anyBoundKeyHeld(heldKeys, bindings.steerRight))
        - Number(anyBoundKeyHeld(heldKeys, bindings.steerLeft));
      const rate = target === 0 ? steerReturn : steerRate;
      const step = rate * (dtMs / 1000);
      const difference = target - keyboardSteer;
      if (Math.abs(difference) <= step) {
        keyboardSteer = target;
      } else if (difference > 0) {
        keyboardSteer += step;
      } else {
        keyboardSteer -= step;
      }
      keyboardSteer = clamp(keyboardSteer, -1, 1);
    },
    sample() {
      const steer = strongest([keyboardSteer, gamepadSteer(), finiteOrZero(touch?.steer)]);
      const throttle = strongest([keyboardThrottle(), gamepadThrottle(), finiteOrZero(touch?.throttle)]);
      const brake = strongest([keyboardBrake(), gamepadBrake(), finiteOrZero(touch?.brake)]);

      return {
        steer: clamp(steer, -1, 1),
        throttle: clamp(throttle, 0, 1),
        brake: clamp(brake, 0, 1),
        item: keyboardItem() || gamepadItem() || touch?.item === true,
        reset: keyboardReset() || gamepadReset(),
      };
    },
    reset() {
      heldKeys.clear();
      keyboardSteer = 0;
      touch = null;
      gamepad = null;
    },
  };
}

export function toActorFrame(d: DriverInput): Record<string, number | boolean> {
  return {
    steer: d.steer,
    throttle: d.throttle,
    brake: d.brake,
    item: d.item,
    reset: d.reset,
  };
}