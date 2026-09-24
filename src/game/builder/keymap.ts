/**
 * IF-KEYMAP: Scoped key bindings for Heavy Metal GP 2.
 * Eliminates key collision between race inputs and DCC-style 3D builder controls.
 */

export type KeyScope = 'race' | 'builder' | 'builder.fly' | 'text-input';

export interface Binding {
  id: string;                 // e.g. 'gizmo.translate', 'race.restart'
  chord: string;              // 'KeyW' | 'Ctrl+KeyZ' | 'Alt+Digit7'
  scope: KeyScope;
  when?: 'rmbHeld' | 'rmbReleased';
  label: string;              // human-readable description for cheat sheets
}

export const RACE_BINDINGS: readonly Binding[] = [
  { id: 'race.restart', chord: 'KeyR', scope: 'race', label: 'Restart Race' },
  { id: 'race.fullscreen', chord: 'KeyF', scope: 'race', label: 'Toggle Fullscreen' },
  { id: 'race.camera', chord: 'KeyC', scope: 'race', label: 'Cycle Camera' },
  { id: 'race.builder', chord: 'KeyB', scope: 'race', label: 'Toggle 3D Builder' },
  { id: 'race.mute', chord: 'KeyM', scope: 'race', label: 'Toggle Audio Mute' },
  { id: 'race.start', chord: 'Enter', scope: 'race', label: 'Start / Retry' },
  { id: 'race.jump', chord: 'Space', scope: 'race', when: 'rmbReleased', label: 'Ready / Jump' },
  { id: 'race.menu', chord: 'Escape', scope: 'race', label: 'Menu / Pause' },
] as const;

export const BUILDER_BINDINGS: readonly Binding[] = [
  // Gizmo & Tool Modes
  { id: 'gizmo.translate', chord: 'KeyW', scope: 'builder', when: 'rmbReleased', label: 'Translate Gizmo' },
  { id: 'gizmo.rotate', chord: 'KeyE', scope: 'builder', when: 'rmbReleased', label: 'Rotate Gizmo' },
  { id: 'gizmo.scale', chord: 'KeyR', scope: 'builder', when: 'rmbReleased', label: 'Scale Gizmo' },
  { id: 'gizmo.space', chord: 'KeyQ', scope: 'builder', when: 'rmbReleased', label: 'Toggle Space (World/Local/Track)' },
  { id: 'camera.focus', chord: 'KeyF', scope: 'builder', when: 'rmbReleased', label: 'Focus Selected' },
  { id: 'builder.zen', chord: 'KeyH', scope: 'builder', when: 'rmbReleased', label: 'Toggle Zen Mode' },
  
  // History & Editing Chords
  { id: 'builder.undo', chord: 'Ctrl+KeyZ', scope: 'builder', label: 'Undo' },
  { id: 'builder.undo', chord: 'Meta+KeyZ', scope: 'builder', label: 'Undo (Mac)' },
  { id: 'builder.redo', chord: 'Ctrl+KeyY', scope: 'builder', label: 'Redo' },
  { id: 'builder.redo', chord: 'Meta+KeyY', scope: 'builder', label: 'Redo (Mac)' },
  { id: 'builder.redo', chord: 'Ctrl+Shift+KeyZ', scope: 'builder', label: 'Redo' },
  { id: 'builder.redo', chord: 'Meta+Shift+KeyZ', scope: 'builder', label: 'Redo (Mac)' },
  { id: 'builder.group', chord: 'Ctrl+KeyG', scope: 'builder', label: 'Group Selected' },
  { id: 'builder.group', chord: 'Meta+KeyG', scope: 'builder', label: 'Group Selected (Mac)' },
  { id: 'builder.ungroup', chord: 'Ctrl+Shift+KeyG', scope: 'builder', label: 'Ungroup Selected' },
  { id: 'builder.ungroup', chord: 'Meta+Shift+KeyG', scope: 'builder', label: 'Ungroup Selected (Mac)' },
  { id: 'builder.duplicate', chord: 'Ctrl+KeyD', scope: 'builder', label: 'Duplicate Selected' },
  { id: 'builder.duplicate', chord: 'Meta+KeyD', scope: 'builder', label: 'Duplicate Selected (Mac)' },
  { id: 'builder.delete', chord: 'Delete', scope: 'builder', label: 'Delete Selected' },
  { id: 'builder.delete', chord: 'Backspace', scope: 'builder', label: 'Delete Selected' },
  { id: 'builder.cancel', chord: 'Escape', scope: 'builder', label: 'Deselect / Cancel' },

  // Orthographic Projections
  { id: 'camera.ortho.top', chord: 'Numpad7', scope: 'builder', label: 'Top Ortho View' },
  { id: 'camera.ortho.top', chord: 'Alt+Digit7', scope: 'builder', label: 'Top Ortho View (Laptop)' },
  { id: 'camera.ortho.front', chord: 'Numpad1', scope: 'builder', label: 'Front Ortho View' },
  { id: 'camera.ortho.front', chord: 'Alt+Digit1', scope: 'builder', label: 'Front Ortho View (Laptop)' },
  { id: 'camera.ortho.side', chord: 'Numpad3', scope: 'builder', label: 'Side Ortho View' },
  { id: 'camera.ortho.side', chord: 'Alt+Digit3', scope: 'builder', label: 'Side Ortho View (Laptop)' },

  // Free-Fly Camera (Active while RMB is held)
  { id: 'fly.forward', chord: 'KeyW', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Forward' },
  { id: 'fly.backward', chord: 'KeyS', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Backward' },
  { id: 'fly.left', chord: 'KeyA', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Left' },
  { id: 'fly.right', chord: 'KeyD', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Right' },
  { id: 'fly.up', chord: 'Space', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Up' },
  { id: 'fly.down', chord: 'KeyZ', scope: 'builder.fly', when: 'rmbHeld', label: 'Fly Down' },
] as const;

export interface KeymapConflict {
  chord: string;
  scope: KeyScope;
  ids: string[];
}

/** Pure. Duplicate chord in the same scope + same 'when' with different IDs => conflict. */
export function findConflicts(bindings: readonly Binding[]): KeymapConflict[] {
  const map = new Map<string, { chord: string; scope: KeyScope; ids: Set<string> }>();
  for (const b of bindings) {
    const key = `${b.scope}::${b.when ?? 'any'}::${b.chord}`;
    const entry = map.get(key);
    if (!entry) {
      map.set(key, { chord: b.chord, scope: b.scope, ids: new Set([b.id]) });
    } else {
      entry.ids.add(b.id);
    }
  }

  const conflicts: KeymapConflict[] = [];
  for (const entry of map.values()) {
    if (entry.ids.size > 1) {
      conflicts.push({
        chord: entry.chord,
        scope: entry.scope,
        ids: Array.from(entry.ids),
      });
    }
  }
  return conflicts;
}

export function formatChord(e: { code: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.code);
  return parts.join('+');
}

export class Keymap {
  private readonly bindings: readonly Binding[];
  private readonly scopes: KeyScope[] = ['race'];

  constructor(bindings: readonly Binding[] = [...RACE_BINDINGS, ...BUILDER_BINDINGS]) {
    this.bindings = bindings;
  }

  pushScope(s: KeyScope): void {
    this.scopes.push(s);
  }

  popScope(s: KeyScope): void {
    const idx = this.scopes.lastIndexOf(s);
    if (idx >= 0) {
      this.scopes.splice(idx, 1);
    }
  }

  hasScope(s: KeyScope): boolean {
    return this.scopes.includes(s);
  }

  get activeScope(): KeyScope {
    return this.scopes[this.scopes.length - 1] ?? 'race';
  }

  /**
   * Resolves the key event to an action ID.
   * Scopes in stack order (highest wins).
   * Chords (with modifiers) match before bare keys.
   * If 'text-input' scope is active, bare keys are swallowed (returns null).
   */
  resolve(
    e: { code: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean },
    rmbHeld = false,
  ): string | null {
    const hasMod = Boolean(e.ctrlKey || e.metaKey || e.altKey);
    const chord = formatChord(e);
    const isTextInput = this.hasScope('text-input');

    // Text inputs swallow all bare keys (letters/numbers/symbols) without modifier keys
    if (isTextInput && !hasMod) {
      return null;
    }

    // Inspect active scopes from top of stack to bottom
    const whenMode = rmbHeld ? 'rmbHeld' : 'rmbReleased';

    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];
      if (scope === 'text-input') continue;

      // Filter matching bindings in this scope
      const candidates = this.bindings.filter((b) => {
        if (b.scope !== scope) return false;
        if (b.chord !== chord && b.chord !== e.code) return false;
        if (b.when && b.when !== whenMode) return false;
        return true;
      });

      // Prefer exact chord matches (e.g. Ctrl+KeyZ) over bare key candidate
      const exactChord = candidates.find((b) => b.chord === chord);
      if (exactChord) return exactChord.id;

      const bareKey = candidates.find((b) => b.chord === e.code);
      if (bareKey && !hasMod) return bareKey.id;
    }

    return null;
  }
}
