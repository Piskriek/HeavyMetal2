/**
 * The 3D Map Editor's key bindings: one list of actions, their default keys, the player's own
 * bindings on top (Settings → Keys in the editor's shortcut sheet), and one matcher the editor asks.
 *
 * Rules the defaults keep, so no key does two things at once:
 * - The fly keys (W A S D, Space, Z/Q, Shift) only fly. The gizmo moved off W/E/R/Q: G grabs (move),
 *   R rotates, T scales, O switches its space (world / local / along the track).
 * - Escape never leaves the editor: it cancels a drag, puts the tool down, or deselects.
 * - Number keys pick pieces in Easy Build; 5 is the nudge axis only in Pro mode.
 * - A chord belongs to one action per mode. Binding a key that is taken moves it (the other action
 *   loses that key), and the sheet says so.
 *
 * Chords are `KeyboardEvent.code` with modifiers in the order Ctrl, Alt, Shift: 'KeyG', 'Ctrl+KeyZ',
 * 'Alt+Digit7'. Cmd on a Mac counts as Ctrl.
 */

export type EditorMode = 'pro' | 'easy';

export type BuilderActionGroup = 'fly' | 'camera' | 'tools' | 'gizmo' | 'edit' | 'view' | 'easy';

export interface BuilderAction {
  id: string;
  label: string;
  group: BuilderActionGroup;
  /** Default chords. The first is the one shown on buttons. */
  keys: readonly string[];
  /** Only in this mode (both when absent). */
  mode?: EditorMode;
  /** Held keys (flying) are read every frame, not on press. */
  held?: boolean;
}

export const BUILDER_KEY_GROUPS: readonly { id: BuilderActionGroup; label: string }[] = [
  { id: 'easy', label: 'Easy Build' },
  { id: 'tools', label: 'Tools' },
  { id: 'gizmo', label: 'Move, rotate, scale' },
  { id: 'edit', label: 'Editing' },
  { id: 'camera', label: 'Camera' },
  { id: 'fly', label: 'Flying (hold)' },
  { id: 'view', label: 'Workspace' },
];

const digit = (n: number) => `Digit${n}`;

export const BUILDER_ACTIONS: readonly BuilderAction[] = [
  // Flying: held keys.
  { id: 'fly.forward', label: 'Fly forward', group: 'fly', keys: ['KeyW'], held: true },
  { id: 'fly.back', label: 'Fly back', group: 'fly', keys: ['KeyS'], held: true },
  { id: 'fly.left', label: 'Fly left', group: 'fly', keys: ['KeyA'], held: true },
  { id: 'fly.right', label: 'Fly right', group: 'fly', keys: ['KeyD'], held: true },
  { id: 'fly.up', label: 'Fly up', group: 'fly', keys: ['Space'], held: true },
  { id: 'fly.down', label: 'Fly down', group: 'fly', keys: ['KeyZ', 'KeyQ'], held: true },
  { id: 'fly.fast', label: 'Fly fast', group: 'fly', keys: ['ShiftLeft', 'ShiftRight'], held: true },
  // Camera.
  { id: 'camera.focus', label: 'Frame the picked piece', group: 'camera', keys: ['KeyF'] },
  { id: 'camera.top', label: 'Top view', group: 'camera', keys: ['Numpad7', 'Alt+Digit7'] },
  { id: 'camera.front', label: 'Front view', group: 'camera', keys: ['Numpad1', 'Alt+Digit1'] },
  { id: 'camera.side', label: 'Side view', group: 'camera', keys: ['Numpad3', 'Alt+Digit3'] },
  { id: 'camera.iso', label: 'Three-quarter view', group: 'camera', keys: ['Numpad0', 'Alt+Digit0'] },
  // Tools.
  { id: 'tool.select', label: 'Select tool (put the piece down)', group: 'tools', keys: ['KeyV'] },
  { id: 'tool.clickMove', label: 'Drag-move on / off', group: 'tools', keys: ['KeyM'], mode: 'pro' },
  { id: 'mode.toggle', label: 'Switch Easy Build / Pro', group: 'tools', keys: ['Backquote'] },
  { id: 'race.test', label: 'Test race', group: 'tools', keys: ['KeyP'] },
  // Gizmo.
  { id: 'gizmo.move', label: 'Move handles', group: 'gizmo', keys: ['KeyG'] },
  { id: 'gizmo.rotate', label: 'Rotate handles', group: 'gizmo', keys: ['KeyR'] },
  { id: 'gizmo.scale', label: 'Scale handles', group: 'gizmo', keys: ['KeyT'] },
  { id: 'gizmo.space', label: 'Handle space (world / local / track)', group: 'gizmo', keys: ['KeyO'], mode: 'pro' },
  // Editing.
  { id: 'edit.undo', label: 'Undo', group: 'edit', keys: ['Ctrl+KeyZ'] },
  { id: 'edit.redo', label: 'Redo', group: 'edit', keys: ['Ctrl+KeyY', 'Ctrl+Shift+KeyZ'] },
  { id: 'edit.duplicate', label: 'Duplicate', group: 'edit', keys: ['Ctrl+KeyD'] },
  { id: 'edit.delete', label: 'Delete', group: 'edit', keys: ['Delete', 'Backspace'] },
  { id: 'edit.group', label: 'Group', group: 'edit', keys: ['Ctrl+KeyG'], mode: 'pro' },
  { id: 'edit.ungroup', label: 'Ungroup', group: 'edit', keys: ['Ctrl+Shift+KeyG'], mode: 'pro' },
  { id: 'edit.flip', label: 'Mirror', group: 'edit', keys: ['KeyX'] },
  { id: 'edit.turnLeft', label: 'Turn left 15°', group: 'edit', keys: ['KeyE'], mode: 'easy' },
  { id: 'edit.turnRight', label: 'Turn right 15°', group: 'edit', keys: ['KeyC'], mode: 'easy' },
  { id: 'edit.tiltLeft', label: 'Tilt left', group: 'edit', keys: ['BracketLeft'], mode: 'pro' },
  { id: 'edit.tiltRight', label: 'Tilt right', group: 'edit', keys: ['BracketRight'], mode: 'pro' },
  { id: 'edit.nudgeAxis', label: 'Arrow keys: next nudge axis', group: 'edit', keys: ['Digit5', 'Numpad5'], mode: 'pro' },
  { id: 'edit.cancel', label: 'Cancel / put down / deselect', group: 'edit', keys: ['Escape'] },
  // Workspace.
  { id: 'view.zen', label: 'Hide the panels', group: 'view', keys: ['KeyH', 'Tab'] },
  { id: 'view.help', label: 'This sheet', group: 'view', keys: ['Shift+Slash', 'F1'] },
  { id: 'view.exit', label: 'Leave the editor', group: 'view', keys: ['KeyB'] },
  // Easy Build.
  { id: 'easy.prev', label: 'Back along the road', group: 'easy', keys: ['Comma'], mode: 'easy' },
  { id: 'easy.next', label: 'On along the road', group: 'easy', keys: ['Period'], mode: 'easy' },
  { id: 'easy.side', label: 'Next spot (left, middle, right, roadside)', group: 'easy', keys: ['KeyL'], mode: 'easy' },
  { id: 'easy.place', label: 'Drop the piece here', group: 'easy', keys: ['Enter', 'NumpadEnter'], mode: 'easy' },
  { id: 'easy.prevShelf', label: 'Previous shelf', group: 'easy', keys: ['KeyK'], mode: 'easy' },
  { id: 'easy.nextShelf', label: 'Next shelf', group: 'easy', keys: ['KeyJ'], mode: 'easy' },
  ...Array.from({ length: 9 }, (_, i): BuilderAction => ({
    id: `easy.item${i + 1}`, label: `Piece ${i + 1} on the shelf`, group: 'easy', keys: [digit(i + 1)], mode: 'easy',
  })),
];

const ACTION_BY_ID = new Map(BUILDER_ACTIONS.map((a) => [a.id, a]));

export const BUILDER_KEYS_STORAGE = 'hm2-builder-keys-v1';

/** The player's own bindings: action id → chords (an empty list unbinds it). */
export type KeyOverrides = Record<string, string[]>;

type KeyEventLike = { code: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean };

const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

/** 'Ctrl+Shift+KeyZ' for a key event (Cmd counts as Ctrl). A lone modifier is its own code. */
export function chordOf(e: KeyEventLike): string {
  if (MODIFIER_CODES.has(e.code)) return e.code;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.code);
  return parts.join('+');
}

const CODE_NAMES: Record<string, string> = {
  Space: 'Space', Escape: 'Esc', Backquote: '`', Comma: ',', Period: '.', Slash: '/', Enter: 'Enter',
  NumpadEnter: 'Num Enter', BracketLeft: '[', BracketRight: ']', Delete: 'Del', Backspace: 'Bksp',
  Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', Minus: '-', Equal: '=', Semicolon: ';',
  Quote: "'", Backslash: '\\', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

/** A chord as a player reads it: 'Ctrl+Shift+KeyZ' → 'Ctrl+Shift+Z', 'Numpad7' → 'Num 7'. */
export function prettyChord(chord: string): string {
  if (chord === 'Shift+Slash') return '?';
  return chord.split('+').map((part) => {
    if (part === 'Ctrl' || part === 'Alt' || part === 'Shift') return part;
    if (CODE_NAMES[part]) return CODE_NAMES[part];
    if (part.startsWith('Key')) return part.slice(3);
    if (part.startsWith('Digit')) return part.slice(5);
    if (part.startsWith('Numpad')) return `Num ${part.slice(6)}`;
    return part;
  }).join('+');
}

export function readKeyOverrides(store: Pick<Storage, 'getItem'> | null = safeStorage()): KeyOverrides {
  try {
    const raw = store?.getItem(BUILDER_KEYS_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: KeyOverrides = {};
    for (const [id, keys] of Object.entries(parsed as Record<string, unknown>)) {
      if (!ACTION_BY_ID.has(id) || !Array.isArray(keys)) continue;
      out[id] = keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length < 40).slice(0, 4);
    }
    return out;
  } catch { return {}; }
}

export function writeKeyOverrides(overrides: KeyOverrides, store: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()) {
  try {
    if (Object.keys(overrides).length) store?.setItem(BUILDER_KEYS_STORAGE, JSON.stringify(overrides));
    else store?.removeItem(BUILDER_KEYS_STORAGE);
  } catch { /* a full or missing store keeps the bindings for this visit only */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

const shareMode = (a: BuilderAction, b: BuilderAction) => !a.mode || !b.mode || a.mode === b.mode;

/** A resolved set of bindings: what each action's keys are, and which action a key press means. */
export class BuilderKeys {
  readonly overrides: KeyOverrides;
  private readonly bound = new Map<string, readonly string[]>();

  constructor(overrides: KeyOverrides = {}) {
    this.overrides = overrides;
    for (const action of BUILDER_ACTIONS) this.bound.set(action.id, overrides[action.id] ?? action.keys);
  }

  keysOf(id: string): readonly string[] { return this.bound.get(id) ?? []; }

  /** The key to print on a button ('' when unbound). */
  label(id: string): string {
    const first = this.keysOf(id)[0];
    return first ? prettyChord(first) : '';
  }

  /** Which pressed action a key event is in this mode (held fly keys never match here). */
  match(e: KeyEventLike, mode: EditorMode): string | null {
    const chord = chordOf(e);
    for (const action of BUILDER_ACTIONS) {
      if (action.held || (action.mode && action.mode !== mode)) continue;
      if (this.keysOf(action.id).includes(chord)) return action.id;
    }
    return null;
  }

  /** Is this held action's key down (for flying)? Held keys are bare codes. */
  held(id: string, down: ReadonlySet<string>): boolean {
    return this.keysOf(id).some((k) => down.has(k.split('+').pop()!));
  }

  /** Actions (sharing a mode with `id`) that already use `chord`. */
  conflicts(id: string, chord: string): BuilderAction[] {
    const me = ACTION_BY_ID.get(id);
    if (!me) return [];
    return BUILDER_ACTIONS.filter((a) => a.id !== id && shareMode(a, me) && this.keysOf(a.id).includes(chord));
  }

  /**
   * Bind `chord` as the action's only key. Anything else in a shared mode loses that chord.
   * Returns the new overrides and the labels of the actions that lost it.
   */
  rebind(id: string, chord: string): { overrides: KeyOverrides; moved: string[] } {
    const overrides: KeyOverrides = { ...this.overrides };
    const moved: string[] = [];
    for (const other of this.conflicts(id, chord)) {
      overrides[other.id] = this.keysOf(other.id).filter((k) => k !== chord);
      moved.push(other.label);
    }
    overrides[id] = [chord];
    return { overrides: normalizeOverrides(overrides), moved };
  }

  /** Back to the defaults for one action. */
  reset(id: string): KeyOverrides {
    const overrides = { ...this.overrides };
    delete overrides[id];
    return overrides;
  }
}

/** Drop overrides that equal the defaults, so a reset list stays empty. */
function normalizeOverrides(overrides: KeyOverrides): KeyOverrides {
  const out: KeyOverrides = {};
  for (const [id, keys] of Object.entries(overrides)) {
    const action = ACTION_BY_ID.get(id);
    if (!action) continue;
    if (keys.length === action.keys.length && keys.every((k, i) => k === action.keys[i])) continue;
    out[id] = keys;
  }
  return out;
}

/** Keys the player may not take (the browser or the OS owns them). */
export function reservedChord(chord: string): string | null {
  if (/^Ctrl\+(Shift\+)?Key[WTNR]$/.test(chord) || chord === 'Ctrl+Tab' || chord === 'F5' || chord === 'F11' || chord === 'F12') {
    return 'The browser uses that key.';
  }
  if (chord.startsWith('Alt+Tab') || chord.startsWith('Alt+F4')) return 'The system uses that key.';
  return null;
}

/** Every pair of actions sharing a mode and a chord (the defaults must have none). */
export function findBindingConflicts(keys: BuilderKeys): { chord: string; ids: [string, string] }[] {
  const out: { chord: string; ids: [string, string] }[] = [];
  for (let i = 0; i < BUILDER_ACTIONS.length; i++) {
    for (let j = i + 1; j < BUILDER_ACTIONS.length; j++) {
      const a = BUILDER_ACTIONS[i], b = BUILDER_ACTIONS[j];
      if (!shareMode(a, b)) continue;
      for (const chord of keys.keysOf(a.id)) {
        if (keys.keysOf(b.id).includes(chord)) out.push({ chord, ids: [a.id, b.id] });
      }
    }
  }
  return out;
}

export const builderAction = (id: string) => ACTION_BY_ID.get(id);
