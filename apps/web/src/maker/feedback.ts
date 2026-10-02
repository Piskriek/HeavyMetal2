import { createAudioEngine, type AudioEngine, type PlayableRecipe, type SfxId } from '@hm/audio';

/**
 * Tactile feedback for the Map Maker: synthesised sounds, toasts and haptics, behind one tiny API.
 * Audio starts lazily on the first user gesture (browsers require it) and is a safe no-op when unavailable.
 */

let engine: AudioEngine | null = null;
let enabled = true;
const lastPlayed = new Map<string, number>();

function ensure(): AudioEngine | null {
  if (!enabled) return null;
  if (engine) return engine;
  try {
    const Ctx = (window as unknown as { AudioContext?: new () => unknown; webkitAudioContext?: new () => unknown });
    const C = Ctx.AudioContext ?? Ctx.webkitAudioContext;
    engine = createAudioEngine(C ? (new C() as never) : null, { master: 0.7, sfx: 0.9, music: 0.5 });
    engine.resume();
    // browsers keep audio suspended until a gesture: resume on the first key press or tap
    const wake = (): void => { engine?.resume(); };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  } catch {
    engine = createAudioEngine(null);
  }
  return engine;
}

/** Lets the app substitute edited sound presets for the built-in recipes. */
export type SoundResolver = (id: string) => { recipe: PlayableRecipe; volume: number; pitch: number } | null;
let resolver: SoundResolver | null = null;
export function setSoundResolver(r: SoundResolver | null): void { resolver = r; }
/** The shared audio engine (null while sound is off), for engine hums, music and the Sound Lab preview. */
export function audio(): AudioEngine | null { return ensure(); }

export function setSoundEnabled(on: boolean): void { enabled = on; }
export function soundEnabled(): boolean { return enabled; }

/** Play a sound; `minGapMs` rate-limits repeating sounds (brush strokes) so they feel like texture, not noise. */
export function fx(id: SfxId, o: { volume?: number; pitch?: number; minGapMs?: number } = {}): void {
  const now = performance.now();
  if (o.minGapMs && now - (lastPlayed.get(id) ?? -1e9) < o.minGapMs) return;
  lastPlayed.set(id, now);
  const eng = ensure();
  if (!eng) return;
  const over = resolver?.(id) ?? null;
  if (over) {
    if (over.volume > 0) eng.playRecipe(over.recipe, { volume: (o.volume ?? 1) * over.volume, pitch: (o.pitch ?? 1) * over.pitch });
    return;
  }
  eng.playSfx(id, { ...(o.volume !== undefined ? { volume: o.volume } : {}), ...(o.pitch !== undefined ? { pitch: o.pitch } : {}) });
}

export function haptic(pattern: number | readonly number[] = 8): void {
  try { navigator.vibrate?.(pattern as number | number[]); } catch { /* not available */ }
}

export type ToastKind = 'info' | 'ok' | 'warn' | 'error';
export interface Toast { id: number; text: string; kind: ToastKind; at: number }

let nextToast = 1;
let list: Toast[] = [];
const subs = new Set<() => void>();
const emit = (): void => { for (const s of subs) s(); };

export const toasts = {
  get(): readonly Toast[] { return list; },
  subscribe(fn: () => void): () => void { subs.add(fn); return () => { subs.delete(fn); }; },
  push(text: string, kind: ToastKind = 'info', ms = 2600): void {
    const t: Toast = { id: nextToast++, text, kind, at: performance.now() };
    list = [...list.slice(-3), t];
    emit();
    setTimeout(() => { list = list.filter((x) => x.id !== t.id); emit(); }, ms);
  },
};

/** One call = the right sound + haptic + toast for a common editor event. */
export function feedback(event: 'placed' | 'deleted' | 'undo' | 'redo' | 'saved' | 'error' | 'success' | 'snap' | 'select' | 'tool', text?: string): void {
  switch (event) {
    case 'placed': fx('place'); haptic(12); if (text) toasts.push(text, 'ok'); break;
    case 'deleted': fx('delete'); haptic(10); if (text) toasts.push(text, 'info'); break;
    case 'undo': fx('undo'); haptic(6); if (text) toasts.push(`Undid: ${text}`, 'info'); break;
    case 'redo': fx('redo'); haptic(6); if (text) toasts.push(`Redid: ${text}`, 'info'); break;
    case 'saved': fx('save'); haptic([10, 40, 10]); toasts.push(text ?? 'Saved', 'ok'); break;
    case 'error': fx('ui-error'); haptic([30, 30, 30]); toasts.push(text ?? 'That did not work', 'error', 3600); break;
    case 'success': fx('ui-success'); haptic(14); if (text) toasts.push(text, 'ok'); break;
    case 'snap': fx('snap', { minGapMs: 40 }); haptic(4); break;
    case 'select': fx('select', { minGapMs: 60 }); break;
    case 'tool': fx('tool-switch'); break;
  }
}
