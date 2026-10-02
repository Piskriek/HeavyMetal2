import type { InputState, PadState } from './state';

interface KeyboardLikeEvent {
  code: string;
  repeat?: boolean;
  preventDefault?: () => void;
}

const DEFAULT_PREVENT_DEFAULT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

const asKeyboardEvent = (event: Event): KeyboardLikeEvent | null => {
  const candidate = event as Event & Partial<KeyboardLikeEvent>;
  return typeof candidate.code === 'string' ? candidate as KeyboardLikeEvent : null;
};

const isWindowLike = (target: EventTarget): boolean => {
  const candidate = target as EventTarget & {
    self?: unknown;
    window?: unknown;
  };
  const constructorName = (target as EventTarget & { constructor?: { name?: string } }).constructor?.name;
  return candidate.self === target || candidate.window === target || constructorName === 'Window';
};

export function attachKeyboard(
  target: EventTarget,
  state: InputState,
  options?: { preventDefaultFor?: readonly string[] },
): () => void {
  const preventDefaultFor = new Set(options?.preventDefaultFor ?? DEFAULT_PREVENT_DEFAULT);

  const onKeyDown = (event: Event): void => {
    const keyboardEvent = asKeyboardEvent(event);
    if (keyboardEvent === null) return;
    if (preventDefaultFor.has(keyboardEvent.code)) keyboardEvent.preventDefault?.();
    if (!keyboardEvent.repeat) state.keyDown(keyboardEvent.code);
  };

  const onKeyUp = (event: Event): void => {
    const keyboardEvent = asKeyboardEvent(event);
    if (keyboardEvent !== null) state.keyUp(keyboardEvent.code);
  };

  const onBlur = (): void => state.blur();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  const listensForBlur = isWindowLike(target);
  if (listensForBlur) target.addEventListener('blur', onBlur);

  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    if (listensForBlur) target.removeEventListener('blur', onBlur);
  };
}

export function pollGamepads(
  getGamepads: () => readonly (PadState | null)[],
  state: InputState,
): void {
  const pads = getGamepads();
  for (const pad of pads) {
    if (pad !== null) {
      state.setGamepad(pad);
      return;
    }
  }
  state.setGamepad(null);
}