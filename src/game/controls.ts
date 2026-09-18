/**
 * Customizable key bindings for Goblin Rally.
 * Manages persistence in localStorage under `goblin-rally-keybindings-v1`,
 * provides display labels and conflict detection.
 */

export const STORAGE_KEY = 'goblin-rally-keybindings-v1';

export type ActionId = 'steerLeft' | 'steerRight' | 'bounce' | 'boost' | 'pause';

export interface ActionMeta {
  id: ActionId;
  label: string;
  description: string;
  /** Default key codes for this action (in order displayed as pills). */
  defaults: string[];
}

export const ACTIONS: ActionMeta[] = [
  {
    id: 'steerLeft',
    label: 'Steer Left',
    description: 'Move to the lane on the left / shoulder rivals',
    defaults: ['KeyA', 'ArrowLeft'],
  },
  {
    id: 'steerRight',
    label: 'Steer Right',
    description: 'Move to the lane on the right / shoulder rivals',
    defaults: ['KeyD', 'ArrowRight'],
  },
  {
    id: 'bounce',
    label: 'Air Bounce',
    description: 'Bounce off springs & stay airborne',
    defaults: ['Space'],
  },
  {
    id: 'boost',
    label: 'Turbo Boost',
    description: 'Nitro burst for maximum speed',
    defaults: ['ShiftLeft', 'ShiftRight'],
  },
  {
    id: 'pause',
    label: 'Pause Game',
    description: 'Pause or resume the race',
    defaults: ['KeyP', 'Escape'],
  },
];

export type KeyBindings = Record<ActionId, string[]>;

function cloneDefaults(): KeyBindings {
  const out = {} as KeyBindings;
  for (const action of ACTIONS) {
    out[action.id] = [...action.defaults];
  }
  return out;
}

export function getDefaultBindings(): KeyBindings {
  return cloneDefaults();
}

/** Human-friendly label for a KeyboardEvent.code value. */
export function formatKey(code: string): string {
  if (!code) return '—';
  if (code === 'Space') return 'SPACE';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'Escape') return 'ESC';
  if (code === 'Enter') return 'ENTER';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  // Fallback: strip common prefixes and uppercase
  return code.replace('Left', '').replace('Right', '');
}

export function normalizeCode(code: string): string {
  // Store exactly the `event.code` string (e.g. "KeyA", "Space").
  // Normalise empty to "" for validation.
  return code ?? '';
}

function isValidBindingsShape(value: unknown): value is KeyBindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  for (const action of ACTIONS) {
    const arr = obj[action.id];
    if (!Array.isArray(arr)) return false;
    if (arr.length === 0) return false;
    for (const code of arr) {
      if (typeof code !== 'string' || code.length === 0) return false;
    }
  }
  return true;
}

export function loadBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultBindings();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidBindingsShape(parsed)) return getDefaultBindings();
    // Clone to avoid accidental mutation of parsed arrays affecting storage
    const out = {} as KeyBindings;
    for (const action of ACTIONS) {
      // Filter empty strings and dedupe within action while preserving order
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const code of parsed[action.id] as string[]) {
        const n = normalizeCode(code);
        if (!n) continue;
        if (!seen.has(n)) {
          seen.add(n);
          cleaned.push(n);
        }
      }
      out[action.id] = cleaned.length ? cleaned : [...action.defaults];
    }
    return out;
  } catch {
    return getDefaultBindings();
  }
}

export function saveBindings(bindings: KeyBindings): boolean {
  try {
    // Validate before saving – ensure at least one code per action
    for (const action of ACTIONS) {
      if (!Array.isArray(bindings[action.id]) || bindings[action.id].length === 0) return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    // Notify listeners
    try {
      window.dispatchEvent(new CustomEvent('goblin-bindings-changed', { detail: bindings }));
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

export function resetBindings(): KeyBindings {
  const defaults = getDefaultBindings();
  saveBindings(defaults);
  return defaults;
}

/** Map from code -> list of {action, index} that use it. */
export function getConflicts(bindings: KeyBindings): Map<string, { action: ActionId; index: number }[]> {
  const map = new Map<string, { action: ActionId; index: number }[]>();
  for (const action of ACTIONS) {
    const codes = bindings[action.id] ?? [];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (!code) continue;
      const list = map.get(code) ?? [];
      list.push({ action: action.id, index: i });
      map.set(code, list);
    }
  }
  // Keep only codes with more than one occurrence
  for (const [code, list] of [...map.entries()]) {
    if (list.length <= 1) map.delete(code);
  }
  return map;
}

/** Set of codes that are duplicated across any actions/slots. */
export function getConflictCodes(bindings: KeyBindings): Set<string> {
  return new Set(getConflicts(bindings).keys());
}

export function isDuplicateCode(code: string, bindings: KeyBindings, exclude?: { action: ActionId; index: number }): boolean {
  if (!code) return false;
  for (const action of ACTIONS) {
    const codes = bindings[action.id] ?? [];
    for (let i = 0; i < codes.length; i++) {
      if (exclude && exclude.action === action.id && exclude.index === i) continue;
      if (codes[i] === code) return true;
    }
  }
  return false;
}

export function getActionForCode(code: string, bindings?: KeyBindings): ActionId | null {
  const b = bindings ?? loadBindings();
  for (const action of ACTIONS) {
    if ((b[action.id] ?? []).includes(code)) return action.id;
  }
  // Also handle synonym: ShiftLeft/ShiftRight both map to boost, but if both map to SHIFT label,
  // we want either shift to count even if only one stored (defensive).
  // No extra magic needed – check includes handles both entries.
  return null;
}

export function hasBinding(code: string, action: ActionId, bindings?: KeyBindings): boolean {
  const b = bindings ?? loadBindings();
  return (b[action] ?? []).includes(code);
}

/** Display helpers */
export function describeBindings(bindings: KeyBindings): Record<ActionId, string> {
  const out = {} as Record<ActionId, string>;
  for (const action of ACTIONS) {
    out[action.id] = (bindings[action.id] ?? []).map(formatKey).join(' / ');
  }
  return out;
}
